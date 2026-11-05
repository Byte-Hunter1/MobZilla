import IORedis from "ioredis";
import { env } from "../config/env";

export const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 2 });

export function createBullConnection() {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
