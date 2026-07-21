import { Queue } from "bullmq";
import { getRedis, isRedisReady } from "../config/redis";
import { logger } from "../config/logger";

/*
 * Job queue abstraction (spec Part 0 rule 6 / Part 6). External calls (email,
 * WhatsApp, PDF, reconciliation) are queued, never inline. When Redis is
 * available jobs go to BullMQ; otherwise `enqueue` degrades to a logged no-op so
 * the request path never blocks or fails on missing infrastructure.
 */

export type QueueName = "email" | "whatsapp" | "pdf" | "analytics" | "maintenance";

const queues = new Map<QueueName, Queue>();

function getQueue(name: QueueName): Queue | null {
  if (!isRedisReady()) return null;
  const conn = getRedis();
  if (!conn) return null;
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    queues.set(name, q);
  }
  return q;
}

/** Enqueue a job. Returns true if queued, false if it ran in degraded (no-op) mode. */
export async function enqueue(queue: QueueName, jobName: string, data: unknown, opts?: { delayMs?: number }): Promise<boolean> {
  const q = getQueue(queue);
  if (!q) {
    logger.debug("Queue degraded — job skipped", { queue, jobName });
    return false;
  }
  await q.add(jobName, data, opts?.delayMs ? { delay: opts.delayMs } : undefined);
  return true;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close().catch(() => undefined)));
  queues.clear();
}
