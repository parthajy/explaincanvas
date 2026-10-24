"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEVELS } from "@/lib/levels";

export function AddStudentForm() {
  const [name, setName] = useState("");
  const [cls, setCls] = useState(9);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, classLevel: cls }) });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErr(b.message ?? "Could not add learner.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-border p-4">
      <label className="flex-1 text-sm">
        <span className="text-muted">Learner&apos;s name (yours, or your child&apos;s)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--ring)]" />
      </label>
      <label className="text-sm">
        <span className="text-muted">Level</span>
        <select value={cls} onChange={(e) => setCls(Number(e.target.value))} className="mt-1 block rounded-xl border border-border px-3 py-2">
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">
        Add
      </button>
      {err && <p className="w-full text-xs text-danger">{err}</p>}
    </form>
  );
}
