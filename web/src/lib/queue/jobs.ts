import { getStampQueue } from "./bullmq";
import type { StampParams, MatchingConfig, ParsedMotif } from "@/types";

export interface StampJobData {
  jobId: string;
  motifs: ParsedMotif[];
  params: StampParams;
  matching: MatchingConfig;
  email: string | null;
}

export async function enqueueStampJob(data: StampJobData): Promise<void> {
  const queue = getStampQueue();
  await queue.add("stamp-analysis", data, {
    jobId: data.jobId,
  });
}
