"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Star,
  CheckCircle,
  FileText,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import type { BlogPostItem } from "@/features/blog/types/blog.types";
import {
  deleteBlogAction,
  toggleFeaturedBlogAction,
  togglePublishBlogAction,
} from "@/features/blog/actions/blog.actions";

interface AdminBlogListProps {
  initialPosts: BlogPostItem[];
  total: number;
}

export function AdminBlogList({ initialPosts, total }: AdminBlogListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [posts, setPosts] = useState<BlogPostItem[]>(initialPosts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.slug.toLowerCase().includes(search.toLowerCase()) ||
      post.category.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || post.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleTogglePublish = (id: string) => {
    startTransition(async () => {
      try {
        const res = await togglePublishBlogAction(id);
        setPosts((prev) => prev.map((p) => (p.id === id ? res.post : p)));
        router.refresh();
      } catch (err: unknown) {
        alert((err as Error)?.message || "Failed to update publish status");
      }
    });
  };

  const handleToggleFeatured = (id: string) => {
    startTransition(async () => {
      try {
        const res = await toggleFeaturedBlogAction(id);
        setPosts((prev) => prev.map((p) => (p.id === id ? res.post : p)));
        router.refresh();
      } catch (err: unknown) {
        alert((err as Error)?.message || "Failed to update featured status");
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;

    startTransition(async () => {
      try {
        await deleteBlogAction(id);
        setPosts((prev) => prev.filter((p) => p.id !== id));
        router.refresh();
      } catch (err: unknown) {
        alert((err as Error)?.message || "Failed to delete post");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blog Content Manager</h1>
          <p className="text-xs text-muted-foreground">
            Manage compliance articles, tutorials, SEO meta tags, and blog releases ({total} posts
            total).
          </p>
        </div>

        <Button asChild variant="brand" size="sm" className="rounded-xl">
          <Link href="/admin/blog/new">
            <Plus className="mr-1.5 size-4" />
            Create Article
          </Link>
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, slug, or category..."
            className="rounded-xl pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 text-xs">
          {["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                statusFilter === st
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st === "ALL" ? "All Posts" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        {filteredPosts.length === 0 ? (
          <div className="space-y-3 p-12 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground/60" />
            <p className="text-sm font-semibold">No blog posts found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search criteria or create a new blog article.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-subtle/60 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                <th className="px-5 py-3.5">Article</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Featured</th>
                <th className="px-5 py-3.5">Published Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="line-clamp-1 font-bold text-foreground">{post.title}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-2xs text-muted-foreground">
                        <span>/blog/{post.slug}</span>
                        <span>·</span>
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-2xs font-bold text-primary-ink">
                      {post.category}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleTogglePublish(post.id)}
                      disabled={isPending}
                      title="Click to toggle publish status"
                      className="cursor-pointer"
                    >
                      {post.status === "PUBLISHED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-2xs font-bold text-success-ink">
                          <CheckCircle className="size-3" />
                          Published
                        </span>
                      ) : post.status === "DRAFT" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-2xs font-bold text-amber-600 dark:text-amber-400">
                          <Clock className="size-3" />
                          Draft
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-2xs font-bold text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </button>
                  </td>

                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleToggleFeatured(post.id)}
                      disabled={isPending}
                      title="Toggle featured status"
                      className={`rounded-lg p-1.5 transition ${
                        post.isFeatured
                          ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Star className={`size-4 ${post.isFeatured ? "fill-amber-500" : ""}`} />
                    </button>
                  </td>

                  <td className="px-5 py-4 font-mono text-2xs text-muted-foreground">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Unpublished"}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {post.status === "PUBLISHED" && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg"
                          title="View on public site"
                        >
                          <Link href={`/blog/${post.slug}`} target="_blank">
                            <ExternalLink className="size-3.5 text-muted-foreground" />
                          </Link>
                        </Button>
                      )}

                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg"
                        title="Edit post"
                      >
                        <Link href={`/admin/blog/${post.id}/edit`}>
                          <Edit2 className="size-3.5 text-foreground" />
                        </Link>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(post.id, post.title)}
                        disabled={isPending}
                        className="size-8 rounded-lg text-destructive-ink hover:bg-destructive/10"
                        title="Delete post"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
