import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  markdownContent: z.string().min(1, "Content is required"),
  excerpt: z.string().max(500).optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export const updatePostSchema = createPostSchema.partial();

export const createCommentSchema = z.object({
  authorName: z.string().min(1, "Name is required").max(100),
  authorEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  body: z.string().min(1, "Comment is required").max(2000),
});

export const createStaticPageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().min(1, "Title is required").max(200),
  markdownContent: z.string().min(1, "Content is required"),
  sortOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
});

export const updateStaticPageSchema = createStaticPageSchema.partial();

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateStaticPageInput = z.infer<typeof createStaticPageSchema>;
export type UpdateStaticPageInput = z.infer<typeof updateStaticPageSchema>;
