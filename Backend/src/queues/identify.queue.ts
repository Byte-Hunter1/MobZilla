import { Queue } from "bullmq";
import { createBullConnection } from "../lib/redis";

export const identifyQueue = new Queue("identify", { connection: createBullConnection() });

export function enqueueIdentification(jobId: string) {
  return identifyQueue.add(
    "identify",
    { jobId },
    {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 200
    }
  );
}
