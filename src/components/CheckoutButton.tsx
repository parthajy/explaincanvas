"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Starts a hosted Dodo checkout for a plan or pack. In local dev without keys it settles a mock payment instead. */
export function CheckoutButton({ item, label, primary }: { item: string; label: string; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item }) });
      if (res.status === 401) {
        router.push(`/login?next=/pricing`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.message ?? "Could not start checkout.");
        return;
      }
      if (data.provider === "mock") {
        const ok = await fetch("/api/billing/mock-confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: data.paymentId }) });
        setMsg(ok.ok ? "Test payment applied. Credits added." : "Test payment failed.");
        router.refresh();
        return;
      }
      window.location.assign(data.url);
    } catch {
      setMsg("Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => void go()}
        disabled={busy}
        className={`w-full rounded-full px-4 py-2.5 text-[14px] font-medium transition ${primary ? "bg-primary text-on-primary hover:bg-primary-2" : "border border-border bg-panel hover:border-border-2"} disabled:opacity-50`}
      >
        {busy ? "Opening checkout..." : label}
      </button>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}

/** Opens Dodo's customer portal: cancel, change card, invoices. */
export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.message ?? "Billing portal is not available right now.");
        return;
      }
      window.location.assign(data.url);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button onClick={() => void go()} disabled={busy} className="text-[14px] font-medium underline underline-offset-4 disabled:opacity-50">
        {busy ? "Opening..." : "Manage billing"}
      </button>
      {msg && <p className="mt-1 text-xs text-muted">{msg}</p>}
    </div>
  );
}
