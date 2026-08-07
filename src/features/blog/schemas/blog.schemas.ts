import { z } from "zod";

export const BlogPostSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(180, "Title is too long"),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
  excerpt: z
    .string()
    .min(10, "Excerpt must be at least 10 characters")
    .max(500, "Excerpt is too long"),
  content: z.string().min(20, "Content must be at least 20 characters"),
  coverImage: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  category: z.string().min(2, "Select a valid category"),
  tags: z.array(z.string()).default([]),
  author: z.string().min(2, "Author name required").default("GSTPilot Editorial Team"),
  authorRole: z.string().optional().default("GST Compliance Specialist"),
  authorAvatar: z.string().optional().or(z.literal("")),
  readTime: z.string().optional().default("5 min read"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(70, "Meta title should be 70 chars max").optional().or(z.literal("")),
  metaDescription: z
    .string()
    .max(170, "Meta description should be 170 chars max")
    .optional()
    .or(z.literal("")),
  canonicalUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  ogImage: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export type BlogPostFormValues = z.infer<typeof BlogPostSchema>;
