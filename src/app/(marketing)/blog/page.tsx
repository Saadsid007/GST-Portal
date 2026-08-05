import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS_DATA } from "@/lib/seo/blog-data";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "GST Compliance & E-Commerce Blog",
  description:
    "Guides, tutorials, and GST updates for Amazon sellers, Meesho suppliers, Flipkart merchants, and CAs.",
};

export default function BlogPage() {
  const posts = Object.values(BLOG_POSTS_DATA);

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 py-16">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Compliance Blog
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          E-Commerce GST Guides & Updates
        </h1>
        <p className="text-sm text-muted-foreground">
          Practical advice for e-commerce sellers, CAs, and compliance teams.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col justify-between space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/50 hover:bg-accent/40"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-primary-ink">
                  {post.category}
                </span>
                <span className="font-mono text-muted-foreground">{post.readTime}</span>
              </div>
              <h2 className="text-base leading-snug font-bold text-foreground transition-colors group-hover:text-primary-ink">
                {post.title}
              </h2>
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs font-bold text-primary-ink">
              <span>Read Article</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
