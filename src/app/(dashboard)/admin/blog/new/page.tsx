import type { Metadata } from "next";
import { AdminBlogEditor } from "@/features/blog/presentation/admin-blog-editor";

export const metadata: Metadata = {
  title: "Create Blog Post — Admin",
};

export default function NewBlogPage() {
  return <AdminBlogEditor />;
}
