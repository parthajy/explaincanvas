import { getSessionUserById, SESSION_COOKIE } from "@/lib/auth/session";
import { chats, explanations, messages } from "@/lib/repo";

/**
 * GET /api/chats/:chatId/events — Server-Sent Events.
 * Streams rows that changed since the connection opened (or since ?since=ISO). The pipeline and
 * follow-up streaming write to Postgres; this route polls those rows once a second while the tab
 * is open, so a dropped connection or a reload picks up exactly where it left off.
 */
export const dynamic = "force-dynamic";

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function GET(req: Request, ctx: { params: Promise<{ chatId: string }> }): Promise<Response> {
  const { chatId } = await ctx.params;
  const sessionId = cookieValue(req.headers.get("cookie"), SESSION_COOKIE);
  const user = sessionId && /^[a-f0-9]{64}$/.test(sessionId) ? await getSessionUserById(sessionId) : null;
  if (!user) return new Response("unauthenticated", { status: 401 });
  if (!(await chats.get(chatId, user.id))) return new Response("not found", { status: 404 });

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  let since = sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? new Date(sinceParam) : new Date(Date.now() - 2000);

  const encoder = new TextEncoder();
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("hello", { since: since.toISOString() });
      let ticks = 0;

      const tick = async () => {
        if (closed) return;
        try {
          const cutoff = since;
          const now = new Date();
          const [msgs, exs, chat] = await Promise.all([messages.changedSince(chatId, cutoff), explanations.changedSince(chatId, cutoff), chats.getAny(chatId)]);
          for (const m of msgs) send("message", { id: m.id, role: m.role, content: m.content, attachments: m.attachments, explanation_id: m.explanation_id, seq: m.seq, created_at: m.created_at, updated_at: m.updated_at });
          for (const ex of exs) send("explanation", ex);
          if (chat && new Date(chat.updated_at) > cutoff) send("chat", { id: chat.id, title: chat.title, starred: chat.starred });
          // Advance to the newest change we saw, never past "now" minus a safety margin for in-flight commits.
          const newest = [...msgs.map((m) => m.updated_at), ...exs.map((e) => e.updated_at)].map((t) => new Date(t).getTime());
          since = new Date(Math.max(cutoff.getTime(), ...(newest.length ? newest : [0]), now.getTime() - 1500));
          if (++ticks % 15 === 0) controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : "poll failed" });
        }
        if (!closed) timer = setTimeout(tick, 1000);
      };
      void tick();
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });

  req.signal.addEventListener("abort", () => {
    closed = true;
    if (timer) clearTimeout(timer);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
