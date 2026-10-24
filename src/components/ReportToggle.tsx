"use client";

import { useState, type ReactNode } from "react";

export function ReportToggle({ on, email, field = "parentReportEmail", title, description }: { on: boolean; email: string; field?: "parentReportEmail" | "marketingEmail"; title?: string; description?: ReactNode }) {
  const [enabled, setEnabled] = useState(on);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !enabled;
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: next }) });
    setBusy(false);
    if (res.ok) setEnabled(next);
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-panel p-4">
      <div>
        <div className="text-sm font-medium">{title ?? "Daily report by email"}</div>
        <p className="mt-1 text-xs text-muted">
          {description ?? (
            <>
              One email each evening your child studies, to <span className="font-medium text-text">{email}</span>: what they understood and what still needs work. Also streak reminders and a Sunday recap.
            </>
          )}
        </p>
      </div>
      <button
        onClick={() => void toggle()}
        disabled={busy}
        role="switch"
        aria-checked={enabled}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-primary" : "bg-border"}`}
        aria-label={title ?? "Daily report by email"}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${enabled ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
