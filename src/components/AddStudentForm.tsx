"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddStudentForm() {
  const [name, setName] = useState("");
  const [cls, setCls] = useState(8);
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
      setErr(b.message ?? "Could not add student.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-border p-4">
      <label className="flex-1 text-sm">
        <span className="text-muted">Student&apos;s name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-xl border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--ring)]" />
      </label>
      <label className="text-sm">
        <span className="text-muted">Class</span>
        <select value={cls} onChange={(e) => setCls(Number(e.target.value))} className="mt-1 block rounded-xl border border-border px-3 py-2">
          {[6, 7, 8, 9, 10].map((c) => (
            <option key={c} value={c}>
              {c}
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
