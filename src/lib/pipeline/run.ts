import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { routeMessage } from "@/lib/ai/router";
import { teach, SceneBuildError } from "@/lib/ai/teach";
import { verify } from "@/lib/ai/verify";
import { answerFollowup } from "@/lib/ai/followup";
import { readPage, textIsThin, pickNamed } from "@/lib/ai/pagereader";
import { parseNcertRef, chapterIndexText, findChapter } from "@/lib/ncert";
import { recordSafetyEvent, SAFE_REPLY } from "@/lib/safety";
import { RefusalError, ModelOutputError, type ModelUsage } from "@/lib/ai/client";
import { Format, SceneDoc, parseSceneDoc, type SceneDoc as SceneDocT } from "@/lib/scene/schema";
import { CREDIT_COST, allowedBucketsFor, FREE_TIER } from "@/lib/billing/plans";
import { getPlanForAccount } from "@/lib/billing/subscription";
import { reserveCredits, settleCredits, releaseCredits, InsufficientCreditsError } from "@/lib/credits/ledger";
import { NonRetryableError } from "@/lib/queue/jobs";
import { storage } from "@/lib/storage";
import { renderAssets } from "@/lib/render/assets";
import { chats, explanations, library, messages, students, usage, type ExplanationStatus, type MessageRow } from "@/lib/repo";

/**
 * The explanation pipeline. One call per explanation row, driven by the job queue.
 *
 *   queued -> routing -> (library hit | teaching -> verifying -> rendering) -> ready
 *                      \-> failed (credits released)
 *
 * Every transition is written to the explanations row, which the UI follows over SSE.
 * Credits are reserved before model work and settled after; a failure releases them.
 */

export class PipelineError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "PipelineError";
  }
}

const FRIENDLY: Record<string, string> = {
  insufficient_credits: "You're out of credits for this. Add a top-up or upgrade your plan and send it again.",
  insufficient_credits_free: "The free plan includes one fresh diagram, and it has been used. Choose a plan to keep asking, or browse the free library.",
  verification_failed: "I couldn't produce an explanation I'm confident is correct. Try rephrasing, or ask about a smaller part of the topic.",
  refused: "I can't help with that one. Ask me anything from your school subjects.",
  model_error: "Something went wrong while building this explanation. Please try again in a moment.",
  not_configured: "Explanations are not switched on for this server yet. The team has been told.",
};

export async function runExplanation(explanationId: string, opts: { isLastAttempt: boolean; signal?: AbortSignal }): Promise<void> {
  const e = env();
  const log = logger.child({ explanationId });

  const ex = await explanations.get(explanationId);
  if (!ex) throw new NonRetryableError("explanation not found");
  if (ex.status !== "queued") {
    log.info({ status: ex.status }, "skipping: not queued");
    return;
  }

  const usages: ModelUsage[] = [];
  let reserved: { amount: number; refType: "explanation" | "followup" } | null = null;

  const setStatus = (status: ExplanationStatus, patch: Record<string, unknown> = {}) => explanations.patch(explanationId, { status, ...patch });
  const setAssistant = async (content: string) => {
    if (ex.assistant_message_id) await messages.setContent(ex.assistant_message_id, content);
  };
  const recordUsage = () =>
    usage.insertMany(usages.map((u) => ({ accountId: ex.account_id, explanationId, ...u })));
  const costPaise = () => usages.reduce((s, u) => s + u.costPaise, 0);

  try {
    await setStatus("routing");

    // ----- context -----
    const [history, userMsg, chat, student, planInfo, prior] = await Promise.all([
      messages.list(ex.chat_id, 20),
      ex.user_message_id ? messages.get(ex.user_message_id) : Promise.resolve(null),
      chats.getAny(ex.chat_id),
      ex.student_id ? students.getAny(ex.student_id) : Promise.resolve(null),
      getPlanForAccount(ex.account_id),
      explanations.lastReadyWithScene(ex.chat_id, explanationId),
    ]);
    if (!userMsg) throw new NonRetryableError("user message missing");
    let questionText = userMsg.content;
    const language: "english" | "hinglish" = ex.hints?.language === "hinglish" ? "hinglish" : "english";
    const plan = planInfo.plan;
    const isFree = plan.code === "free";
    const priorDoc: SceneDocT | null = prior?.scene ? (SceneDoc.safeParse(prior.scene).data ?? null) : null;

    const recentTurns = history
      .filter((m: MessageRow) => m.id !== ex.assistant_message_id && (m.role === "user" || m.role === "assistant") && m.content)
      .map((m: MessageRow) => ({ role: m.role as "user" | "assistant", text: m.content }));

    const image = await loadFirstImage(userMsg.attachments);

    // ----- a photo of a whole page: find the questions on it, let the student pick -----
    if (image && !ex.hints?.reexplain && textIsThin(userMsg.content)) {
      const { read, usage: readUsage } = await readPage(image, userMsg.content);
      usages.push(readUsage);
      if (read.unsafe) {
        await recordSafetyEvent({ accountId: ex.account_id, kind: "unsafe_image", source: "image" });
        await setAssistant(SAFE_REPLY);
        await setStatus("ready", { source: "followup", credits_charged: 0, cost_paise: costPaise(), model_usage: usages });
        await recordUsage();
        return;
      }
      if (read.isQuestionPage && read.questions.length > 0) {
        const named = pickNamed(read, userMsg.content);
        if (named) questionText = `${named.label}: ${named.text}`;
        else if (read.questions.length === 1) questionText = `${read.questions[0].label}: ${read.questions[0].text}`;
        else {
          const items = read.questions.slice(0, 10).map((x) => `${x.label}: ${x.text}`.slice(0, 400));
          if (ex.assistant_message_id) await messages.setContentAndOptions(ex.assistant_message_id, `I can see ${items.length} questions on this page${read.chapterHint ? ` (${read.chapterHint})` : ""}. Tap the one you want explained.`, items);
          await setStatus("ready", { source: "followup", credits_charged: 0, cost_paise: costPaise(), model_usage: usages });
          await recordUsage();
          log.info({ found: items.length }, "page read: asked student to pick");
          return;
        }
        log.info({ picked: questionText.slice(0, 80) }, "page read: question picked");
      }
    }

    // ----- exact-question cache: the same question at the same class is generated once -----
    if (!image && !ex.hints?.reexplain) {
      const normalised = questionText.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
      const hash = createHash("sha256").update(`${normalised}|${student?.class_level ?? 0}${language === "hinglish" ? "|hinglish" : ""}`).digest("hex");
      await explanations.patch(explanationId, { question_hash: hash });
      const cached = await explanations.findByQuestionHash(hash, explanationId);
      const cachedDoc = cached?.scene ? SceneDoc.safeParse(cached.scene) : null;
      if (cached && cachedDoc?.success) {
        await reserveOrFail({ amount: CREDIT_COST.library, refType: "explanation", kind: "library" });
        if (chat && chat.title === "New chat") await chats.setTitleIfDefault(ex.chat_id, cached.concept_title ?? questionText.slice(0, 60));
        await setAssistant(cachedDoc.data.summary);
        await settleCredits({ accountId: ex.account_id, refType: "explanation", refId: explanationId, finalAmount: CREDIT_COST.library, key: `settle:${explanationId}` });
        reserved = null;
        await setStatus("ready", {
          source: "library",
          format: cached.format,
          subject: cached.subject,
          class_level: cached.class_level,
          concept_key: cached.concept_key,
          concept_title: cached.concept_title,
          scene: cachedDoc.data,
          scene_version: cachedDoc.data.version,
          credits_quoted: CREDIT_COST.library,
          credits_charged: CREDIT_COST.library,
          cost_paise: 0,
          model_usage: [],
        });
        log.info({ from: cached.id }, "served from question cache");
        return;
      }
    }

    // ----- route -----
    let enabled = (e.ENABLE_FORMATS as string[]).filter((f): f is Format => Format.safeParse(f).success);
    const prev = ex.hints?.reexplain?.previousFormat;
    if (prev && enabled.length > 1) enabled = enabled.filter((f) => f !== prev);

    const { decision, usage: routeUsage } = await routeMessage({
      text: ex.hints?.reexplain && priorDoc ? `${questionText}\n\n(This is about the explanation just shown: "${priorDoc.title}", concept ${priorDoc.concept.title}, Class ${priorDoc.concept.classLevel} ${priorDoc.concept.subject}. Intent is explain, same concept.)` : questionText,
      imageBase64: image,
      studentClass: student?.class_level ?? null,
      recentTurns,
      hasPriorExplanation: Boolean(priorDoc),
      enabledFormats: enabled,
      forceFormat: isFree ? FREE_TIER.freshGenerationFormat : null,
      ncertIndex: student?.class_level ? `Science: ${chapterIndexText(student.class_level, "science")} || Maths: ${chapterIndexText(student.class_level, "maths")}` : undefined,
    });
    usages.push(routeUsage);
    log.info({ intent: decision.intent, format: decision.format, concept: decision.concept.key }, "routed");

    if (chat && chat.title === "New chat") {
      const title = decision.intent === "explain" || decision.intent === "solve" ? decision.concept.title : questionText.slice(0, 60);
      await chats.setTitleIfDefault(ex.chat_id, title);
    }

    // ----- small talk, off-topic, unsafe: no credits -----
    if (decision.intent === "chitchat" || decision.intent === "offtopic" || decision.intent === "unsafe") {
      if (decision.intent === "unsafe") await recordSafetyEvent({ accountId: ex.account_id, kind: "unsafe_intent", source: "chat", sample: questionText });
      await setAssistant(decision.intent === "unsafe" ? SAFE_REPLY : decision.reply || "Ask me anything from your school subjects.");
      await setStatus("ready", { source: "followup", credits_charged: 0, cost_paise: costPaise(), model_usage: usages });
      await recordUsage();
      return;
    }

    // ----- follow-up -----
    // A one-tap "simpler" / "Hinglish" re-explain is always a fresh explanation of the same concept, never a text follow-up.
    if (decision.intent === "followup" && priorDoc && !ex.hints?.reexplain) {
      const amount = CREDIT_COST.followup;
      await reserveOrFail({ amount, refType: "followup" });
      let lastWrite = 0;
      const { text, usage: fuUsage, refused } = await answerFollowup({
        question: questionText,
        doc: priorDoc,
        recentTurns,
        language,
        hard: decision.needsHardModel,
        signal: opts.signal,
        onText: (acc) => {
          const now = Date.now();
          if (now - lastWrite > 300) {
            lastWrite = now;
            void setAssistant(acc);
          }
        },
      });
      usages.push(fuUsage);
      if (refused) throw new PipelineError("refused", "follow-up refused", false);
      await setAssistant(text);
      await settleCredits({ accountId: ex.account_id, refType: "followup", refId: explanationId, finalAmount: amount, key: `settle:${explanationId}` });
      reserved = null;
      await setStatus("ready", { source: "followup", format: null, credits_charged: amount, cost_paise: costPaise(), model_usage: usages, concept_key: priorDoc.concept.key });
      await recordUsage();
      return;
    }

    // ----- explain / solve -----
    const format = decision.format;
    const concept = decision.concept;
    await explanations.patch(explanationId, { format, subject: decision.subject, class_level: decision.classLevel, concept_key: concept.key, concept_title: concept.title });

    // Library first. A hit costs 1 credit and no model time.
    if (!ex.hints?.reexplain && language === "english") {
      const lesson = await library.find(concept.key, decision.classLevel, format);
      const doc = lesson ? SceneDoc.safeParse(lesson.scene) : null;
      if (lesson && doc?.success) {
        await reserveOrFail({ amount: CREDIT_COST.library, refType: "explanation", kind: "library" });
        await setAssistant(doc.data.summary);
        await settleCredits({ accountId: ex.account_id, refType: "explanation", refId: explanationId, finalAmount: CREDIT_COST.library, key: `settle:${explanationId}` });
        reserved = null;
        await library.bumpServe(lesson.id);
        await setStatus("ready", {
          source: "library",
          scene: doc.data,
          scene_version: doc.data.version,
          library_lesson_id: lesson.id,
          credits_quoted: CREDIT_COST.library,
          credits_charged: CREDIT_COST.library,
          cost_paise: costPaise(),
          model_usage: usages,
        });
        await recordUsage();
        log.info({ lessonId: lesson.id }, "served from library");
        return;
      }
    }

    // Fresh generation.
    const quoted = CREDIT_COST[format];
    await explanations.patch(explanationId, { credits_quoted: quoted, language });
    await reserveOrFail({ amount: quoted, refType: "explanation", kind: format });

    await setStatus("teaching");
    const revisionNotes: string[] = [];
    if (ex.hints?.reexplain?.reason) {
      revisionNotes.push(
        `The student saw a previous explanation (${ex.hints.reexplain.previousFormat ?? "unknown format"}) and said: "${ex.hints.reexplain.reason}". Take a different approach: a new analogy, fewer steps, start from what they already know.`,
      );
    }
    const conceptInput = { key: concept.key, title: concept.title, subject: decision.subject, classLevel: decision.classLevel, chapter: concept.chapter };
    const ncertHint = parseNcertRef(questionText);
    const ncertChapterNo = findChapter(decision.classLevel, decision.subject, decision.ncertChapter ?? ncertHint.chapter)?.n ?? null;
    const ncertChapterName = findChapter(decision.classLevel, decision.subject, ncertChapterNo)?.name ?? null;
    const ncertIndex = ncertChapterNo ? `Chapter ${ncertChapterNo}, ${ncertChapterName}` : "";
    const ncert = { chapter: ncertChapterNo, chapterName: ncertChapterName, ref: ncertHint.ref };
    const first = await teach({ question: questionText, format, concept: conceptInput, imageBase64: image, revisionNotes, language, ncertIndex, ncertHint });
    let doc: SceneDocT = { ...first.doc, language, concept: { ...first.doc.concept, ncert } };
    usages.push(...first.usage);

    await setStatus("verifying");
    const firstReview = await verify(doc, questionText, language);
    usages.push(firstReview.usage);
    let review = firstReview.result;
    if (review.verdict === "fail") {
      log.warn({ issues: review.issues }, "verification failed, revising once");
      const notes = review.issues.map((i) => `scene ${i.sceneIndex}: ${i.description}. Fix: ${i.fix}`);
      const second = await teach({ question: questionText, format, concept: conceptInput, imageBase64: image, revisionNotes: [...revisionNotes, ...notes], language, ncertIndex, ncertHint });
      doc = { ...second.doc, language, concept: { ...second.doc.concept, ncert } };
      usages.push(...second.usage);
      const again = await verify(doc, questionText, language);
      usages.push(again.usage);
      review = again.result;
      if (review.verdict === "fail") throw new PipelineError("verification_failed", "scene failed verification twice", false);
    }

    doc = { ...doc, followUps: (review.followUps ?? []).filter((f) => f.length >= 5).slice(0, 3).map((f) => f.slice(0, 140)) };

    await setStatus("rendering");
    // Diagram SVG is already sanitised; steps, slides and 3D render client-side. Narration audio,
    // illustrations and video clips attach here when their providers are configured.
    const rendered = await renderAssets(doc, { explanationId, fastVideo: plan.fastVideo, premiumNarration: plan.premiumNarration });
    if (rendered.report.errors.length) log.warn({ errors: rendered.report.errors }, "asset rendering had failures");

    const finalDoc = parseSceneDoc(rendered.doc);
    await setAssistant(finalDoc.summary);
    await settleCredits({ accountId: ex.account_id, refType: "explanation", refId: explanationId, finalAmount: quoted, key: `settle:${explanationId}` });
    reserved = null;
    await setStatus("ready", { source: "generated", scene: finalDoc, scene_version: finalDoc.version, credits_charged: quoted, cost_paise: costPaise(), model_usage: usages });
    await recordUsage();

    // Candidate for the library. Auto-validated when the reviewer found nothing; otherwise waits for review.
    // Never fatal: the student already has their explanation.
    await explanations
      .patch(explanationId, { ncert_chapter: ncertChapterNo, ncert_ref: ncertHint.ref })
      .catch((err) => log.warn({ err }, "ncert patch failed"));
    if (!image && language === "english") {
      const clean = review.issues.length === 0;
      await library
        .insertCandidate({ doc: finalDoc, format, status: clean ? "validated" : "candidate", qualityScore: clean ? 1 : 0.7, sourceExplanationId: explanationId })
        .catch((err) => log.error({ err }, "library candidate insert failed"));
    }
    log.info({ format, credits: quoted, costPaise: costPaise() }, "explanation ready");
  } catch (err) {
    await handleFailure(err);
  }

  // ----- helpers bound to this run -----
  async function reserveOrFail(input: { amount: number; refType: "explanation" | "followup"; kind?: Format | "library" }) {
    const planNow = await getPlanForAccount(ex!.account_id);
    const buckets = allowedBucketsFor(input.refType === "followup" ? "followup" : (input.kind ?? "library"), planNow.plan.code);
    try {
      await reserveCredits({ accountId: ex!.account_id, amount: input.amount, refType: input.refType, refId: explanationId, key: `reserve:${explanationId}`, buckets });
      reserved = { amount: input.amount, refType: input.refType };
    } catch (e2) {
      if (e2 instanceof InsufficientCreditsError) {
        throw new PipelineError(planNow.plan.code === "free" ? "insufficient_credits_free" : "insufficient_credits", e2.message, false);
      }
      throw e2;
    }
  }

  async function handleFailure(err: unknown) {
    const classified = classify(err);
    log.error({ err, code: classified.code, retryable: classified.retryable }, "pipeline failed");
    // Once the student has a ready explanation, nothing after it may undo that.
    const current = await explanations.get(explanationId).catch(() => null);
    if (current?.status === "ready") {
      log.warn("failure after ready; keeping the explanation");
      return;
    }
    if (reserved) {
      await releaseCredits({ accountId: ex!.account_id, refType: reserved.refType, refId: explanationId, amount: reserved.amount, key: `release:${explanationId}:${Date.now()}` }).catch((e2) =>
        log.error({ err: e2 }, "release failed"),
      );
      reserved = null;
    }
    await recordUsage().catch(() => undefined);
    if (classified.retryable && !opts.isLastAttempt) {
      await setStatus("queued", { error: { code: classified.code, message: classified.message, transient: true } });
      throw err;
    }
    await setAssistant(FRIENDLY[classified.code] ?? FRIENDLY.model_error);
    await setStatus("failed", { error: { code: classified.code, message: classified.message }, cost_paise: costPaise(), model_usage: usages });
    throw new NonRetryableError(`${classified.code}: ${classified.message}`, err);
  }
}

function classify(err: unknown): { code: string; message: string; retryable: boolean } {
  if (err instanceof PipelineError) return { code: err.code, message: err.message, retryable: err.retryable };
  if (err instanceof RefusalError) return { code: "refused", message: err.message, retryable: false };
  if (err instanceof SceneBuildError) return { code: "model_error", message: `${err.message}: ${err.issues.join("; ")}`, retryable: true };
  if (err instanceof ModelOutputError) return { code: "model_error", message: err.message, retryable: true };
  if (err instanceof NonRetryableError) return { code: "model_error", message: err.message, retryable: false };
  if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
    return { code: "model_error", message: err.message, retryable: true };
  }
  if (err instanceof Anthropic.APIError) return { code: "model_error", message: `${err.status} ${err.message}`, retryable: false };
  // Any other SDK error (for example no credential configured) is a configuration problem, not a transient one.
  if (err instanceof Anthropic.AnthropicError) return { code: "model_error", message: err.message, retryable: false };
  if (err instanceof Error && /authentication method/i.test(err.message)) return { code: "not_configured", message: err.message, retryable: false };
  return { code: "model_error", message: err instanceof Error ? err.message : String(err), retryable: true };
}

async function loadFirstImage(attachments: MessageRow["attachments"] | null) {
  const first = (attachments ?? []).find((a) => a.type === "image");
  if (!first) return null;
  try {
    const buf = await storage().get(first.path);
    return { mediaType: first.mediaType, data: buf.toString("base64") };
  } catch (err) {
    logger.warn({ path: first.path, err }, "attachment download failed");
    return null;
  }
}
