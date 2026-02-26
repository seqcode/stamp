import { Queue } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

let stampQueue: Queue | null = null;

export function getStampQueue(): Queue {
  if (!stampQueue) {
    stampQueue = new Queue("stamp-jobs", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: 7 * 24 * 3600 }, // 7 days
        removeOnFail: { age: 7 * 24 * 3600 },
        attempts: 1, // No retries for analysis jobs
      },
    });
  }
  return stampQueue;
}
