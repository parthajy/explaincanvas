"use client";

import { useEffect, useState } from "react";

/**
 * Turn notifications on or off for this device. Subscribes through the service worker and registers the
 * subscription with the server. Hidden where push is unsupported (iOS Safari outside the home screen).
 */
type State = "unsupported" | "default" | "granted" | "denied" | "busy";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePush() {
  const [state, setState] = useState<State>("busy");
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setTimeout(() => setState("unsupported"), 0);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setSubscribed(Boolean(sub));
        setState(Notification.permission as State);
      })
      .catch(() => setState("unsupported"));
  }, []);

  async function enable(): Promise<boolean> {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return false;
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission as State);
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      setSubscribed(res.ok);
      setState("granted");
      return res.ok;
    } catch {
      setState("default");
      return false;
    }
  }

  async function disable(): Promise<void> {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setState(Notification.permission as State);
    }
  }

  return { state, subscribed, enable, disable };
}

export function PushToggle() {
  const { state, subscribed, enable, disable } = usePush();
  if (state === "unsupported") return null;
  const on = state === "granted" && subscribed;
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-panel p-4">
      <div>
        <div className="text-sm font-medium">Notifications on this device</div>
        <p className="mt-1 text-xs text-muted">
          {state === "denied" ? "Blocked in your browser or phone settings. Allow notifications for ExplainCanvas there to turn this on." : "A tap when an explanation is ready, your evening report, and a nudge when a streak is about to end."}
        </p>
      </div>
      <button
        onClick={() => void (on ? disable() : enable())}
        disabled={state === "busy" || state === "denied"}
        role="switch"
        aria-checked={on}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-border"} disabled:opacity-50`}
        aria-label="Notifications on this device"
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

/** A one-line prompt shown in the chat the first time an explanation is ready, until answered or dismissed. */
export function PushNudge() {
  const { state, subscribed, enable } = usePush();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("ec-push-nudge") === "1") setTimeout(() => setDismissed(true), 0);
    } catch {}
  }, []);
  if (dismissed || state === "unsupported" || state === "busy" || state === "denied" || (state === "granted" && subscribed)) return null;
  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem("ec-push-nudge", "1");
    } catch {}
  };
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-panel px-4 py-2.5 text-[13px]">
      <span className="text-muted">Get a tap when your next explanation is ready?</span>
      <span className="flex gap-2">
        <button onClick={() => void enable().then((ok) => ok && close())} className="rounded-full bg-primary px-3 py-1 text-[12px] font-medium text-on-primary">
          Turn on
        </button>
        <button onClick={close} className="rounded-full border border-border px-3 py-1 text-[12px] text-muted">
          Not now
        </button>
      </span>
    </div>
  );
}
