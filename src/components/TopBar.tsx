"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Me } from "@/lib/chat/types";
import { ThemeToggle } from "@/components/ThemeToggle";

export function TopBar({ title, refreshKey, onMenu }: { title?: string; refreshKey?: number; onMenu?: () => void }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

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

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {onMenu && (
          <button onClick={onMenu} className="mr-1 rounded-lg p-2 text-muted hover:bg-panel-2 md:hidden" aria-label="Open menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        )}
        <span className="truncate font-medium text-text">{title ?? ""}</span>
      </div>
      <div className="flex items-center gap-2">
        {me && (
          <Link href="/pricing" className="hidden h-9 items-center rounded-full border border-border px-3 text-xs text-muted hover:text-text sm:flex" title="Credits">
            <span className="tabular font-medium text-text">{me.balance}</span>&nbsp;credits · {me.plan.name}
          </Link>
        )}
        <ThemeToggle className="hidden sm:flex" />
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} className="flex h-9 w-9 items-center justify-center rounded-full bg-panel-2 text-sm font-medium text-text" aria-label="Account">
            {(me?.students[0]?.name ?? me?.email ?? "?").slice(0, 1).toUpperCase()}
          </button>
          {open && (
            <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-panel text-sm shadow-(--shadow)">
              <div className="truncate px-4 py-2.5 text-xs text-muted">{me?.email}</div>
              <Link href="/account" className="block px-4 py-2 hover:bg-panel-2" onClick={() => setOpen(false)}>
                Account and students
              </Link>
              <Link href="/pricing" className="block px-4 py-2 hover:bg-panel-2" onClick={() => setOpen(false)}>
                Plans and credits
              </Link>
              {me?.isAdmin && (
                <Link href="/admin" className="block px-4 py-2 hover:bg-panel-2" onClick={() => setOpen(false)}>
                  Admin dashboard
                </Link>
              )}
              <div className="px-4 py-2 sm:hidden">
                <ThemeToggle />
              </div>
              <button onClick={() => void signOut()} className="block w-full px-4 py-2 text-left hover:bg-panel-2">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
