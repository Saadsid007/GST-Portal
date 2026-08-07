import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_POSTS_DATA } from "@/lib/seo/blog-data";
import { BlogService } from "@/features/blog/services/blog.service";
import { BlogPostView } from "@/features/blog/presentation/blog-post-view";
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage ? [post.coverImage] : undefined,
    author: {
      "@type": "Person",
      name: post.author,
      jobTitle: post.authorRole ?? "Compliance Specialist",
    },
    publisher: {
      "@type": "Organization",
      name: "GSTPilot",
      url: "https://gstpilot.com",
    },
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : new Date().toISOString(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://gstpilot.com/blog/${post.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogPostView post={post} relatedPosts={relatedPosts} />
    </>
  );
}
