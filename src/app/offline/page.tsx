import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = { title: "Offline", robots: { index: false, follow: false } };

/** Served by the service worker when the network is gone. Static, so it can be cached at install. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center text-text">
      <LogoMark size={40} />
      <h1 className="mt-8 text-[28px] font-semibold tracking-tight">You are offline</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted">Explanations need a connection. Your chats and credits are safe. Reconnect and this page will refresh itself.</p>
      <a href="/" className="mt-6 rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-on-primary">
        Try again
      </a>
      <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('online',function(){location.href='/'})" }} />
    </div>
  );
}
