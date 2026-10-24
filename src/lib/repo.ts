import type { Queryable } from "@/lib/db";
import { db, q, one, maybe } from "@/lib/db";
import type { SceneDoc } from "@/lib/scene/schema";

/**
 * All SQL for the product's tables lives here, one small function per operation, so routes and
 * the pipeline read like intent and the queries can be reviewed in one place.
 */

// ---------- users / students / settings ----------

export interface StudentRow {
  id: string;
  account_id: string;
  name: string;
  class_level: number;
  board: string;
}

export const students = {
  list: (accountId: string) => q<StudentRow>(`select id, account_id, name, class_level, board from students where account_id = $1 order by created_at`, [accountId]),
  count: async (accountId: string) => Number((await one<{ n: string }>(`select count(*)::text as n from students where account_id = $1`, [accountId])).n),
  get: (id: string, accountId: string) => maybe<StudentRow>(`select id, account_id, name, class_level, board from students where id = $1 and account_id = $2`, [id, accountId]),
  getAny: (id: string) => maybe<StudentRow>(`select id, account_id, name, class_level, board from students where id = $1`, [id]),
  create: (accountId: string, name: string, classLevel: number) =>
    one<StudentRow>(`insert into students(account_id, name, class_level) values ($1,$2,$3) returning id, account_id, name, class_level, board`, [accountId, name, classLevel]),
  listWithStreaks: (accountId: string) =>
    q<StudentRow & { current_days: number | null; longest_days: number | null; last_passed_on: string | null }>(
      `select s.id, s.account_id, s.name, s.class_level, s.board, st.current_days, st.longest_days, st.last_passed_on
         from students s left join streaks st on st.student_id = s.id
        where s.account_id = $1 order by s.created_at`,
      [accountId],
    ),
};

// ---------- chats / messages ----------

export interface ChatRow {
  id: string;
  account_id: string;
  student_id: string | null;
  title: string;
  starred: boolean;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export const chats = {
  list: (accountId: string, search?: string) =>
    q<ChatRow>(
      `select id, account_id, student_id, title, starred, last_message_at, created_at, updated_at from chats
        where account_id = $1 and ($2::text is null or title ilike '%' || $2 || '%')
        order by starred desc, last_message_at desc limit 200`,
      [accountId, search ?? null],
    ),
  get: (id: string, accountId: string) =>
    maybe<ChatRow>(`select id, account_id, student_id, title, starred, last_message_at, created_at, updated_at from chats where id = $1 and account_id = $2`, [id, accountId]),
  getAny: (id: string) => maybe<ChatRow>(`select id, account_id, student_id, title, starred, last_message_at, created_at, updated_at from chats where id = $1`, [id]),
  create: (accountId: string, studentId: string | null, client: Queryable = db()) =>
    one<ChatRow>(`insert into chats(account_id, student_id) values ($1,$2) returning id, account_id, student_id, title, starred, last_message_at, created_at, updated_at`, [accountId, studentId], client),
  update: (id: string, patch: { title?: string; starred?: boolean }) =>
    one<ChatRow>(
      `update chats set title = coalesce($2, title), starred = coalesce($3, starred) where id = $1 returning id, account_id, student_id, title, starred, last_message_at, created_at, updated_at`,
      [id, patch.title ?? null, patch.starred ?? null],
    ),
  setTitleIfDefault: (id: string, title: string) => q(`update chats set title = $2 where id = $1 and title = 'New chat'`, [id, title]),
  touch: (id: string, client: Queryable = db()) => q(`update chats set last_message_at = now() where id = $1`, [id], client),
  remove: (id: string) => q(`delete from chats where id = $1`, [id]),
};

export interface MessageRow {
  id: string;
  chat_id: string;
  account_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: ({ type: "image"; path: string; mediaType: "image/png" | "image/jpeg" | "image/webp" } | { type: "options"; items: string[] })[];
  explanation_id: string | null;
  seq: string;
  created_at: string;
  updated_at: string;
}

const MSG_COLS = `id, chat_id, account_id, role, content, attachments, explanation_id, seq::text as seq, created_at, updated_at`;

export const retention = {
  /** User messages older than `days` that still carry attachments. */
  staleUploads: (days: number) =>
    q<{ id: string; attachments: { type: string; path: string }[] }>(
      `select id, attachments from messages where role = 'user' and jsonb_array_length(attachments) > 0 and created_at < now() - ($1 || ' days')::interval limit 200`,
      [String(days)],
    ),
  clearAttachments: (id: string) => q(`update messages set attachments = '[]'::jsonb where id = $1`, [id]),
};

export const admin = {
  overview: async () => {
    const one = async <T extends Record<string, unknown>>(sql: string) => (await q<T>(sql))[0];
    const [users_, ex, cache, money, cost, queue, lib, reports_, speed] = await Promise.all([
      one<{ total: string; d1: string; d7: string; d30: string }>(`select count(*)::text total, count(*) filter (where created_at > now()-interval '1 day')::text d1, count(*) filter (where created_at > now()-interval '7 days')::text d7, count(*) filter (where created_at > now()-interval '30 days')::text d30 from users`),
      one<{ d1: string; d7: string; d30: string; failed7: string; inflight: string }>(`select count(*) filter (where created_at > now()-interval '1 day')::text d1, count(*) filter (where created_at > now()-interval '7 days')::text d7, count(*) filter (where created_at > now()-interval '30 days')::text d30, count(*) filter (where status='failed' and created_at > now()-interval '7 days')::text failed7, count(*) filter (where status in ('queued','routing','teaching','verifying','rendering'))::text inflight from explanations`),
      one<{ generated: string; library: string; followup: string }>(`select count(*) filter (where source='generated')::text generated, count(*) filter (where source='library')::text library, count(*) filter (where source='followup')::text followup from explanations where status='ready' and created_at > now()-interval '30 days'`),
      one<{ paid30: string; paid_all: string; active_subs: string; credits_used30: string }>(`select coalesce(sum(total_paise) filter (where status='paid' and created_at > now()-interval '30 days'),0)::text paid30, coalesce(sum(total_paise) filter (where status='paid'),0)::text paid_all, (select count(*) from subscriptions where status='active' and period_end > now())::text active_subs, coalesce((select -sum(amount) from credit_ledger where entry_type in ('reserve','settle') and created_at > now()-interval '30 days'),0)::text credits_used30 from payments`),
      one<{ cost30: string; cost7: string; calls7: string }>(`select coalesce(sum(cost_paise) filter (where created_at > now()-interval '30 days'),0)::text cost30, coalesce(sum(cost_paise) filter (where created_at > now()-interval '7 days'),0)::text cost7, count(*) filter (where created_at > now()-interval '7 days')::text calls7 from usage_events`),
      one<{ queued: string; running: string; dead: string; succeeded24: string }>(`select count(*) filter (where status='queued')::text queued, count(*) filter (where status='running')::text running, count(*) filter (where status='dead')::text dead, count(*) filter (where status='succeeded' and updated_at > now()-interval '1 day')::text succeeded24 from jobs`),
      one<{ candidate: string; validated: string; published: string; retired: string }>(`select count(*) filter (where status='candidate')::text candidate, count(*) filter (where status='validated')::text validated, count(*) filter (where status='published')::text published, count(*) filter (where status='retired')::text retired from library_lessons`),
      one<{ open: string }>(`select count(*) filter (where status='open')::text open from lesson_reports`),
      // Time to ready = from the request to the last model/provider call it made (updated_at moves later for other reasons).
      one<{ p50: string | null; p90: string | null }>(`with t as (select e.id, extract(epoch from (max(u.created_at) - e.created_at)) secs from explanations e join usage_events u on u.explanation_id = e.id where e.status='ready' and e.source='generated' and e.created_at > now()-interval '7 days' group by e.id, e.created_at)
        select percentile_cont(0.5) within group (order by secs)::text p50, percentile_cont(0.9) within group (order by secs)::text p90 from t`),
    ]);
    return { users: users_, explanations: ex, cache, money, cost, queue, library: lib, reports: reports_, speed };
  },
  daily: () =>
    q<{ day: string; explanations: string; generated: string; cost_paise: string; signups: string }>(
      `with d as (select generate_series((now() at time zone 'Asia/Kolkata')::date - 13, (now() at time zone 'Asia/Kolkata')::date, '1 day')::date as day)
       select d.day::text,
         (select count(*) from explanations e where (e.created_at at time zone 'Asia/Kolkata')::date = d.day)::text explanations,
         (select count(*) from explanations e where (e.created_at at time zone 'Asia/Kolkata')::date = d.day and e.source='generated')::text generated,
         (select coalesce(sum(cost_paise),0) from usage_events u where (u.created_at at time zone 'Asia/Kolkata')::date = d.day)::text cost_paise,
         (select count(*) from users x where (x.created_at at time zone 'Asia/Kolkata')::date = d.day)::text signups
       from d order by d.day`,
    ),
  recentExplanations: () =>
    q<{ id: string; status: string; source: string | null; format: string | null; concept_title: string | null; class_level: number | null; credits_charged: number | null; cost_paise: number; seconds: string | null; error: { code: string } | null; email: string | null; created_at: string; chat_id: string }>(
      `select e.id, e.status, e.source, e.format, e.concept_title, e.class_level, e.credits_charged, e.cost_paise, (select extract(epoch from (max(u.created_at) - e.created_at))::int::text from usage_events u where u.explanation_id = e.id) seconds, e.error, u.email, e.created_at, e.chat_id
         from explanations e left join users u on u.id = e.account_id order by e.created_at desc limit 40`,
    ),
  failures: () =>
    q<{ code: string; n: string }>(`select coalesce(error->>'code','unknown') code, count(*)::text n from explanations where status='failed' and created_at > now()-interval '7 days' group by 1 order by 2 desc`),
  openReports: () =>
    q<{ id: string; reason: string; detail: string | null; created_at: string; explanation_id: string; concept_title: string | null; format: string | null; email: string | null; lesson_id: string | null; lesson_status: string | null }>(
      `select r.id, r.reason, r.detail, r.created_at, r.explanation_id, e.concept_title, e.format, u.email, l.id lesson_id, l.status::text lesson_status
         from lesson_reports r join explanations e on e.id = r.explanation_id left join users u on u.id = r.account_id left join library_lessons l on l.source_explanation_id = e.id
        where r.status='open' order by r.created_at desc limit 50`,
    ),
  users: () =>
    q<{ id: string; email: string; full_name: string | null; created_at: string; last_active: string | null; days_inactive: number | null; balance: string; plan: string; explanations: string; students: string | null; emails: string; flags: string; marketing_email: boolean }>(
      `select u.id, u.email, u.full_name, u.created_at,
              greatest(u.last_login_at, (select max(last_seen_at) from sessions x where x.user_id = u.id), (select max(created_at) from explanations e where e.account_id = u.id)) last_active,
              extract(day from now() - greatest(u.last_login_at, (select max(last_seen_at) from sessions x where x.user_id = u.id), (select max(created_at) from explanations e where e.account_id = u.id)))::int days_inactive,
              credits_balance(u.id)::text balance,
              coalesce((select s.plan_code from subscriptions s where s.account_id = u.id and s.status = 'active' and s.period_end > now() order by s.period_end desc limit 1), 'free') plan,
              (select count(*) from explanations e where e.account_id = u.id)::text explanations,
              (select string_agg(st.name || ' C' || st.class_level, ', ' order by st.created_at) from students st where st.account_id = u.id) students,
              (select count(*) from email_log l where l.account_id = u.id and l.sent)::text emails,
              (select count(*) from safety_events s where s.account_id = u.id)::text flags,
              coalesce(a.marketing_email, true) marketing_email
         from users u left join account_settings a on a.account_id = u.id
        order by u.created_at desc limit 200`,
    ),
  emails: () =>
    q<{ kind: string; sent: string; d7: string }>(`select kind, count(*) filter (where sent)::text sent, count(*) filter (where sent and created_at > now()-interval '7 days')::text d7 from email_log group by kind order by kind`),
  safety: () =>
    q<{ id: string; kind: string; source: string; sample: string | null; created_at: string; email: string | null }>(
      `select s.id, s.kind, s.source, s.sample, s.created_at, u.email from safety_events s left join users u on u.id = s.account_id order by s.created_at desc limit 30`,
    ),
  safetyCounts: () => q<{ d1: string; d7: string; paused: string }>(`select count(*) filter (where created_at > now()-interval '1 day')::text d1, count(*) filter (where created_at > now()-interval '7 days')::text d7, (select count(*) from (select account_id from safety_events where kind <> 'blocked' and created_at > now()-interval '24 hours' group by account_id having count(*) >= 5) x)::text paused from safety_events`),
  claims: () => q<{ issued: string; claimed: string }>(`select count(*)::text issued, count(*) filter (where claimed_at is not null)::text claimed from credit_claims`),
  deadJobs: () => q<{ id: string; kind: string; attempts: number; last_error: string | null; updated_at: string }>(`select id, kind, attempts, last_error, updated_at from jobs where status='dead' order by updated_at desc limit 30`),
  resolveReport: (id: string, resolution: string) => q(`update lesson_reports set status='resolved', resolved_at=now(), resolution=$2 where id=$1`, [id, resolution]),
  setLessonStatus: (id: string, status: "published" | "retired" | "validated") =>
    q(`update library_lessons set status=$2::lesson_status, validated_at = case when $2 in ('validated','published') then now() else validated_at end, retired_at = case when $2='retired' then now() else null end, quality_score = case when $2 in ('validated','published') then 1 else quality_score end where id=$1`, [id, status]),
  retryJob: (id: string) => q(`update jobs set status='queued', attempts=0, run_after=now(), last_error=null where id=$1 and status='dead'`, [id]),
};

export const reports = {
  insert: (input: { explanationId: string; accountId: string; reason: string; detail: string | null }) =>
    q(`insert into lesson_reports(explanation_id, account_id, reason, detail) values ($1,$2,$3,$4)`, [input.explanationId, input.accountId, input.reason, input.detail]),
  /** Pull the source lesson out of circulation while it is looked at. */
  quarantineLesson: (explanationId: string) =>
    q(`update library_lessons set status = 'candidate', quality_score = least(coalesce(quality_score, 1), 0.5) where source_explanation_id = $1 and status in ('validated','published')`, [explanationId]),
};

export const messages = {
  list: (chatId: string, limit = 500) => q<MessageRow>(`select ${MSG_COLS} from messages where chat_id = $1 order by seq asc limit $2`, [chatId, limit]),
  get: (id: string) => maybe<MessageRow>(`select ${MSG_COLS} from messages where id = $1`, [id]),
  create: (input: { chatId: string; accountId: string; role: MessageRow["role"]; content: string; attachments?: unknown[] }, client: Queryable = db()) =>
    one<MessageRow>(`insert into messages(chat_id, account_id, role, content, attachments) values ($1,$2,$3,$4,$5) returning ${MSG_COLS}`, [
      input.chatId,
      input.accountId,
      input.role,
      input.content,
      JSON.stringify(input.attachments ?? []),
    ], client),
  /** Assistant message with tappable choices (e.g. the questions found on a photographed page). */
  setContentAndOptions: (id: string, content: string, items: string[]) =>
    q(`update messages set content = $2, attachments = $3::jsonb where id = $1`, [id, content, JSON.stringify([{ type: "options", items }])]),
  setContent: (id: string, content: string) => q(`update messages set content = $2 where id = $1`, [id, content]),
  linkExplanation: (id: string, explanationId: string, client: Queryable = db()) => q(`update messages set explanation_id = $2 where id = $1`, [id, explanationId], client),
  changedSince: (chatId: string, since: Date) => q<MessageRow>(`select ${MSG_COLS} from messages where chat_id = $1 and updated_at > $2 order by seq asc`, [chatId, since]),
};

// ---------- explanations ----------

export type ExplanationStatus = "queued" | "routing" | "teaching" | "verifying" | "rendering" | "ready" | "failed" | "cancelled";

export interface ExplanationRow {
  id: string;
  request_id: string;
  chat_id: string;
  account_id: string;
  student_id: string | null;
  user_message_id: string | null;
  assistant_message_id: string | null;
  status: ExplanationStatus;
  source: "generated" | "library" | "followup" | null;
  format: string | null;
  subject: string | null;
  class_level: number | null;
  concept_key: string | null;
  concept_title: string | null;
  scene: SceneDoc | null;
  scene_version: number | null;
  library_lesson_id: string | null;
  hints: { reexplain?: { previousFormat?: string | null; reason?: string }; language?: "english" | "hinglish" };
  credits_quoted: number;
  credits_charged: number | null;
  cost_paise: number;
  model_usage: unknown[];
  share_token: string | null;
  error: { code: string; message: string } | null;
  created_at: string;
  updated_at: string;
}

const EX_COLS = `id, request_id, chat_id, account_id, student_id, user_message_id, assistant_message_id, status, source, format, subject, class_level, concept_key, concept_title, scene, scene_version, library_lesson_id, hints, credits_quoted, credits_charged, cost_paise, model_usage, share_token, error, created_at, updated_at`;
/** What the client sees: no hints, no usage. */
const EX_PUBLIC = `id, status, source, format, concept_title, scene, credits_quoted, credits_charged, error, created_at, updated_at`;

export type ExplanationPublic = Pick<ExplanationRow, "id" | "status" | "source" | "format" | "concept_title" | "scene" | "credits_quoted" | "credits_charged" | "error" | "created_at" | "updated_at">;

export const explanations = {
  get: (id: string) => maybe<ExplanationRow>(`select ${EX_COLS} from explanations where id = $1`, [id]),
  getOwned: (id: string, accountId: string) => maybe<ExplanationRow>(`select ${EX_COLS} from explanations where id = $1 and account_id = $2`, [id, accountId]),
  byRequestId: (requestId: string) =>
    maybe<Pick<ExplanationRow, "id" | "chat_id" | "user_message_id" | "assistant_message_id">>(`select id, chat_id, user_message_id, assistant_message_id from explanations where request_id = $1`, [requestId]),
  listPublic: (chatId: string) => q<ExplanationPublic>(`select ${EX_PUBLIC} from explanations where chat_id = $1 order by created_at asc`, [chatId]),
  changedSince: (chatId: string, since: Date) => q<ExplanationPublic>(`select ${EX_PUBLIC} from explanations where chat_id = $1 and updated_at > $2 order by updated_at asc`, [chatId, since]),
  inFlightCount: async (accountId: string) =>
    Number((await one<{ n: string }>(`select count(*)::text as n from explanations where account_id = $1 and status in ('queued','routing','teaching','verifying','rendering')`, [accountId])).n),
  create: (
    input: { requestId: string; chatId: string; accountId: string; studentId: string | null; userMessageId: string; assistantMessageId: string; hints: unknown },
    client: Queryable = db(),
  ) =>
    one<ExplanationRow>(
      `insert into explanations(request_id, chat_id, account_id, student_id, user_message_id, assistant_message_id, status, hints)
       values ($1,$2,$3,$4,$5,$6,'queued',$7) returning ${EX_COLS}`,
      [input.requestId, input.chatId, input.accountId, input.studentId, input.userMessageId, input.assistantMessageId, JSON.stringify(input.hints ?? {})],
      client,
    ),
  /** Generic patch: keys are column names; values are serialised as needed. */
  patch: async (id: string, patch: Record<string, unknown>) => {
    const keys = Object.keys(patch);
    if (keys.length === 0) return;
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const vals = keys.map((k) => {
      const v = patch[k];
      return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
    });
    await q(`update explanations set ${sets} where id = $1`, [id, ...vals]);
  },
  /** A ready explanation for the same normalised question and class, from anyone, without an uploaded photo. */
  findByQuestionHash: (hash: string, excludeId: string) =>
    maybe<Pick<ExplanationRow, "id" | "scene" | "format" | "concept_key" | "concept_title" | "subject" | "class_level">>(
      `select e.id, e.scene, e.format, e.concept_key, e.concept_title, e.subject, e.class_level from explanations e
        where e.question_hash = $1 and e.status = 'ready' and e.scene is not null and e.source in ('generated','library') and e.id <> $2
        order by e.created_at desc limit 1`,
      [hash, excludeId],
    ),
  setShareToken: (id: string, token: string) => q(`update explanations set share_token = $2 where id = $1 and share_token is null`, [id, token]),
  getByShareToken: (token: string) =>
    maybe<Pick<ExplanationRow, "id" | "scene" | "format" | "concept_title" | "class_level" | "subject" | "share_token">>(
      `select id, scene, format, concept_title, class_level, subject, share_token from explanations where share_token = $1 and status = 'ready' and scene is not null`,
      [token],
    ),
  lastReadyWithScene: (chatId: string, excludeId: string) =>
    maybe<Pick<ExplanationRow, "id" | "scene" | "format">>(
      `select id, scene, format from explanations where chat_id = $1 and status = 'ready' and scene is not null and id <> $2 order by created_at desc limit 1`,
      [chatId, excludeId],
    ),
};

// ---------- library ----------

export interface LessonRow {
  id: string;
  concept_key: string;
  concept_title: string;
  subject: string;
  class_level: number;
  format: string;
  title: string;
  scene: unknown;
  scene_version: number;
  status: "candidate" | "validated" | "published" | "retired";
  quality_score: number | null;
  serve_count: number;
  ncert_chapter: number | null;
}

export const library = {
  find: (conceptKey: string, classLevel: number, format: string) => maybe<LessonRow>(`select * from library_find($1,$2::smallint,$3)`, [conceptKey, classLevel, format]),
  bumpServe: (id: string) => q(`update library_lessons set serve_count = serve_count + 1 where id = $1`, [id]),
  insertCandidate: (input: { doc: SceneDoc; format: string; status: "candidate" | "validated"; qualityScore: number; sourceExplanationId: string }) =>
    q(
      `insert into library_lessons(concept_key, concept_title, subject, class_level, format, title, scene, scene_version, status, quality_score, source_explanation_id, validated_at, ncert_chapter)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::lesson_status,$10,$11, case when $9::text = 'validated' then now() else null end, $12)`,
      [
        input.doc.concept.key,
        input.doc.concept.title,
        input.doc.concept.subject,
        input.doc.concept.classLevel,
        input.format,
        input.doc.title,
        JSON.stringify(input.doc),
        input.doc.version,
        input.status,
        input.qualityScore,
        input.sourceExplanationId,
        input.doc.concept.ncert?.chapter ?? null,
      ],
    ),
  publish: (id: string) => q(`update library_lessons set status = 'published' where id = $1 and status = 'validated'`, [id]),
  /** Validated for a day with a clean review: ready to publish. */
  readyToPublish: () => q<{ id: string }>(`select id from library_lessons where status = 'validated' and quality_score >= 1 and validated_at < now() - interval '1 day' limit 200`),
  getPublished: (id: string) => maybe<LessonRow>(`select * from library_lessons where id = $1 and status = 'published'`, [id]),
  listPublished: (filter: { classLevel?: number; subject?: string; chapter?: number; subjectGroup?: "science" | "maths" }) =>
    q<Pick<LessonRow, "id" | "concept_title" | "subject" | "class_level" | "format" | "title" | "serve_count" | "ncert_chapter">>(
      `select id, concept_title, subject, class_level, format, title, serve_count, ncert_chapter from library_lessons
        where status = 'published' and ($1::smallint is null or class_level = $1) and ($2::text is null or subject = $2)
          and ($3::smallint is null or ncert_chapter = $3)
          and ($4::text is null or ($4 = 'maths' and subject = 'maths') or ($4 = 'science' and subject in ('science','physics','chemistry','biology')))
        order by class_level, subject, ncert_chapter nulls last, concept_title limit 500`,
      [filter.classLevel ?? null, filter.subject ?? null, filter.chapter ?? null, filter.subjectGroup ?? null],
    ),
};

// ---------- learning ----------

export const checks = {
  insert: (input: { explanationId: string; accountId: string; studentId: string | null; answer: string; passed: boolean }) =>
    q(`insert into check_results(explanation_id, account_id, student_id, answer, passed) values ($1,$2,$3,$4,$5)`, [input.explanationId, input.accountId, input.studentId, input.answer, input.passed]),
  forStudentOnDate: (studentId: string, start: Date, end: Date) =>
    q<{ passed: boolean; concept_title: string | null; ncert_chapter: number | null; class_level: number | null; subject: string | null }>(
      `select c.passed, e.concept_title, e.ncert_chapter, e.class_level, e.subject from check_results c join explanations e on e.id = c.explanation_id
        where c.student_id = $1 and c.created_at >= $2 and c.created_at < $3 order by c.created_at`,
      [studentId, start, end],
    ),
};

export const streaks = {
  get: (studentId: string) => maybe<{ current_days: number; longest_days: number; last_passed_on: string | null }>(`select current_days, longest_days, last_passed_on::text from streaks where student_id = $1`, [studentId]),
  upsert: (studentId: string, current: number, longest: number, lastPassedOn: string) =>
    q(
      `insert into streaks(student_id, current_days, longest_days, last_passed_on) values ($1,$2,$3,$4)
       on conflict (student_id) do update set current_days = excluded.current_days, longest_days = excluded.longest_days, last_passed_on = excluded.last_passed_on`,
      [studentId, current, longest, lastPassedOn],
    ),
};

export const settings = {
  get: (accountId: string) => maybe<{ parent_report_email: boolean; marketing_email: boolean; timezone: string }>(`select parent_report_email, marketing_email, timezone from account_settings where account_id = $1`, [accountId]),
  setMarketingEmail: (accountId: string, on: boolean) =>
    q(`insert into account_settings(account_id, marketing_email) values ($1,$2) on conflict (account_id) do update set marketing_email = excluded.marketing_email, updated_at = now()`, [accountId, on]),
  setReportEmail: (accountId: string, on: boolean) =>
    q(`insert into account_settings(account_id, parent_report_email) values ($1,$2) on conflict (account_id) do update set parent_report_email = excluded.parent_report_email, updated_at = now()`, [accountId, on]),
};

export const users = {
  byEmail: (email: string) => maybe<{ id: string; email: string }>(`select id, email from users where lower(email) = lower($1)`, [email]),
  get: (id: string) => maybe<{ id: string; email: string; full_name: string | null; dodo_customer_id: string | null }>(`select id, email, full_name, dodo_customer_id from users where id = $1`, [id]),
  setDodoCustomer: (id: string, customerId: string) => q(`update users set dodo_customer_id = $2 where id = $1 and (dodo_customer_id is null or dodo_customer_id <> $2)`, [id, customerId]),
};

export const parentReports = {
  markSent: (studentId: string, date: string) => q(`update parent_reports set status = 'sent', sent_at = now() where student_id = $1 and report_date = $2`, [studentId, date]),
  markFailed: (studentId: string, date: string) => q(`update parent_reports set status = 'failed' where student_id = $1 and report_date = $2`, [studentId, date]),
  /** Students who answered at least one check question in the window and have no report for the date yet. */
  studentsDue: (start: Date, end: Date, date: string) =>
    q<{ student_id: string }>(
      `select distinct c.student_id from check_results c
        where c.student_id is not null and c.created_at >= $1 and c.created_at < $2
          and not exists (select 1 from parent_reports r where r.student_id = c.student_id and r.report_date = $3 and r.status = 'sent')`,
      [start, end, date],
    ),
  upsert: (input: { accountId: string; studentId: string; date: string; body: string }) =>
    q(
      `insert into parent_reports(account_id, student_id, report_date, body, status) values ($1,$2,$3,$4,'pending')
       on conflict (student_id, report_date) do update set body = excluded.body, status = 'pending'`,
      [input.accountId, input.studentId, input.date, input.body],
    ),
};

// ---------- billing ----------

export interface SubscriptionRow {
  id: string;
  account_id: string;
  plan_code: string;
  status: "active" | "past_due" | "cancelled" | "expired";
  period_start: string;
  period_end: string;
  cancel_at_period_end: boolean;
  provider: string;
  provider_subscription_id: string | null;
  next_credit_grant_at: string | null;
  grants_made: number;
  provider_status: string | null;
  cancelled_at: string | null;
}

export const subscriptions = {
  active: (accountId: string) => maybe<SubscriptionRow>(`select * from subscriptions where account_id = $1 and status in ('active','past_due') limit 1`, [accountId]),
  byProviderRef: (ref: string) => maybe<SubscriptionRow>(`select * from subscriptions where provider_subscription_id = $1`, [ref]),
  /** Provider-driven state changes. period_end moves with the provider's next billing date. */
  syncFromProvider: (id: string, input: { status: SubscriptionRow["status"]; providerStatus: string; periodEnd?: Date | null; cancelAtPeriodEnd?: boolean; cancelledAt?: Date | null; planCode?: string }) =>
    q(
      `update subscriptions set status = $2::subscription_status, provider_status = $3,
              period_end = coalesce($4, period_end), cancel_at_period_end = coalesce($5, cancel_at_period_end),
              cancelled_at = coalesce($6, cancelled_at), plan_code = coalesce($7, plan_code), updated_at = now()
        where id = $1`,
      [id, input.status, input.providerStatus, input.periodEnd ?? null, input.cancelAtPeriodEnd ?? null, input.cancelledAt ?? null, input.planCode ?? null],
    ),
  expire: (id: string) => q(`update subscriptions set status = 'expired' where id = $1`, [id]),
  create: (input: { accountId: string; planCode: string; periodStart: Date; periodEnd: Date; provider: string; providerRef: string }) =>
    one<SubscriptionRow>(
      `insert into subscriptions(account_id, plan_code, status, period_start, period_end, provider, provider_subscription_id, next_credit_grant_at, grants_made)
       values ($1,$2,'active',$3,$4,$5,$6,$3,0) returning *`,
      [input.accountId, input.planCode, input.periodStart, input.periodEnd, input.provider, input.providerRef],
    ),
  recordGrant: (id: string, grantsMade: number, nextAt: Date) => q(`update subscriptions set grants_made = $2, next_credit_grant_at = $3 where id = $1`, [id, grantsMade, nextAt]),
  dueForGrant: () => q<SubscriptionRow>(`select * from subscriptions where status = 'active' and next_credit_grant_at <= now() and period_end > now()`),
  expirePastDue: () => q(`update subscriptions set status = 'expired' where status = 'active' and period_end < now()`),
};

export interface PaymentRow {
  id: string;
  account_id: string;
  kind: "subscription" | "topup";
  item_code: string;
  amount_paise: number;
  gst_paise: number;
  total_paise: number;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  status: "created" | "paid" | "failed" | "refunded";
}

export const payments = {
  get: (id: string) => maybe<PaymentRow>(`select * from payments where id = $1`, [id]),
  getOwned: (id: string, accountId: string) => maybe<PaymentRow>(`select * from payments where id = $1 and account_id = $2`, [id, accountId]),
  byOrder: (orderId: string) => maybe<PaymentRow>(`select * from payments where provider_order_id = $1`, [orderId]),
  create: (input: { accountId: string; kind: "subscription" | "topup"; itemCode: string; amountPaise: number; gstPaise: number; totalPaise: number; provider: string }) =>
    one<PaymentRow>(
      `insert into payments(account_id, kind, item_code, amount_paise, gst_paise, total_paise, provider) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [input.accountId, input.kind, input.itemCode, input.amountPaise, input.gstPaise, input.totalPaise, input.provider],
    ),
  setOrder: (id: string, orderId: string) => q(`update payments set provider_order_id = $2 where id = $1`, [id, orderId]),
  markPaid: (id: string, providerPaymentId: string, raw?: unknown) =>
    q(`update payments set status = 'paid', provider_payment_id = $2, raw = $3 where id = $1 and status <> 'paid'`, [id, providerPaymentId, raw == null ? null : JSON.stringify(raw)]),
  setTotal: (id: string, totalPaise: number) => q(`update payments set total_paise = $2 where id = $1`, [id, totalPaise]),
  markFailed: (id: string, providerPaymentId: string, raw?: unknown) =>
    q(`update payments set status = 'failed', provider_payment_id = $2, raw = $3 where id = $1 and status = 'created'`, [id, providerPaymentId, raw == null ? null : JSON.stringify(raw)]),
  markFailedByOrder: (orderId: string, providerPaymentId: string) =>
    q(`update payments set status = 'failed', provider_payment_id = $2 where provider_order_id = $1 and status = 'created'`, [orderId, providerPaymentId]),
};

export const webhooks = {
  /** Returns the new row id, or null if this event was already recorded. */
  insert: async (provider: string, eventId: string, eventType: string, payload: unknown) => {
    const rows = await q<{ id: string }>(
      `insert into webhook_events(provider, event_id, event_type, payload) values ($1,$2,$3,$4) on conflict (provider, event_id) do nothing returning id`,
      [provider, eventId, eventType, JSON.stringify(payload)],
    );
    return rows[0]?.id ?? null;
  },
  processed: (id: string) => q(`update webhook_events set processed_at = now() where id = $1`, [id]),
  failed: (id: string, error: string) => q(`update webhook_events set error = $2 where id = $1`, [id, error.slice(0, 1000)]),
  remove: (id: string) => q(`delete from webhook_events where id = $1`, [id]),
};

// ---------- usage ----------

export const usage = {
  insertMany: async (
    rows: { accountId: string; explanationId: string; stage: string; model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costPaise: number; latencyMs: number }[],
  ) => {
    for (const r of rows) {
      await q(
        `insert into usage_events(account_id, explanation_id, stage, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_paise, latency_ms)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.accountId, r.explanationId, r.stage, r.model, r.inputTokens, r.outputTokens, r.cacheReadTokens, r.cacheWriteTokens, r.costPaise, r.latencyMs],
      );
    }
  },
};
