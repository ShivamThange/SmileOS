import { Worker, Queue } from "bullmq";
import { getRedis, isRedisReady } from "../config/redis";
import { logger } from "../config/logger";
import type { QueueName } from "./queue";

/*
 * Job workers + scheduler (spec Part 6). Started only when Redis is available;
 * in degraded mode the whole subsystem is skipped (enqueue already no-ops).
 * Processors here are log-based stubs — the real integrations (SMTP, WhatsApp
 * Cloud, PDF render, reconciliation) slot into these handlers.
 */

const workers: Worker[] = [];
let scheduler: Queue | null = null;

const PROCESSORS: Record<QueueName, (name: string, data: unknown) => Promise<void>> = {
  email: async (name, data) => { logger.info("job:email", { name, to: (data as { to?: string }).to }); },
  whatsapp: async (name) => { logger.info("job:whatsapp", { name }); },
  pdf: async (name) => { logger.info("job:pdf", { name }); },
  analytics: async (name) => { logger.info("job:analytics", { name }); },
  maintenance: async (name) => { logger.info("job:maintenance", { name }); },
};

/** Scheduled jobs (spec Part 6) — cron in UTC; cadences match the spec table. */
const SCHEDULES: { name: string; cron: string; queue: QueueName }[] = [
  { name: "reminder-dispatcher", cron: "*/15 * * * *", queue: "whatsapp" },
  { name: "automation-evaluator", cron: "*/15 * * * *", queue: "whatsapp" },
  { name: "payment-reconciliation", cron: "0 * * * *", queue: "maintenance" },
  { name: "recall-generator", cron: "30 0 * * *", queue: "maintenance" }, // 06:00 IST
  { name: "owner-daily-digest", cron: "30 1 * * *", queue: "email" }, // 07:00 IST
  { name: "followup-worklist-refresh", cron: "30 2 * * *", queue: "analytics" }, // 08:00 IST
  { name: "overdue-instalment-reminders", cron: "30 3 * * *", queue: "whatsapp" }, // 09:00 IST
  { name: "birthday-greetings", cron: "30 4 * * *", queue: "whatsapp" }, // 10:00 IST
  { name: "inventory-alerts", cron: "30 14 * * *", queue: "maintenance" }, // 20:00 IST
  { name: "analytics-materialisation", cron: "30 17 * * *", queue: "analytics" }, // 23:00 IST
  { name: "ltv-refresh", cron: "0 18 * * *", queue: "analytics" }, // 23:30 IST
];

export function startJobs(): void {
  if (!isRedisReady()) {
    logger.info("Jobs subsystem skipped — Redis unavailable (degraded mode)");
    return;
  }
  const connection = getRedis()!;

  for (const q of Object.keys(PROCESSORS) as QueueName[]) {
    const worker = new Worker(q, async (job) => PROCESSORS[q](job.name, job.data), { connection, concurrency: 5 });
    worker.on("failed", (job, err) => logger.error("job failed", { queue: q, name: job?.name, error: err.message }));
    workers.push(worker);
  }

  // Register repeatable scheduled jobs.
  scheduler = new Queue("maintenance", { connection });
  void (async () => {
    for (const s of SCHEDULES) {
      const q = new Queue(s.queue, { connection });
      await q.add(s.name, {}, { repeat: { pattern: s.cron }, jobId: `sched:${s.name}` });
    }
    logger.info(`Jobs subsystem started — ${workers.length} workers, ${SCHEDULES.length} scheduled jobs`);
  })();
}

export async function stopJobs(): Promise<void> {
  await Promise.all(workers.map((w) => w.close().catch(() => undefined)));
  await scheduler?.close().catch(() => undefined);
}
