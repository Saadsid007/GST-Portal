"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, Sparkles, Clock, User, BookOpen } from "lucide-react";
import { Input } from "@/components/ui";
import { BLOG_CATEGORIES, type BlogPostItem } from "@/features/blog/types/blog.types";

interface BlogListViewProps {
  initialPosts: BlogPostItem[];
}

export function BlogListView({ initialPosts }: BlogListViewProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const filteredPosts = initialPosts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(search.toLowerCase()) ||
      post.category.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === "ALL" || post.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const featuredPost = filteredPosts.find((p) => p.isFeatured) ?? filteredPosts[0];
  const gridPosts = featuredPost
    ? filteredPosts.filter((p) => p.id !== featuredPost.id)
    : filteredPosts;

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 py-12">
      {/* Header */}
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          <BookOpen className="size-3.5" />
          Compliance Knowledge Base
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          E-Commerce GST Guides &amp; Regulatory Updates
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Practical advice, step-by-step tax report tutorials, and GST compliance updates for Amazon
          sellers, Meesho suppliers, Flipkart merchants, and CAs.
        </p>
      </div>

      {/* Search & Category Filter Pills */}
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="relative mx-auto max-w-md">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search GST guides, Amazon MTR, Meesho returns, TCS..."
            className="h-11 rounded-2xl border-border bg-card pl-10 text-xs shadow-xs"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              selectedCategory === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            All Articles
          </button>
          {BLOG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Hero Article */}
      {featuredPost && (
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/blog/${featuredPost.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:border-primary/50 hover:shadow-md lg:flex-row"
          >
            {featuredPost.coverImage ? (
              <div className="relative aspect-video w-full overflow-hidden bg-muted lg:w-1/2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredPost.coverImage}
                  alt={featuredPost.title}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="relative flex aspect-video w-full items-center justify-center brand-gradient p-8 text-primary-foreground lg:w-1/2">
                <div className="space-y-2 text-center">
                  <Sparkles className="mx-auto size-10 opacity-80" />
                  <span className="text-xs font-bold tracking-widest uppercase opacity-90">
                    Featured Guide
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-1 flex-col justify-between space-y-6 p-8 sm:p-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary-ink">
                    {featuredPost.category}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-muted-foreground">
                    <Clock className="size-3" />
                    {featuredPost.readTime}
                  </span>
                </div>

                <h2 className="text-2xl leading-tight font-bold tracking-tight text-foreground transition-colors group-hover:text-primary-ink sm:text-3xl">
                  {featuredPost.title}
                </h2>

                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {featuredPost.excerpt}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border/80 pt-6 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="size-3.5" />
                  <span className="font-medium text-foreground">{featuredPost.author}</span>
                </div>

                <div className="flex items-center gap-1.5 font-bold text-primary-ink">
                  <span>Read Full Article</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Grid of Remaining Articles */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {gridPosts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-xs transition hover:border-primary/50 hover:bg-accent/30 hover:shadow-sm"
          >
            <div className="space-y-4">
              {post.coverImage && (
                <div className="mb-4 aspect-video overflow-hidden rounded-2xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-primary-ink">
                  {post.category}
                </span>
                <span className="flex items-center gap-1 font-mono text-2xs text-muted-foreground">
                  <Clock className="size-3" />
                  {post.readTime}
                </span>
              </div>

              <h2 className="line-clamp-2 text-base leading-snug font-bold text-foreground transition-colors group-hover:text-primary-ink">
                {post.title}
              </h2>

              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-xs font-bold text-primary-ink">
              <span>Read Article</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
