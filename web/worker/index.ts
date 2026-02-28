import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import { processStampJob } from "./processor";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/stamp";

async function main() {
  console.log("STAMP Worker starting...");

  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  // Create Redis connection
  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  console.log("Connected to Redis");

  // Create worker
  const worker = new Worker("stamp-jobs", processStampJob, {
    connection,
    concurrency: 1, // One job at a time per worker
  });

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  console.log("STAMP Worker ready, waiting for jobs...");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down worker...");
    await worker.close();
    await connection.quit();
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
