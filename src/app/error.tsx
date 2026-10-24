"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted">The page hit an error. Your chats and credits are safe. Try again, and if it keeps happening tell us at hello@explaincanvas.com{error.digest ? ` (ref ${error.digest})` : ""}.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary">
          Try again
        </button>
        <Link href="/" className="rounded-xl border border-border px-4 py-2 text-sm">
          Go home
        </Link>
      </div>
    </div>
  );
}
