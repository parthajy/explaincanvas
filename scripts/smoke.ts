/**
 * End-to-end smoke test against a running dev server and the local Postgres.
 *
 *   pnpm smoke
 *   pnpm smoke "Explain photosynthesis for class 7"
 *
 * Creates a throwaway account and session directly in the database, posts a question through
 * POST /api/chat, and follows the explanation until it is ready or failed. Without a Claude
 * credential the pipeline fails at routing, which still proves the request path, the queue,
 * the in-process runner, the failure branch and the credit release. With a credential it
 * proves a full generation.
 */
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const question = process.argv[2] ?? "Explain Newton's third law with an example";
const pool = new Pool({ connectionString: process.env.DATABASE_URL!.replace(/[?&]sslmode=[^&]+/, "") });

async function main() {
  const email = `smoke-${Date.now()}@test.local`;
  const { rows: [u] } = await pool.query<{ id: string }>(`insert into users(email) values ($1) returning id`, [email]);
  await pool.query(`insert into account_settings(account_id) values ($1)`, [u.id]);
  await pool.query(`select credits_grant($1, 8, 'free', 'signup', $2, $3, null, 'one free diagram', 'grant')`, [u.id, u.id, `free-signup:${u.id}`]);
  await pool.query(`insert into students(account_id, name, class_level) values ($1, 'Smoke', 9)`, [u.id]);
  const sid = randomBytes(32).toString("hex");
  await pool.query(`insert into sessions(id, user_id, expires_at) values ($1, $2, now() + interval '1 day')`, [sid, u.id]);
  const cookie = `vz_session=${sid}`;
  console.log(`account ${u.id} (${email})`);

  const bal = async () => Number((await pool.query(`select credits_balance($1) as b`, [u.id])).rows[0].b);
  console.log(`balance before: ${await bal()}`);

  console.log("health:", await fetch(`${APP_URL}/api/health`).then((r) => r.json()));
  const me = await fetch(`${APP_URL}/api/me`, { headers: { cookie } }).then((r) => r.json());
  if (!me.id) throw new Error(`auth failed: ${JSON.stringify(me)}`);
  console.log(`me: plan=${me.plan.code} credits=${me.balance} students=${me.students.length}`);

  const requestId = `smoke-${Date.now()}`;
  const sinceIso = new Date(Date.now() - 1000).toISOString(); // subscribe from just before the POST so a fast terminal state is not missed
  const post = await fetch(`${APP_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ text: question, requestId, studentId: me.students[0]?.id }),
  });
  const body = await post.json();
  console.log(`POST /api/chat -> ${post.status}`, body);
  if (!post.ok) throw new Error("chat post failed");

  const replay = await fetch(`${APP_URL}/api/chat`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ text: question, requestId }) }).then((r) => r.json());
  if (replay.explanationId !== body.explanationId || !replay.replay) throw new Error("replay created a new explanation");
  console.log("replay ok (idempotent)");

  // Follow over SSE as the UI does.
  const sse = await fetch(`${APP_URL}/api/chats/${body.chatId}/events?since=${encodeURIComponent(sinceIso)}`, { headers: { cookie, accept: "text/event-stream" } });
  if (!sse.ok || !sse.body) throw new Error(`sse failed: ${sse.status}`);
  const reader = sse.body.getReader();
  const dec = new TextDecoder();
  const deadline = Date.now() + 480_000; // Opus teaching plus verification can take a few minutes
  let buf = "";
  let done = false;
  let finalStatus = "";
  while (!done && Date.now() < deadline) {
    const { value, done: d } = await reader.read();
    if (d) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.+)$/m.exec(frame)?.[1];
      if (!ev || !data) continue;
      const row = JSON.parse(data);
      if (ev === "explanation" && row.id === body.explanationId) {
        console.log(`  ${new Date().toISOString().slice(11, 19)} ${row.status}${row.format ? ` ${row.format}` : ""}${row.credits_quoted ? ` quoted=${row.credits_quoted}` : ""}`);
        if (row.status === "ready" || row.status === "failed") {
          finalStatus = row.status;
          if (row.error) console.log("error:", row.error);
          if (row.scene) console.log(`scene: ${row.scene.scenes.length} scene(s), format ${row.format}, check: "${row.scene.check.question}"`);
          done = true;
        }
      }
      if (ev === "chat") console.log(`  chat title -> ${row.title}`);
    }
  }
  await reader.cancel().catch(() => undefined);
  if (!finalStatus) throw new Error("timed out waiting for the explanation");

  const data = await fetch(`${APP_URL}/api/chats/${body.chatId}`, { headers: { cookie } }).then((r) => r.json());
  const asst = data.messages.find((m: { explanation_id: string | null; role: string }) => m.explanation_id === body.explanationId && m.role === "assistant");
  console.log(`assistant: ${asst?.content?.slice(0, 300)}`);

  const { rows: [job] } = await pool.query(`select status, attempts, last_error from jobs where idempotency_key = $1`, [`explanation:${body.explanationId}`]);
  console.log("job:", job);
  const { rows: ledger } = await pool.query(`select entry_type, amount, note from credit_ledger where account_id = $1 order by id`, [u.id]);
  console.log("ledger:", ledger);
  console.log(`balance after: ${await bal()}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("SMOKE FAILED:", err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
