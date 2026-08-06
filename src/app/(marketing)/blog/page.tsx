import type { Metadata } from "next";
import { BlogService } from "@/features/blog/services/blog.service";
import { BlogListView } from "@/features/blog/presentation/blog-list-view";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "E-Commerce GST Compliance Blog & Regulatory Guides | GSTPilot",
  description:
    "In-depth guides, step-by-step tax report tutorials, and regulatory updates for Amazon sellers, Meesho suppliers, Flipkart merchants, and CAs.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "GST Compliance & E-Commerce Blog | GSTPilot",
    description: "Guides, tutorials, and GST updates for Amazon, Meesho, Flipkart sellers and CAs.",
    type: "website",
  },
};

export default async function BlogPage() {
  const { posts } = await BlogService.getPublishedPosts();

  return <BlogListView initialPosts={posts} />;
}
