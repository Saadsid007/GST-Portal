export type BlogStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface BlogPostItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage?: string | null;
  category: string;
  tags: string[];
  author: string;
  authorRole?: string | null;
  authorAvatar?: string | null;
  readTime: string;
  status: BlogStatus;
  isFeatured: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogImage?: string | null;
  publishedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BlogFilterOptions {
  search?: string;
  category?: string;
  status?: BlogStatus;
  isFeatured?: boolean;
  page?: number;
  limit?: number;
}

export const BLOG_CATEGORIES = [
  "Compliance",
  "GST Updates",
  "Marketplaces",
  "Tutorials",
  "Taxation",
  "CA Corner",
] as const;
