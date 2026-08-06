import { prisma } from "@/lib/prisma";
import type { BlogFilterOptions, BlogPostItem, BlogStatus } from "@/features/blog/types/blog.types";
import type { BlogPostFormValues } from "@/features/blog/schemas/blog.schemas";
import { BLOG_POSTS_DATA } from "@/lib/seo/blog-data";
import { calculateReadTime, generateSlug } from "@/features/blog/utils/blog.utils";

export { calculateReadTime, generateSlug };

function serializeBlogPost(post: Record<string, unknown> | null): BlogPostItem {
  if (!post) return post as unknown as BlogPostItem;
  return {
    ...post,
    publishedAt: post.publishedAt ? new Date(post.publishedAt as string).toISOString() : null,
    createdAt: post.createdAt
      ? new Date(post.createdAt as string).toISOString()
      : new Date().toISOString(),
    updatedAt: post.updatedAt
      ? new Date(post.updatedAt as string).toISOString()
      : new Date().toISOString(),
  } as BlogPostItem;
}

export class BlogService {
  /**
   * Seed initial high-value compliance guides from static data if database has zero blog posts.
   */
  static async seedIfEmpty(): Promise<void> {
    try {
      const count = await prisma.blogPost.count();
      if (count > 0) return;

      const staticPosts = Object.values(BLOG_POSTS_DATA);
      for (const p of staticPosts) {
        await prisma.blogPost.create({
          data: {
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            content: p.content,
            category: p.category ?? "Compliance",
            tags: ["GST", "E-Commerce", p.category ?? "Compliance"],
            author: p.author ?? "GSTPilot Editorial Team",
            authorRole: "GST Compliance Specialist",
            readTime: p.readTime ?? "5 min read",
            status: "PUBLISHED",
            isFeatured: p.slug.includes("amazon"),
            metaTitle: p.metaTitle,
            metaDescription: p.metaDescription,
            publishedAt: p.publishedDate ? new Date(p.publishedDate) : new Date(),
          },
        });
      }
    } catch (_err) {
      // In case of table missing during initial setup, fail silently
    }
  }

  /**
   * Fetch published blog posts for public visitors.
   */
  static async getPublishedPosts(
    filters?: BlogFilterOptions
  ): Promise<{ posts: BlogPostItem[]; total: number }> {
    await this.seedIfEmpty();

    const where: Record<string, unknown> = {
      status: "PUBLISHED",
    };

    if (filters?.category && filters.category !== "ALL") {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { excerpt: { contains: filters.search, mode: "insensitive" } },
        { content: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters?.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
        take: filters?.limit ?? 20,
        skip: filters?.page ? (filters.page - 1) * (filters.limit ?? 20) : 0,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return { posts: posts.map(serializeBlogPost), total };
  }

  /**
   * Get single published post by slug.
   */
  static async getPostBySlug(slug: string): Promise<BlogPostItem | null> {
    await this.seedIfEmpty();

    const post = await prisma.blogPost.findFirst({
      where: { slug, status: "PUBLISHED" },
    });

    return post ? serializeBlogPost(post) : null;
  }

  /**
   * Fetch all posts for Admin Panel.
   */
  static async getAllPostsAdmin(
    filters?: BlogFilterOptions
  ): Promise<{ posts: BlogPostItem[]; total: number }> {
    await this.seedIfEmpty();

    const where: Record<string, unknown> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category && filters.category !== "ALL") {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { excerpt: { contains: filters.search, mode: "insensitive" } },
        { slug: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: filters?.limit ?? 50,
        skip: filters?.page ? (filters.page - 1) * (filters.limit ?? 50) : 0,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return { posts: posts.map(serializeBlogPost), total };
  }

  /**
   * Get single post by ID (Admin).
   */
  static async getPostById(id: string): Promise<BlogPostItem | null> {
    const post = await prisma.blogPost.findUnique({
      where: { id },
    });
    return post ? serializeBlogPost(post) : null;
  }

  /**
   * Create new blog post.
   */
  static async createPost(data: BlogPostFormValues): Promise<BlogPostItem> {
    const readTime = calculateReadTime(data.content);
    const publishedAt = data.status === "PUBLISHED" ? new Date() : null;

    const post = await prisma.blogPost.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        coverImage: data.coverImage || null,
        category: data.category,
        tags: data.tags,
        author: data.author,
        authorRole: data.authorRole || null,
        authorAvatar: data.authorAvatar || null,
        readTime,
        status: data.status,
        isFeatured: data.isFeatured,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        canonicalUrl: data.canonicalUrl || null,
        ogImage: data.ogImage || null,
        publishedAt,
      },
    });

    return serializeBlogPost(post);
  }

  /**
   * Update existing blog post.
   */
  static async updatePost(id: string, data: Partial<BlogPostFormValues>): Promise<BlogPostItem> {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new Error("Blog post not found");

    const readTime = data.content ? calculateReadTime(data.content) : existing.readTime;
    let publishedAt = existing.publishedAt;

    if (data.status === "PUBLISHED" && !existing.publishedAt) {
      publishedAt = new Date();
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.slug && { slug: data.slug }),
        ...(data.excerpt && { excerpt: data.excerpt }),
        ...(data.content && { content: data.content }),
        coverImage: data.coverImage !== undefined ? data.coverImage || null : existing.coverImage,
        ...(data.category && { category: data.category }),
        ...(data.tags && { tags: data.tags }),
        ...(data.author && { author: data.author }),
        authorRole: data.authorRole !== undefined ? data.authorRole || null : existing.authorRole,
        authorAvatar:
          data.authorAvatar !== undefined ? data.authorAvatar || null : existing.authorAvatar,
        readTime,
        ...(data.status && { status: data.status as BlogStatus }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
        metaTitle: data.metaTitle !== undefined ? data.metaTitle || null : existing.metaTitle,
        metaDescription:
          data.metaDescription !== undefined
            ? data.metaDescription || null
            : existing.metaDescription,
        canonicalUrl:
          data.canonicalUrl !== undefined ? data.canonicalUrl || null : existing.canonicalUrl,
        ogImage: data.ogImage !== undefined ? data.ogImage || null : existing.ogImage,
        publishedAt,
      },
    });

    return serializeBlogPost(post);
  }

  /**
   * Delete post.
   */
  static async deletePost(id: string): Promise<void> {
    await prisma.blogPost.delete({ where: { id } });
  }

  /**
   * Toggle Publish Status.
   */
  static async togglePublish(id: string): Promise<BlogPostItem> {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new Error("Blog post not found");

    const newStatus: BlogStatus = existing.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const publishedAt =
      newStatus === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : existing.publishedAt;

    const post = await prisma.blogPost.update({
      where: { id },
      data: { status: newStatus, publishedAt },
    });

    return serializeBlogPost(post);
  }

  /**
   * Toggle Featured Flag.
   */
  static async toggleFeatured(id: string): Promise<BlogPostItem> {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new Error("Blog post not found");

    const post = await prisma.blogPost.update({
      where: { id },
      data: { isFeatured: !existing.isFeatured },
    });

    return serializeBlogPost(post);
  }
}
