import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BLOG_POSTS_DATA } from "@/lib/seo/blog-data";
import { ArrowLeft, ArrowRight, Calendar, User, Clock } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS_DATA[slug];
  if (!post) return {};

  return {
    // absolute: these metaTitles already carry their own brand suffix,
    // so the root template must not append a second one.
    title: { absolute: post.metaTitle },
    description: post.metaDescription,
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      type: "article",
      publishedTime: post.publishedDate,
      authors: [post.author],
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(BLOG_POSTS_DATA).map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = BLOG_POSTS_DATA[slug];
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: { "@type": "Organization", name: post.author },
    datePublished: post.publishedDate,
    publisher: { "@type": "Organization", name: "GSTPilot" },
  };

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="space-y-4 border-b border-border pb-8 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary-ink">
          {post.category}
        </span>
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        <div className="flex items-center justify-center gap-4 pt-2 font-mono text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="size-3" /> {post.author}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" /> {post.publishedDate}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> {post.readTime}
          </span>
        </div>
      </div>

      <article className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed sm:text-base">
        <div className="whitespace-pre-line text-foreground/90">{post.content}</div>
      </article>

      <div className="flex items-center justify-between border-t border-border pt-8">
        <Link
          href="/blog"
          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Blog Index
        </Link>
        <Link
          href="/convert"
          className="flex items-center gap-1.5 text-xs font-bold text-primary-ink hover:underline"
        >
          <span>Start Free Conversion</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
