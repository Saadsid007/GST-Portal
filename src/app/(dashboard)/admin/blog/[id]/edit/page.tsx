import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogService } from "@/features/blog/services/blog.service";
import { AdminBlogEditor } from "@/features/blog/presentation/admin-blog-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await BlogService.getPostById(id);
  return {
    title: post ? `Edit: ${post.title} — Admin` : "Edit Blog Post — Admin",
  };
}

export default async function EditBlogPage({ params }: Props) {
  const { id } = await params;
  const post = await BlogService.getPostById(id);

  if (!post) {
    notFound();
  }

  return <AdminBlogEditor initialPost={post} />;
}
