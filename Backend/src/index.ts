import { createApp } from "./app";
import { env } from "./config/env";
import { log } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { identifyQueue } from "./queues/identify.queue";
import { startIdentifyWorker } from "./workers/identify.worker";

const app = createApp();
const worker = startIdentifyWorker();

const server = app.listen(env.PORT, () => {
  log.info("mobzilla api listening", { port: env.PORT });
});

async function shutdown() {
  server.close();
  await worker.close();
  await identifyQueue.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
