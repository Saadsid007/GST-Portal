import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_POSTS_DATA } from "@/lib/seo/blog-data";
import { BlogService } from "@/features/blog/services/blog.service";
import { BlogPostView } from "@/features/blog/presentation/blog-post-view";
import { JsonLd } from "@/components/json-ld";
import { blogPostingSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import type { BlogPostItem } from "@/features/blog/types/blog.types";

interface Props {
  params: Promise<{ slug: string }>;
}

async function resolvePost(slug: string): Promise<BlogPostItem | null> {
  const dbPost = await BlogService.getPostBySlug(slug);
  if (dbPost) return dbPost;

  // Fallback to static data if DB query returns null
  const staticPost = BLOG_POSTS_DATA[slug];
  if (!staticPost) return null;

  return {
    id: slug,
    slug: staticPost.slug,
    title: staticPost.title,
    excerpt: staticPost.excerpt,
    content: staticPost.content,
    category: staticPost.category ?? "Compliance",
    tags: ["GST", "E-Commerce", staticPost.category],
    author: staticPost.author ?? "GSTPilot Team",
    authorRole: "GST Compliance Specialist",
    readTime: staticPost.readTime ?? "5 min read",
    status: "PUBLISHED",
    isFeatured: false,
    metaTitle: staticPost.metaTitle,
    metaDescription: staticPost.metaDescription,
    publishedAt: staticPost.publishedDate ? new Date(staticPost.publishedDate) : new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await resolvePost(slug);
  if (!post) return {};

  const titleStr = post.metaTitle || `${post.title} | GSTPilot`;
  const descStr = post.metaDescription || post.excerpt;

  return {
    title: { absolute: titleStr },
    description: descStr,
    alternates: {
      canonical: post.canonicalUrl || `/blog/${post.slug}`,
    },
    openGraph: {
      title: titleStr,
      description: descStr,
      type: "article",
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      authors: [post.author],
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
  };
}

export async function generateStaticParams() {
  const { posts } = await BlogService.getPublishedPosts();
  if (posts.length > 0) {
    return posts.map((p) => ({ slug: p.slug }));
  }
  return Object.keys(BLOG_POSTS_DATA).map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await resolvePost(slug);
  if (!post) notFound();

  const { posts: allPosts } = await BlogService.getPublishedPosts();
  const relatedPosts = allPosts.filter((p) => p.slug !== slug);

  const jsonLd = [
    blogPostingSchema({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      author: post.author,
      publishedDate: (post.publishedAt
        ? new Date(post.publishedAt)
        : new Date(post.createdAt)
      ).toISOString(),
      updatedAt: new Date(post.updatedAt).toISOString(),
    }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.title, path: `/blog/${post.slug}` },
    ]),
  ];

  return (
    <>
      <JsonLd schema={jsonLd} />
      <BlogPostView post={post} relatedPosts={relatedPosts} />
    </>
  );
}
