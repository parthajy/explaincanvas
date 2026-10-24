"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { Composer, type Attachment } from "@/components/Composer";
import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { LogoMark } from "@/components/Logo";
import { type ExplanationRow, type MessageRow, type Me } from "@/lib/chat/types";
import { GenerationFeed } from "@/components/GenerationFeed";

const SUGGESTIONS: Record<string, string[]> = {
  default: ["Why don't action and reaction forces cancel out?", "How does a plant make its food?", "Show me the parts of the heart in 3D", "How do the Moon's phases change over a month?"],
  "6": ["Why do we see different phases of the Moon?", "How does a shadow form?", "What is the difference between a mixture and a solution?", "Show me how a simple electric circuit works"],
  "7": ["How does a plant make its food?", "Why do acids and bases neutralise each other?", "How does heat travel through a metal spoon?", "Show me how the heart pumps blood"],
  "8": ["Why does a ball keep rolling after I stop pushing it?", "How does a cell divide?", "Why do we see a rainbow?", "Show me how a pinhole camera works"],
  "9": ["Why don't action and reaction forces cancel out?", "Why does sound need a medium to travel?", "Show me the parts of a plant cell in 3D", "How does the Pythagoras theorem work?"],
  "10": ["How does light bend when it enters water?", "Why does a lemon battery work?", "Show me how the human eye focuses", "What is the difference between speed and velocity?"],
  "11": ["Show me projectile motion as an animation", "Why does entropy always increase?", "Walk me through a limit from first principles", "Show me the structure of benzene in 3D"],
  "12": ["Show me how a p-n junction works", "Why does integration give area?", "Show me how DNA replicates step by step", "What does the Hall effect look like?"],
  higher: ["Give me an intuition for the Fourier transform", "Show me gradient descent step by step on a 2D surface", "Why does a PID controller overshoot?", "Show me how an action potential propagates"],
};

export function ChatView({ chatId }: { chatId: string | null }) {
  const router = useRouter();
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [explanations, setExplanations] = useState<Record<string, ExplanationRow>>({});
  const [me, setMe] = useState<Me | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastScrollKey = useRef<string>("");
  const studentId = me?.students[0]?.id;

  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && d && setMe(d))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("ec-sidebar");
    } catch {
      /* ignore */
    }
    if (saved === "collapsed") queueMicrotask(() => setCollapsed(true));
  }, []);
  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ec-sidebar", c ? "open" : "collapsed");
      } catch {
        /* ignore */
      }
      return !c;
    });
  }, []);

  const bySeq = (a: MessageRow, b: MessageRow) => Number(a.seq ?? 0) - Number(b.seq ?? 0) || a.created_at.localeCompare(b.created_at);

  const applyChat = useCallback((data: { chat: { title: string }; messages: MessageRow[]; explanations: ExplanationRow[] }) => {
    setTitle(data.chat.title);
    setMessages([...data.messages].sort(bySeq));
    setExplanations(Object.fromEntries(data.explanations.map((e) => [e.id, e])));
  }, []);

  const load = useCallback(async () => {
    if (!chatId) return;
    const res = await fetch(`/api/chats/${chatId}`, { cache: "no-store" });
    if (!res.ok) {
      router.replace("/");
      return;
    }
    applyChat(await res.json());
  }, [chatId, router, applyChat]);

  useEffect(() => {
    if (!chatId) return;
    let active = true;
    fetch(`/api/chats/${chatId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          router.replace("/");
          return;
        }
        applyChat(await res.json());
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [chatId, router, applyChat]);

  useEffect(() => {
    if (!chatId) return;
    const since = new Date(Date.now() - 10_000).toISOString();
    const es = new EventSource(`/api/chats/${chatId}/events?since=${encodeURIComponent(since)}`);
    es.addEventListener("message", (ev) => {
      const row = JSON.parse((ev as MessageEvent).data) as MessageRow;
      setMessages((prev) => {
        const existing = prev.find((m) => m.id === row.id);
        if (existing && existing.updated_at === row.updated_at && existing.content === row.content) return prev;
        const next = existing ? prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)) : [...prev, row];
        return next.sort(bySeq);
      });
    });
    es.addEventListener("explanation", (ev) => {
      const row = JSON.parse((ev as MessageEvent).data) as ExplanationRow;
      setExplanations((prev) => {
        const existing = prev[row.id];
        if (existing && existing.status === row.status && existing.updated_at === row.updated_at) return prev;
        return { ...prev, [row.id]: { ...existing, ...row } };
      });
      if (row.status === "ready" || row.status === "failed") setRefreshKey((k) => k + 1);
    });
    es.addEventListener("chat", (ev) => {
      const row = JSON.parse((ev as MessageEvent).data) as { title?: string };
      if (row.title) setTitle(row.title);
    });
    let first = true;
    es.onopen = () => {
      if (first) {
        first = false;
        return;
      }
      void load();
    };
    return () => es.close();
  }, [chatId, load]);

  useEffect(() => {
    const readyCount = Object.values(explanations).filter((e) => e.status === "ready").length;
    const key = `${messages.length}:${readyCount}`;
    if (key === lastScrollKey.current) return;
    const first = lastScrollKey.current === "";
    lastScrollKey.current = key;
    const el = scrollerRef.current;
    const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (first || nearBottom) bottomRef.current?.scrollIntoView({ behavior: first ? "auto" : "smooth", block: "end" });
  }, [messages, explanations]);

  // Explanation language. Remembered per device; sent with every message.
  const [language, setLanguage] = useState<"english" | "hinglish">("english");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ec-language");
      if (saved === "hinglish") setTimeout(() => setLanguage("hinglish"), 0);
    } catch {}
  }, []);
  const changeLanguage = useCallback((l: "english" | "hinglish") => {
    setLanguage(l);
    try {
      localStorage.setItem("ec-language", l);
    } catch {}
  }, []);
  const optionsOf = (m: MessageRow): string[] => {
    const o = (m.attachments ?? []).find((a) => a.type === "options") as { type: "options"; items: string[] } | undefined;
    return o?.items ?? [];
  };
  const imagesBefore = (m: MessageRow): Attachment[] => {
    const i = messages.findIndex((x) => x.id === m.id);
    for (let k = i - 1; k >= 0; k--) {
      const u = messages[k];
      if (u.role === "user") return (u.attachments ?? []).filter((a) => a.type === "image") as Attachment[];
    }
    return [];
  };

  const send = useCallback(
    async (text: string, attachments: Attachment[], reexplain?: { explanationId: string; reason: string }, languageOverride?: "english" | "hinglish") => {
      setError(null);
      setSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: chatId ?? undefined,
            studentId,
            text,
            attachments: attachments.map(({ type, path, mediaType }) => ({ type, path, mediaType })),
            requestId: nanoid(21),
            reexplain,
            language: languageOverride ?? language,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.message ?? "Could not send that. Please try again.");
          return;
        }
        const data = await res.json();
        if (!chatId) router.push(`/c/${data.chatId}`);
        else {
          await load();
          setRefreshKey((k) => k + 1);
        }
      } finally {
        setSending(false);
      }
    },
    [chatId, load, router, studentId, language],
  );

  // "?q=" from a marketing page: pre-fill the composer once, then clean the URL.
  const [prefill, setPrefill] = useState<string | undefined>(undefined);
  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("q");
    if (!q) return;
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.pathname + url.search);
    const t = setTimeout(() => setPrefill(q.slice(0, 500)), 0);
    return () => clearTimeout(t);
  }, []);

  const classLevel = me?.students[0]?.class_level;
  const suggestions = SUGGESTIONS[String(classLevel ?? "")] ?? (classLevel && classLevel >= 13 ? SUGGESTIONS.higher : SUGGESTIONS.default);

  // Keyboard: "/" focuses the composer, Cmd/Ctrl+K starts a new chat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/");
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const pending = useMemo(() => Object.values(explanations).some((e) => !["ready", "failed", "cancelled"].includes(e.status)), [explanations]);
  const firstName = me?.students[0]?.name;

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <Sidebar refreshKey={refreshKey} open={menuOpen} onClose={() => setMenuOpen(false)} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar title={chatId ? title : undefined} refreshKey={refreshKey} onMenu={() => setMenuOpen(true)} />

        {!chatId ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
            <div className="rise w-full max-w-[720px]">
              <h1 className="text-center text-[30px] font-medium tracking-tight md:text-[34px]">{firstName ? `Ready when you are, ${firstName}.` : "Ready when you are."}</h1>
              <div className="mt-8">
                <Composer key={prefill ?? "blank"} autoFocus initialText={prefill} disabled={sending} onSend={(t, a) => send(t, a)} language={language} onLanguageChange={changeLanguage} />
              </div>
              {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => void send(s, [])} disabled={sending} className="rounded-full border border-border px-3.5 py-1.5 text-[13px] text-muted hover:border-border-2 hover:text-text disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollerRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-40 pt-2 md:px-8">
              <div className="mx-auto flex max-w-[760px] flex-col gap-7">
                {messages.map((m) => {
                  if (m.role === "user") {
                    return (
                      <div key={m.id} className="rise flex justify-end">
                        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-panel-2 px-4 py-2.5 text-[16px] leading-relaxed">
                          {(m.attachments ?? []).some((a) => a.type === "image") && <div className="mb-1 text-xs text-muted">Photo attached</div>}
                          {m.content}
                        </div>
                      </div>
                    );
                  }
                  const ex = m.explanation_id ? explanations[m.explanation_id] : undefined;
                  const working = ex && !["ready", "failed", "cancelled"].includes(ex.status);
                  const userTurn = [...messages].reverse().find((u) => u.role === "user" && Number(u.seq ?? 0) < Number(m.seq ?? 0));
                  const uploadPath = userTurn?.attachments?.find((a) => a.type === "image")?.path;
                  const uploadUrl = uploadPath ? `/api/files/${uploadPath}` : null;
                  return (
                    <div key={m.id} className="rise flex gap-3">
                      <span className="mt-1 shrink-0">
                        <LogoMark size={26} />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        {working ? (
                          <GenerationFeed ex={ex} />
                        ) : (
                          <p className="whitespace-pre-wrap text-[16px] leading-7">{m.content || (ex?.status === "failed" ? "Something went wrong." : "")}</p>
                        )}
                        {optionsOf(m).length > 0 && (
                          <div className="mt-3 flex flex-col items-start gap-2">
                            {optionsOf(m).map((o) => (
                              <button key={o} disabled={sending} onClick={() => void send(o, imagesBefore(m))} className="max-w-full rounded-2xl border border-border px-3.5 py-2 text-left text-[14px] leading-snug hover:border-border-2 hover:bg-panel disabled:opacity-50">
                                {o}
                              </button>
                            ))}
                          </div>
                        )}
                        {ex?.status === "ready" && ex.scene && (
                          <Player explanationId={ex.id} doc={ex.scene} uploadUrl={uploadUrl} onAsk={(t) => send(t, [])} onSimpler={() => send("Explain it again in simpler words, with an everyday example.", [], { explanationId: ex.id, reason: "Simpler words please" })} onHinglish={() => send("Explain this again in Hinglish.", [], { explanationId: ex.id, reason: "Explain in Hinglish" }, "hinglish")} onReexplain={(reason) => send(`I didn't get it: ${reason.toLowerCase()}. Please explain it differently.`, [], { explanationId: ex.id, reason })} />
                        )}
                        {ex?.status === "ready" && (
                          <div className="mt-3 text-xs text-faint">
                            {ex.source === "library" ? "From the library · 1 credit" : ex.source === "generated" ? `Made for you · ${ex.credits_charged ?? ex.credits_quoted} credits · checked for accuracy` : ex.credits_charged ? `${ex.credits_charged} credits` : ""}
                          </div>
                        )}
                        {ex?.status === "failed" && (ex.error?.code === "insufficient_credits" || ex.error?.code === "insufficient_credits_free") && (
                          <a href="/pricing" className="mt-2 inline-block text-sm font-medium underline underline-offset-4">
                            {ex.error?.code === "insufficient_credits_free" ? "See plans" : "Add credits"}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-bg via-bg/95 to-transparent px-4 pb-4 pt-10 md:px-8">
              <div className="pointer-events-auto mx-auto max-w-[760px]">
                <Composer compact disabled={pending || sending} onSend={(t, a) => send(t, a)} language={language} onLanguageChange={changeLanguage} />
                {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
                <p className="mt-2 text-center text-[11px] text-faint">Explanations are checked for accuracy. Still, verify important facts with your textbook.</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
