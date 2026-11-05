import { prisma } from "../lib/prisma";

type StoredResult = {
  match?: unknown;
  confidence?: number | null;
  reasoning?: string;
  alternatives?: unknown[];
  sourceType?: string;
  sourceUrl?: string | null;
  query?: string;
};

export async function listHistory(userId: string) {
  const jobs = await prisma.identificationJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return jobs.map((job) => {
    const result = (job.result || null) as StoredResult | null;
    return {
      id: job.id,
      timestamp: job.createdAt.toISOString(),
      sourceType: job.sourceType,
      query: job.inputLabel || result?.query || "",
      match: result?.match || null,
      confidence: result?.confidence ?? null,
      reasoning: result?.reasoning || job.error || "",
      alternatives: result?.alternatives || [],
      status: job.status,
      shareToken: job.shareToken
    };
  });
}

export async function clearHistory(userId: string) {
  await prisma.identificationJob.deleteMany({ where: { userId } });
}
