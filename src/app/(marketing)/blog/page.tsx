import type { Metadata } from "next";
import { BlogService } from "@/features/blog/services/blog.service";
import { BlogListView } from "@/features/blog/presentation/blog-list-view";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema } from "@/lib/seo/structured-data";

export const revalidate = 60; // Revalidate every 60 seconds

const baseMetadata = buildPageMetadata({
  title: "E-Commerce GST Compliance Blog & Regulatory Guides",
  description:
    "In-depth guides, step-by-step tax report tutorials, and regulatory updates for Amazon sellers, Meesho suppliers, Flipkart merchants, and CAs.",
  path: "/blog",
});

export const metadata: Metadata = {
  ...baseMetadata,
  openGraph: {
    ...baseMetadata.openGraph,
    title: "GST Compliance & E-Commerce Blog | GSTPilot",
    description: "Guides, tutorials, and GST updates for Amazon, Meesho, Flipkart sellers and CAs.",
  },
};

export default async function BlogPage() {
  const { posts } = await BlogService.getPublishedPosts();

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />
      <BlogListView initialPosts={posts} />
    </>
  );
}
