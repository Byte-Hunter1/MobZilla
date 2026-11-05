import { UnrecoverableError, Worker } from "bullmq";
import { createBullConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { log } from "../lib/logger";
import { PermanentError } from "../lib/errors";
import { processIdentificationJob } from "../services/identification.service";
import { removeFile } from "../services/storage.service";

export function startIdentifyWorker() {
  const worker = new Worker(
    "identify",
    async (job) => {
      try {
        await processIdentificationJob(job.data.jobId as string);
      } catch (error) {
        if (error instanceof PermanentError) throw new UnrecoverableError(error.message);
        throw error;
      }
    },
    { connection: createBullConnection(), concurrency: 2 }
  );

  worker.on("failed", async (job, error) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const done = error instanceof UnrecoverableError || job.attemptsMade >= attempts;
    if (!done) return;
    const record = await prisma.identificationJob.findUnique({ where: { id: job.data.jobId as string } });
    if (!record || record.status === "completed") return;
    await prisma.identificationJob.update({
      where: { id: record.id },
      data: { status: "failed", error: error.message, stage: "Failed", progress: 100, localPath: null }
    });
    await removeFile(record.localPath);
    log.error("identification failed", { jobId: record.id, error: error.message });
  });

  return worker;
}

if (require.main === module) {
  startIdentifyWorker();
  log.info("identification worker started");
}
