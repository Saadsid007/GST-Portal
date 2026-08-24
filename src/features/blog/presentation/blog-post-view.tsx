"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Clock, Check, Copy, Zap, List } from "lucide-react";
import { Button } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import type { BlogPostItem } from "@/features/blog/types/blog.types";

interface BlogPostViewProps {
  post: BlogPostItem;
  relatedPosts?: BlogPostItem[];
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function BlogPostView({ post, relatedPosts = [] }: BlogPostViewProps) {
  const [copied, setCopied] = useState(false);

  // Auto extract headings (H2 & H3) for Table of Contents
  const headings = useMemo(() => {
    const regex = /^(##|###)\s+(.+)$/gm;
    const matches: TocItem[] = [];
    let match;
    while ((match = regex.exec(post.content)) !== null) {
      const level = match[1] === "##" ? 2 : 3;
      const text = match[2]!.trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-");
      matches.push({ id, text, level });
    }
    return matches;
  }, [post.content]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Recently published";

  return (
    <article className="mx-auto max-w-5xl space-y-12 px-6 py-12">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <Link href="/blog" className="hover:text-foreground">
          Blog
        </Link>
        <span>/</span>
        <span className="max-w-xs truncate font-medium text-foreground">{post.title}</span>
      </div>

      {/* Header Info */}
      <div className="mx-auto max-w-3xl space-y-6 text-center">
        <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary-ink">
          {post.category}
        </span>

        <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance text-foreground sm:text-5xl">
          {post.title}
        </h1>

        <p className="text-base leading-relaxed text-muted-foreground">{post.excerpt}</p>

        {/* Author & Meta Bar */}
        <div className="flex flex-wrap items-center justify-center gap-6 border-t border-b border-border/80 py-4 pt-4 font-mono text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 font-bold text-primary-ink">
              {post.author[0]}
            </div>
            <div className="text-left">
              <span className="block font-sans font-bold text-foreground">{post.author}</span>
              <span className="block text-2xs text-muted-foreground">
                {post.authorRole ?? "Compliance Specialist"}
              </span>
            </div>
          </div>

          <span className="hidden sm:inline">·</span>

          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            {formattedDate}
          </span>

          <span>·</span>

          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            {post.readTime}
          </span>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-2xs font-semibold transition hover:bg-accent"
          >
            {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
            {copied ? "Copied Link!" : "Share Link"}
          </button>
        </div>
      </div>

      {/* Cover Image */}
      {post.coverImage && (
        <div className="mx-auto aspect-21/9 max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt={post.title} className="size-full object-cover" />
        </div>
      )}

      {/* Content Layout Grid (TOC Sidebar + Main Body) */}
      <div className="grid grid-cols-1 gap-12 pt-4 lg:grid-cols-4">
        {/* Table of Contents Sidebar */}
        {headings.length > 0 && (
          <aside className="space-y-4 lg:col-span-1">
            <div className="sticky top-24 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
              <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                <List className="size-3.5 text-primary-ink" />
                Table of Contents
              </span>
              <nav className="space-y-1.5 text-xs">
                {headings.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className={`block leading-snug text-muted-foreground transition-colors hover:text-primary-ink ${
                      h.level === 3 ? "pl-3 text-2xs" : "font-medium"
                    }`}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Main Body Content */}
        <div
          className={
            headings.length > 0
              ? "space-y-8 lg:col-span-3"
              : "mx-auto max-w-3xl space-y-8 lg:col-span-4"
          }
        >
          <Markdown content={post.content} className="prose-base" />

          {/* Author Box */}
          <div className="flex items-start gap-4 rounded-3xl border border-border bg-subtle p-6 shadow-xs">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl brand-gradient text-lg font-bold text-primary-foreground">
              {post.author[0]}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold">{post.author}</h3>
              <p className="font-mono text-2xs text-muted-foreground">
                {post.authorRole ?? "Compliance Specialist"}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Specialized in e-commerce GST reconciliation, GSTN API integrations, and Marketplace
                Tax Reports (Amazon MTR, Meesho, Flipkart).
              </p>
            </div>
          </div>

          {/* Call to Action Banner */}
          <div className="space-y-4 rounded-3xl brand-gradient p-8 text-center text-primary-foreground shadow-lg">
            <h3 className="text-xl font-bold tracking-tight">
              Convert Marketplace Reports to GSTR-1 in 5 Seconds
            </h3>
            <p className="mx-auto max-w-lg text-xs text-primary-foreground/90">
              Automate your Amazon MTR, Meesho &amp; Flipkart returns calculation with GSTPilot. Get
              official GSTN v3.0 JSON and multi-sheet Excel files.
            </p>
            <Button
              asChild
              size="lg"
              className="rounded-xl bg-background text-foreground hover:bg-card"
            >
              <Link href="/convert">
                <Zap className="size-4" />
                Start Free Conversion Now
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Navigation & Related Articles */}
      <div className="space-y-8 border-t border-border pt-8">
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href="/blog">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to Blog Index
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="rounded-xl text-primary-ink">
            <Link href="/convert">
              <span>Try Live Generator</span>
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>

        {relatedPosts.length > 0 && (
          <div className="space-y-6 border-t border-border pt-6">
            <h3 className="text-lg font-bold">Related Compliance Guides</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {relatedPosts.slice(0, 2).map((rel) => (
                <Link
                  key={rel.id}
                  href={`/blog/${rel.slug}`}
                  className="group space-y-2 rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/50"
                >
                  <span className="text-2xs font-bold text-primary-ink uppercase">
                    {rel.category}
                  </span>
                  <h4 className="line-clamp-1 text-sm font-bold text-foreground group-hover:text-primary-ink">
                    {rel.title}
                  </h4>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{rel.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
