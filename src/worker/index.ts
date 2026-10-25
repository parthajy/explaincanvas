import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { closeDb } from "@/lib/db";
import { startWorker, enqueue } from "@/lib/queue/jobs";
import { handlers } from "@/lib/queue/handlers";
import { library, parentReports } from "@/lib/repo";

/**
 * Standalone worker. Run with `pnpm worker` locally or as the `worker` service on App Platform.
 * Any number can run side by side. Also schedules the periodic housekeeping jobs (idempotent per hour).
 */
async function main() {
  const e = env();
  const worker = startWorker({ workerId: e.WORKER_ID, handlers, concurrency: 3 });

  const schedule = async () => {
    const hour = new Date().toISOString().slice(0, 13);
    await enqueue({ kind: "credits.expire", payload: {}, key: `credits.expire:${hour}` });
    await enqueue({ kind: "billing.cycle", payload: {}, key: `billing.cycle:${hour}` });
    await enqueue({ kind: "sessions.purge", payload: {}, key: `sessions.purge:${hour}` });
    await enqueue({ kind: "uploads.purge", payload: {}, key: `uploads.purge:${hour.slice(0, 10)}` });
    await enqueue({ kind: "lifecycle.sweep", payload: {}, key: `lifecycle.sweep:${hour}` });
    await enqueue({ kind: "credits.free_refill", payload: {}, key: `credits.free_refill:${hour}` });
    for (const row of await library.readyToPublish()) {
      await enqueue({ kind: "lesson.promote", payload: { lessonId: row.id }, key: `lesson.promote:${row.id}` });
    }

    // Daily parent reports after PARENT_REPORT_HOUR_IST, one job per student with activity that day.
    const ist = new Date(Date.now() + 5.5 * 3600_000);
    if (ist.getUTCHours() >= e.PARENT_REPORT_HOUR_IST) {
      const date = ist.toISOString().slice(0, 10);
      const start = new Date(`${date}T00:00:00+05:30`);
      const end = new Date(start.getTime() + 86_400_000);
      for (const row of await parentReports.studentsDue(start, end, date)) {
        await enqueue({ kind: "parent.report", payload: { studentId: row.student_id, date }, key: `parent.report:${row.student_id}:${date}` });
      }
    }
  };
  await schedule().catch((err) => logger.error({ err }, "scheduling failed"));
  const timer = setInterval(() => void schedule().catch((err) => logger.error({ err }, "scheduling failed")), 15 * 60_000);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    clearInterval(timer);
    await worker.stop();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "worker crashed");
  process.exit(1);
});
