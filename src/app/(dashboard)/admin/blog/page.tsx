import type { Metadata } from "next";
import { BlogService } from "@/features/blog/services/blog.service";
import { AdminBlogList } from "@/features/blog/presentation/admin-blog-list";

export const metadata: Metadata = {
  title: "Blog Content Management — Admin",
};

export const revalidate = 0; // Always fresh for admin dashboard

export default async function AdminBlogPage() {
  const { posts, total } = await BlogService.getAllPostsAdmin();

  return <AdminBlogList initialPosts={posts} total={total} />;
}
