"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DangerZone({ email }: { email: string }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function remove() {
    setBusy(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <div className="rounded-3xl border border-border p-6">
      <div className="text-[15px] font-medium">Delete account</div>
      <p className="mt-1 text-[14px] text-muted">Removes your account, your children&apos;s profiles, every chat and photo, and the daily report. Payment records are kept for accounting. This cannot be undone.</p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-4 rounded-full border border-border px-4 py-2 text-[14px] text-danger hover:border-danger">
          Delete my account
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type ${email} to confirm`} className="min-w-[280px] flex-1 rounded-full border border-border bg-panel px-4 py-2 text-[14px] outline-none focus:border-border-2" />
          <button onClick={() => void remove()} disabled={busy || typed.trim().toLowerCase() !== email.toLowerCase()} className="rounded-full bg-danger px-4 py-2 text-[14px] font-medium text-white disabled:opacity-40">
            {busy ? "Deleting..." : "Delete everything"}
          </button>
          <button onClick={() => setOpen(false)} className="text-[14px] text-muted">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
