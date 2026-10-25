/**
 * Lifecycle email templates. Plain HTML, system font, black button: the same monochrome voice as the product.
 * Every template returns subject + html + text so the text part is never an afterthought.
 */

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function layout(input: { appUrl: string; eyebrow: string; heading: string; body: string; cta?: { label: string; href: string }; footer?: string; unsubscribeUrl?: string | null }): string {
  const { appUrl, eyebrow, heading, body, cta, footer, unsubscribeUrl } = input;
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111113">
<div style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:20px;padding:34px 32px">
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#71717a">${esc(eyebrow)}</div>
  <h1 style="margin:10px 0 16px;font-size:24px;line-height:1.25;letter-spacing:-.02em">${esc(heading)}</h1>
  <div style="font-size:15px;line-height:1.6;color:#27272a">${body}</div>
  ${cta ? `<div style="margin:26px 0 6px"><a href="${cta.href}" style="display:inline-block;background:#111113;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">${esc(cta.label)}</a></div>` : ""}
  ${footer ? `<p style="margin:22px 0 0;font-size:13px;color:#71717a;line-height:1.5">${footer}</p>` : ""}
</div>
<div style="max-width:540px;margin:14px auto 0;text-align:center;font-size:12px;color:#a1a1aa;line-height:1.6">
  <a href="${appUrl}" style="color:#71717a;text-decoration:none;font-weight:600">ExplainCanvas</a> · Type anything you are stuck on. Understand it visually.
  ${unsubscribeUrl ? `<br><a href="${unsubscribeUrl}" style="color:#a1a1aa">Stop these tips and offers</a>` : ""}
</div>
</body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;
const first = (name: string | null | undefined) => (name ? name.trim().split(/\s+/)[0] : null);

export function welcome(i: { appUrl: string; name?: string | null; unsubscribeUrl: string }): Mail {
  const hi = first(i.name) ? `Hi ${esc(first(i.name)!)},` : "Hi,";
  const body =
    p(hi) +
    p("Welcome to ExplainCanvas. Here is the whole idea in one line: type what you are stuck on, any subject, any level, and the explanation arrives as a picture, steps, slides, an animation or a 3D model, with one quick check question at the end.") +
    p("Three things worth trying today:") +
    `<ol style="margin:0 0 12px 20px;padding:0;line-height:1.7">
      <li><strong>Ask a real doubt.</strong> “Why don't action and reaction forces cancel out?” works better than “Newton's third law”.</li>
      <li><strong>Photograph the textbook.</strong> Tap the camera in the box and point it at the question.</li>
      <li><strong>Set the level</strong> in Account, yours or your child's, from Class 6 to PhD, so every explanation is pitched right.</li>
    </ol>` +
    p("You get free explanations every day, and the library of validated explanations is open to everyone.");
  return {
    subject: "Welcome to ExplainCanvas. Here is how to get the most from it",
    html: layout({ appUrl: i.appUrl, eyebrow: "Welcome", heading: "Understanding, drawn out", body, cta: { label: "Ask your first question", href: `${i.appUrl}/` }, footer: "Reply to this email any time. A person reads it.", unsubscribeUrl: i.unsubscribeUrl }),
    text: `Welcome to ExplainCanvas.\n\nYour child types what they are stuck on and gets a picture, steps, slides, an animation or a 3D model with one check question.\n\nTry today:\n1. Ask a real doubt, like "Why don't action and reaction forces cancel out?"\n2. Photograph the textbook question with the camera button.\n3. Set the level in Account, yours or your child's.\n\nStart: ${i.appUrl}/\n\nStop tips and offers: ${i.unsubscribeUrl}`,
  };
}

const NURTURE: { eyebrow: string; subject: string; heading: string; paras: string[]; cta: { label: string; path: string } }[] = [
  {
    eyebrow: "Day 3",
    subject: "The trick is asking “why”",
    heading: "Hope the first few explanations landed",
    paras: [
      "A small habit makes a big difference: ask <strong>why</strong>, not <strong>what</strong>. “What is photosynthesis” gets a definition. “Why do leaves need sunlight” gets a mechanism, and that is what sticks before an exam.",
      "After every explanation you will see three <strong>Keep going</strong> questions. One tap takes the idea one step deeper. Five minutes of that beats an hour of rereading.",
    ],
    cta: { label: "Ask a why question", path: "/" },
  },
  {
    eyebrow: "Day 6",
    subject: "What the check question is really for",
    heading: "Three things you may not have noticed",
    paras: [
      "<strong>The check question</strong> at the end of each explanation is not a test. It is how we know the explanation worked. Answer it, and the concept counts as understood in your daily report.",
      "<strong>The library</strong> holds every explanation that has already been validated. Browsing it by class and subject is free and does not use credits.",
      "<strong>Fullscreen</strong> any diagram, animation or 3D model with the expand button, and share it with a friend using Share.",
    ],
    cta: { label: "Browse the library", path: "/library" },
  },
  {
    eyebrow: "Day 9",
    subject: "A streak is worth free credits",
    heading: "Small days add up",
    paras: [
      "Every day your child answers a check question correctly extends their <strong>streak</strong>, and streaks earn free credits. The streak shows on the Account page next to each student.",
      "Stuck on something right now? Photograph the page. The question goes straight into the chat box, no typing needed.",
      "If credits are running low, plans start at ₹599 a month and top-ups never expire within the month.",
    ],
    cta: { label: "See plans", path: "/pricing" },
  },
];

export function nurture(step: number, i: { appUrl: string; name?: string | null; unsubscribeUrl: string }): Mail {
  const t = NURTURE[Math.min(step, NURTURE.length - 1)];
  const hi = first(i.name) ? `Hi ${esc(first(i.name)!)},` : "Hi,";
  const body = p(hi) + t.paras.map(p).join("");
  return {
    subject: t.subject,
    html: layout({ appUrl: i.appUrl, eyebrow: t.eyebrow, heading: t.heading, body, cta: { label: t.cta.label, href: `${i.appUrl}${t.cta.path}` }, unsubscribeUrl: i.unsubscribeUrl }),
    text: `${t.heading}\n\n${t.paras.map((x) => x.replace(/<[^>]+>/g, "")).join("\n\n")}\n\n${t.cta.label}: ${i.appUrl}${t.cta.path}\n\nStop tips and offers: ${i.unsubscribeUrl}`,
  };
}

export function winback(i: { appUrl: string; name?: string | null; credits: number; claimUrl: string; expiresInDays: number; unsubscribeUrl: string }): Mail {
  const hi = first(i.name) ? `Hi ${esc(first(i.name)!)},` : "Hi,";
  const body =
    p(hi) +
    p(`It has been a little while. We added <strong>${i.credits} free credits</strong> to your account. That is enough for several full explanations with narration, in whatever format fits the question.`) +
    p(`Tap the button to claim them. The offer is open for ${i.expiresInDays} days.`) +
    p("One question to start with: whatever your child got wrong in their last test.");
  return {
    subject: `${i.credits} free credits are waiting for you`,
    html: layout({ appUrl: i.appUrl, eyebrow: "A gift", heading: `${i.credits} credits, on us`, body, cta: { label: `Claim ${i.credits} credits`, href: i.claimUrl }, footer: "The credits are added when you tap claim and are yours for 30 days.", unsubscribeUrl: i.unsubscribeUrl }),
    text: `${i.credits} free credits are waiting for you.\n\nClaim them here (open for ${i.expiresInDays} days): ${i.claimUrl}\n\nStop tips and offers: ${i.unsubscribeUrl}`,
  };
}

export function streakAtRisk(i: { appUrl: string; studentName: string; days: number }): Mail {
  const body =
    p(`${esc(i.studentName)} has a <strong>${i.days}-day streak</strong> going and has not answered a check question yet today.`) +
    p("One short explanation and its check question keeps it alive. Any topic from today's homework will do.");
  return {
    subject: `${i.studentName}'s ${i.days}-day streak ends tonight`,
    html: layout({ appUrl: i.appUrl, eyebrow: "Streak", heading: `Keep the ${i.days}-day streak alive`, body, cta: { label: "Ask one question", href: `${i.appUrl}/` }, footer: `Turn streak reminders off with the daily report switch in <a href="${i.appUrl}/account" style="color:#71717a">Account</a>.` }),
    text: `${i.studentName} has a ${i.days}-day streak and has not answered a check question today. One question keeps it alive: ${i.appUrl}/`,
  };
}

export interface WeeklyStudent {
  name: string;
  asked: number;
  askedLastWeek: number;
  understood: string[];
  struggled: string[];
  weakChapters: { label: string; fails: number }[];
  streak: number;
}

/** The Sunday recap: what landed, what did not, which chapters to revisit, and what to ask next. */
export function weeklyRecap(i: { appUrl: string; name?: string | null; students: WeeklyStudent[]; suggestions: { title: string; url: string }[] }): Mail {
  const hi = first(i.name) ? `Hi ${esc(first(i.name)!)},` : "Hi,";
  const list = (items: string[]) => `<ul style="margin:4px 0 0 18px;padding:0;line-height:1.6">${items.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const blocks = i.students
    .map((s) => {
      const delta = s.asked - s.askedLastWeek;
      const trend = s.askedLastWeek === 0 ? "" : delta > 0 ? ` (up ${delta} on last week)` : delta < 0 ? ` (down ${-delta} on last week)` : " (same as last week)";
      return `<div style="margin:0 0 16px;padding:16px 18px;border:1px solid #e4e4e7;border-radius:14px">
        <div style="font-weight:600;font-size:17px">${esc(s.name)}</div>
        <div style="font-size:14px;color:#52525b;margin-top:4px">${s.asked} explanation${s.asked === 1 ? "" : "s"}${trend} · ${s.understood.length} understood${s.streak > 0 ? ` · ${s.streak}-day streak` : ""}</div>
        ${s.understood.length ? `<div style="font-size:14px;margin-top:12px"><strong>Now understands</strong>${list(s.understood)}</div>` : ""}
        ${s.struggled.length ? `<div style="font-size:14px;margin-top:12px"><strong>Struggled with</strong>${list(s.struggled)}</div>` : ""}
        ${s.weakChapters.length ? `<div style="font-size:14px;margin-top:12px"><strong>Chapters to revisit</strong>${list(s.weakChapters.map((w) => `${w.label} (${w.fails} missed check${w.fails === 1 ? "" : "s"})`))}</div>` : ""}
        ${s.asked === 0 ? `<div style="font-size:14px;margin-top:10px;color:#71717a">No questions this week. One real doubt a day is the habit that works.</div>` : ""}
      </div>`;
    })
    .join("");
  const sugg = i.suggestions.length ? `<p style="margin:16px 0 4px"><strong>Worth asking this week</strong></p><ul style="margin:0 0 12px 18px;padding:0;line-height:1.7">${i.suggestions.map((s) => `<li><a href="${s.url}" style="color:#111113">${esc(s.title)}</a></li>`).join("")}</ul>` : "";
  const totalAsked = i.students.reduce((a, s) => a + s.asked, 0);
  const totalUnderstood = i.students.reduce((a, s) => a + s.understood.length, 0);
  const totalStruggled = i.students.reduce((a, s) => a + s.struggled.length, 0);
  return {
    subject: `This week: ${totalUnderstood} understood${totalStruggled ? `, ${totalStruggled} to revisit` : ""} (${totalAsked} explanation${totalAsked === 1 ? "" : "s"})`,
    html: layout({ appUrl: i.appUrl, eyebrow: "Weekly recap", heading: "How the week went", body: p(hi) + blocks + sugg, cta: { label: "Open ExplainCanvas", href: `${i.appUrl}/` }, footer: `Understood means the check question was answered correctly. Struggled means it was missed and not yet retried successfully. Weekly recaps follow the daily report switch in <a href="${i.appUrl}/account" style="color:#71717a">Account</a>.` }),
    text: `How the week went\n\n${i.students
      .map((s) => `${s.name}: ${s.asked} explanations, ${s.understood.length} understood${s.streak ? `, ${s.streak}-day streak` : ""}${s.understood.length ? `\n  Now understands: ${s.understood.join(", ")}` : ""}${s.struggled.length ? `\n  Struggled with: ${s.struggled.join(", ")}` : ""}${s.weakChapters.length ? `\n  Chapters to revisit: ${s.weakChapters.map((w) => w.label).join(", ")}` : ""}`)
      .join("\n")}\n\n${i.suggestions.map((s) => `${s.title}: ${s.url}`).join("\n")}\n\n${i.appUrl}/`,
  };
}

/** Two quiet days: a short, warm nudge with one concrete question to ask. */
export function nudge(i: { appUrl: string; studentName: string; quietDays: number; suggestion: { title: string; url: string } | null; weakChapter: string | null }): Mail {
  const body =
    p(`${esc(i.studentName)} has not asked anything for ${i.quietDays} days. That is normal, and one five-minute session brings it back.`) +
    (i.weakChapter ? p(`The last chapter that gave trouble was <strong>${esc(i.weakChapter)}</strong>. One question from it tonight would be a good place to start.`) : "") +
    (i.suggestion ? p(`Try this one: <a href="${i.suggestion.url}" style="color:#111113;font-weight:600">${esc(i.suggestion.title)}</a>`) : p("Anything from today's homework will do."));
  return {
    subject: `${i.studentName}: one question tonight?`,
    html: layout({ appUrl: i.appUrl, eyebrow: "Daily check-in", heading: `A quiet ${i.quietDays} days`, body, cta: { label: "Open ExplainCanvas", href: `${i.appUrl}/` }, footer: `These check-ins follow the daily report switch in <a href="${i.appUrl}/account" style="color:#71717a">Account</a>.` }),
    text: `${i.studentName} has not asked anything for ${i.quietDays} days.${i.weakChapter ? ` Last tricky chapter: ${i.weakChapter}.` : ""}${i.suggestion ? ` Try: ${i.suggestion.title} ${i.suggestion.url}` : ""}\n\n${i.appUrl}/`,
  };
}
