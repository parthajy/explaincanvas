"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ChatSummary } from "@/lib/chat/types";
import { Logo, LogoMark } from "@/components/Logo";

function group(chats: ChatSummary[]) {
  const now = Date.now();
  const day = 86_400_000;
  const today: ChatSummary[] = [];
  const week: ChatSummary[] = [];
  const older: ChatSummary[] = [];
  for (const c of chats) {
    const age = now - new Date(c.last_message_at).getTime();
    if (age < day) today.push(c);
    else if (age < 7 * day) week.push(c);
    else older.push(c);
  }
  return [
    { label: "Today", items: today },
    { label: "Previous 7 days", items: week },
    { label: "Older", items: older },
  ].filter((g) => g.items.length > 0);
}

function NavItem({ href, label, icon, onClick, active }: { href: string; label: string; icon: string; onClick?: () => void; active?: boolean }) {
  return (
    <Link href={href} onClick={onClick} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] ${active ? "bg-panel-2 text-text" : "text-text hover:bg-panel-2"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden>
        <path d={icon} />
      </svg>
      {label}
    </Link>
  );
}

export function Sidebar({ refreshKey, open, onClose, collapsed, onToggleCollapse }: { refreshKey?: number; open?: boolean; onClose?: () => void; collapsed?: boolean; onToggleCollapse?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/chats${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setChats(data.chats);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [q, refreshKey, pathname]);

  const groups = useMemo(() => group(chats), [chats]);

  async function toggleStar(c: ChatSummary) {
    setChats((prev) => prev.map((x) => (x.id === c.id ? { ...x, starred: !x.starred } : x)));
    await fetch(`/api/chats/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: !c.starred }) });
  }
  async function rename(c: ChatSummary) {
    setMenuFor(null);
    const title = window.prompt("Rename chat", c.title)?.trim();
    if (!title || title === c.title) return;
    setChats((prev) => prev.map((x) => (x.id === c.id ? { ...x, title } : x)));
    await fetch(`/api/chats/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
  }
  async function remove(c: ChatSummary) {
    setMenuFor(null);
    if (!window.confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    setChats((prev) => prev.filter((x) => x.id !== c.id));
    await fetch(`/api/chats/${c.id}`, { method: "DELETE" });
    if (pathname === `/c/${c.id}`) router.replace("/");
  }

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Logo />
        <div className="flex items-center gap-1">
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} className="hidden rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-text md:block" aria-label="Collapse sidebar" title="Collapse sidebar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="M9 4v16" />
              </svg>
            </button>
          )}
          <button onClick={() => setSearching((s) => !s)} className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-text" aria-label="Search chats">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          {onClose && (
            <button onClick={onClose} className="rounded-lg p-2 text-muted md:hidden" aria-label="Close menu">
              ✕
            </button>
          )}
        </div>
      </div>

      {searching && (
        <div className="px-3 pb-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-border-2" />
        </div>
      )}

      <nav className="space-y-0.5 px-3 pt-1">
        <NavItem href="/" label="New chat" icon="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" onClick={onClose} active={pathname === "/"} />
        <NavItem href="/library" label="Library" icon="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" onClick={onClose} />
        <NavItem href="/account" label="Progress" icon="M3 3v18h18M7 14l4-4 4 4 5-6" onClick={onClose} active={pathname === "/account"} />
      </nav>

      <div className="scrollbar-thin mt-4 flex-1 overflow-y-auto px-3 pb-3" onClick={() => menuFor && setMenuFor(null)}>
        {groups.length === 0 && <p className="px-3 pt-4 text-[13px] text-faint">Your chats will appear here.</p>}
        {groups.map((g) => (
          <div key={g.label} className="mb-4">
            <div className="px-3 pb-1 text-[12px] font-medium text-faint">{g.label}</div>
            {g.items.map((c) => {
              const active = pathname === `/c/${c.id}`;
              return (
                <div key={c.id} className={`group relative flex items-center rounded-xl ${active ? "bg-panel-2" : "hover:bg-panel-2"}`}>
                  <Link href={`/c/${c.id}`} onClick={onClose} className="min-w-0 flex-1 truncate px-3 py-2 text-[14px]">
                    {c.starred && <span className="mr-1.5 text-faint">★</span>}
                    {c.title}
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor(menuFor === c.id ? null : c.id);
                    }}
                    aria-label="Chat options"
                    className="mr-1 rounded-lg p-1.5 text-faint opacity-0 group-hover:opacity-100 hover:text-text"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                  {menuFor === c.id && (
                    <div className="absolute right-2 top-9 z-10 w-36 overflow-hidden rounded-xl border border-border bg-panel text-sm shadow-(--shadow)">
                      <button onClick={() => void toggleStar(c)} className="block w-full px-3 py-2 text-left hover:bg-panel-2">
                        {c.starred ? "Unpin" : "Pin"}
                      </button>
                      <button onClick={() => void rename(c)} className="block w-full px-3 py-2 text-left hover:bg-panel-2">
                        Rename
                      </button>
                      <button onClick={() => void remove(c)} className="block w-full px-3 py-2 text-left text-danger hover:bg-panel-2">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  const rail = (
    <div className="flex h-full flex-col items-center gap-1 py-4">
      <Link href="/" className="mb-2" aria-label="ExplainCanvas home">
        <LogoMark size={26} />
      </Link>
      <button onClick={onToggleCollapse} className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-text" aria-label="Expand sidebar" title="Expand sidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M9 4v16" />
        </svg>
      </button>
      <Link href="/" className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-text" aria-label="New chat" title="New chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </Link>
      <Link href="/library" className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-text" aria-label="Library" title="Library">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
        </svg>
      </Link>
      <Link href="/account" className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-text" aria-label="Progress" title="Progress">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 3v18h18M7 14l4-4 4 4 5-6" />
        </svg>
      </Link>
    </div>
  );

  return (
    <>
      <aside className={`hidden h-full shrink-0 border-r border-border bg-bg-2 transition-[width] duration-200 md:block ${collapsed ? "w-[60px]" : "w-[272px]"}`}>{collapsed ? rail : body}</aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-bg-2 shadow-2xl">{body}</aside>
        </div>
      )}
    </>
  );
}
