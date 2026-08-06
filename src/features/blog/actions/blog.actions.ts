"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/features/auth";
import { BlogService } from "@/features/blog/services/blog.service";
import { BlogPostSchema, type BlogPostFormValues } from "@/features/blog/schemas/blog.schemas";
import type { BlogFilterOptions } from "@/features/blog/types/blog.types";

export async function createBlogAction(input: BlogPostFormValues) {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: Admin permissions required");
  }

  const validated = BlogPostSchema.parse(input);
  const post = await BlogService.createPost(validated);

  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/admin/blog");

  return { success: true, post };
}

export async function updateBlogAction(id: string, input: Partial<BlogPostFormValues>) {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: Admin permissions required");
  }

  const post = await BlogService.updatePost(id, input);

  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/admin/blog");

  return { success: true, post };
}

export async function deleteBlogAction(id: string) {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: Admin permissions required");
  }

  await BlogService.deletePost(id);

  revalidatePath("/blog");
  revalidatePath("/admin/blog");

  return { success: true };
}

export async function togglePublishBlogAction(id: string) {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: Admin permissions required");
  }

  const post = await BlogService.togglePublish(id);

  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/admin/blog");

  return { success: true, post };
}

export async function toggleFeaturedBlogAction(id: string) {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: Admin permissions required");
  }

  const post = await BlogService.toggleFeatured(id);

  revalidatePath("/blog");
  revalidatePath("/admin/blog");

  return { success: true, post };
}

export async function getAdminBlogsAction(filters?: BlogFilterOptions) {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: Admin permissions required");
  }

  return BlogService.getAllPostsAdmin(filters);
}

export async function getPublicBlogsAction(filters?: BlogFilterOptions) {
  return BlogService.getPublishedPosts(filters);
}
