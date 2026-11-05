import { z } from "zod";

const empty = z.object({}).optional();

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    name: z.string().trim().min(1).max(80).optional()
  }),
  query: empty,
  params: empty
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Enter a valid email."),
    password: z.string().min(1, "Password is required.")
  }),
  query: empty,
  params: empty
});

export const urlSchema = z.object({
  body: z.object({
    url: z.string().trim().url("Enter a valid URL.")
  }),
  query: empty,
  params: empty
});

export const jobParamSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ jobId: z.string().min(1) })
});

export const imdbParamSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({
    imdbId: z.string().regex(/^tt\d+$/, "Enter a valid IMDb id.")
  })
});

export const descriptionSchema = z.object({
  body: z.object({
    query: z.string().trim().min(5, "Describe the scene in at least 5 characters.").max(500)
  }),
  query: empty,
  params: empty
});

export const watchlistCreateSchema = z.object({
  body: z.object({
    imdbId: z.string().regex(/^tt\d+$/, "Enter a valid IMDb id."),
    status: z.enum(["want", "watched"]).optional()
  }),
  query: empty,
  params: empty
});

export const watchlistPatchSchema = z.object({
  body: z.object({
    status: z.enum(["want", "watched"])
  }),
  query: empty,
  params: z.object({
    imdbId: z.string().regex(/^tt\d+$/, "Enter a valid IMDb id.")
  })
});

export const shareParamSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ token: z.string().min(8) })
});
