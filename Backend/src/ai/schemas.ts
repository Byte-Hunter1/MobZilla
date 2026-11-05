import { z } from "zod";

export const sceneSchema = z.object({
  description: z.string().min(1),
  location: z.string().optional().default(""),
  characters: z.array(z.string()).optional().default([]),
  actors: z.array(z.string()).optional().default([]),
  textOverlays: z.array(z.string()).optional().default([]),
  visualElements: z.array(z.string()).optional().default([])
});

export const candidateSchema = z.object({
  title: z.string().min(1),
  internationalTitle: z.string().optional().default(""),
  year: z.string().optional().default(""),
  director: z.string().optional().default(""),
  mediaType: z.enum(["movie", "series"]).optional(),
  imdbId: z.string().optional().default(""),
  confidence: z.number().min(0).max(100),
  explanation: z.string().min(1)
});

export const similarSchema = z.object({
  title: z.string().min(1),
  internationalTitle: z.string().optional().default(""),
  year: z.string().optional().default(""),
  explanation: z.string().min(1)
});

export const geminiIdentificationSchema = z.object({
  scene: sceneSchema,
  candidates: z.array(candidateSchema).max(10).default([]),
  similar: z.array(similarSchema).max(10).optional().default([])
});

export type GeminiIdentification = z.infer<typeof geminiIdentificationSchema>;
