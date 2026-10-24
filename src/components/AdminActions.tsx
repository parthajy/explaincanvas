"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}

const btn = "rounded-full border border-border px-3 py-1 text-[12px] hover:border-border-2 disabled:opacity-40";

export function ReportActions({ reportId, lessonId }: { reportId: string; lessonId: string | null }) {
  const { run, busy } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      {lessonId && (
        <>
          <button disabled={busy} className={btn} onClick={() => void run({ action: "lesson", lessonId, status: "published" }).then(() => run({ action: "resolveReport", reportId, resolution: "kept, republished" }))}>
            Lesson is fine, republish
          </button>
          <button disabled={busy} className={`${btn} text-danger`} onClick={() => void run({ action: "lesson", lessonId, status: "retired" }).then(() => run({ action: "resolveReport", reportId, resolution: "lesson retired" }))}>
            Retire lesson
          </button>
        </>
      )}
      <button disabled={busy} className={btn} onClick={() => void run({ action: "resolveReport", reportId, resolution: "dismissed" })}>
        Dismiss
      </button>
    </div>
  );
}

export function RetryJob({ jobId }: { jobId: string }) {
  const { run, busy } = useAction();
  return (
    <button disabled={busy} className={btn} onClick={() => void run({ action: "retryJob", jobId })}>
      Retry
    </button>
  );
}
