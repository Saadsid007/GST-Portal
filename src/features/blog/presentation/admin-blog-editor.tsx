"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Eye,
  Edit3,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Globe,
  Tag,
  Folder,
} from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { SITE } from "@/config/site";
import { BLOG_CATEGORIES, type BlogPostItem } from "@/features/blog/types/blog.types";
import { createBlogAction, updateBlogAction } from "@/features/blog/actions/blog.actions";
import { calculateReadTime, generateSlug } from "@/features/blog/utils/blog.utils";

interface AdminBlogEditorProps {
  initialPost?: BlogPostItem | null;
}

export function AdminBlogEditor({ initialPost }: AdminBlogEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"write" | "preview" | "seo">("write");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [slug, setSlug] = useState(initialPost?.slug ?? "");
  const [autoSlug, setAutoSlug] = useState(!initialPost);
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [coverImage, setCoverImage] = useState(initialPost?.coverImage ?? "");
  const [category, setCategory] = useState(initialPost?.category ?? "Compliance");
  const [tagsInput, setTagsInput] = useState(initialPost?.tags?.join(", ") ?? "GST, E-Commerce");
  const [author, setAuthor] = useState(initialPost?.author ?? "GSTPilot Editorial Team");
  const [authorRole, setAuthorRole] = useState(
    initialPost?.authorRole ?? "GST Compliance Specialist"
  );
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">(
    initialPost?.status ?? "DRAFT"
  );
  const [isFeatured, setIsFeatured] = useState(initialPost?.isFeatured ?? false);

  // SEO State
  const [metaTitle, setMetaTitle] = useState(initialPost?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initialPost?.metaDescription ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(initialPost?.canonicalUrl ?? "");

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (autoSlug) {
      setSlug(generateSlug(val));
    }
  };

  const insertFormatting = (prefix: string, suffix: string = "") => {
    const textarea = document.getElementById("blog-content-editor") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || "text";
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 50);
  };

  const handleInsertImage = () => {
    const url = prompt("Enter image URL (e.g. https://images.unsplash.com/...):");
    if (url) {
      insertFormatting(`\n![Image Alt](${url})\n`);
    }
  };

  const handleInsertLink = () => {
    const url = prompt("Enter hyperlink URL:");
    if (url) {
      insertFormatting("[", `](${url})`);
    }
  };

  const handleSave = (targetStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
    setError(null);
    setSuccess(null);

    const saveStatus = targetStatus ?? status;

    if (!title.trim()) {
      setError("Please enter a blog post title.");
      return;
    }

    if (!slug.trim()) {
      setError("Please specify a URL slug.");
      return;
    }

    if (!excerpt.trim()) {
      setError("Please enter a short excerpt for card previews.");
      return;
    }

    if (!content.trim()) {
      setError("Blog post content cannot be empty.");
      return;
    }

    const tagsArr = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title,
      slug,
      excerpt,
      content,
      coverImage: coverImage || undefined,
      category,
      tags: tagsArr,
      author,
      authorRole,
      readTime: calculateReadTime(content),
      status: saveStatus,
      isFeatured,
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
      canonicalUrl: canonicalUrl || undefined,
    };

    startTransition(async () => {
      try {
        if (initialPost?.id) {
          await updateBlogAction(initialPost.id, payload);
          setSuccess("Blog post updated successfully!");
        } else {
          await createBlogAction(payload);
          setSuccess("Blog post created successfully!");
          setTimeout(() => {
            router.push("/admin/blog");
          }, 800);
        }
      } catch (err: unknown) {
        setError((err as Error)?.message || "Failed to save blog post. Check inputs.");
      }
    });
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/admin/blog")}
            className="size-9 rounded-xl"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {initialPost ? "Edit Blog Post" : "Create New Blog Post"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Write, format, optimize SEO and publish compliance guides.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave("DRAFT")}
            disabled={isPending}
            className="rounded-xl"
          >
            Save Draft
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={() => handleSave("PUBLISHED")}
            disabled={isPending}
            className="rounded-xl"
          >
            <Save className="mr-1.5 size-4" />
            {isPending ? "Saving..." : "Publish Post"}
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive-ink">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 p-4 text-xs text-success-ink">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Editor (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Title & Slug */}
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="space-y-2">
              <label htmlFor="post-title" className="block text-xs font-semibold">
                Article Title <span className="text-destructive-ink">*</span>
              </label>
              <Input
                id="post-title"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleTitleChange(e.target.value)
                }
                placeholder="e.g. How to File GSTR-1 for Amazon Seller MTR Reports in 2025"
                className="rounded-xl text-base font-medium"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs">
                <label htmlFor="post-slug" className="block text-xs font-semibold">
                  URL Slug
                </label>
                <button
                  type="button"
                  onClick={() => setAutoSlug(!autoSlug)}
                  className="font-mono text-primary-ink hover:underline"
                >
                  {autoSlug ? "Auto-generating" : "Custom slug"}
                </button>
              </div>
              <div className="flex items-center rounded-xl border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
                <span className="text-muted-foreground select-none">/blog/</span>
                <input
                  id="post-slug"
                  value={slug}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setAutoSlug(false);
                    setSlug(e.target.value);
                  }}
                  placeholder="amazon-mtr-gstr1-guide"
                  className="flex-1 bg-transparent font-mono text-foreground outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="post-excerpt" className="block text-xs font-semibold">
                Short Excerpt (Card Summary) <span className="text-destructive-ink">*</span>
              </label>
              <Textarea
                id="post-excerpt"
                rows={2}
                value={excerpt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExcerpt(e.target.value)}
                placeholder="A concise summary of the article displayed on search engines &amp; post cards..."
                className="rounded-xl text-xs leading-relaxed"
              />
            </div>
          </div>

          {/* Content Tabs Header */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border bg-subtle/50 px-4 py-2.5">
              <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("write")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                    activeTab === "write"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Edit3 className="size-3.5" />
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                    activeTab === "preview"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="size-3.5" />
                  Preview Mode
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("seo")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                    activeTab === "seo"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe className="size-3.5" />
                  SEO &amp; Meta
                </button>
              </div>

              {activeTab === "write" && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => insertFormatting("**", "**")}
                    title="Bold"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <Bold className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("*", "*")}
                    title="Italic"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <Italic className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("## ")}
                    title="Heading 2"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <Heading2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("### ")}
                    title="Heading 3"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <Heading3 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("- ")}
                    title="Bullet List"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <List className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("1. ")}
                    title="Numbered List"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <ListOrdered className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("> ")}
                    title="Quote"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <Quote className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("```\n", "\n```")}
                    title="Code Block"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <Code className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertLink}
                    title="Insert Link"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <LinkIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertImage}
                    title="Insert Image"
                    className="rounded-lg p-1.5 hover:bg-accent hover:text-foreground"
                  >
                    <ImageIcon className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Tab 1: Write */}
            {activeTab === "write" && (
              <div className="p-4">
                <Textarea
                  id="blog-content-editor"
                  rows={22}
                  value={content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setContent(e.target.value)
                  }
                  placeholder="Write your article content using Markdown or HTML text..."
                  className="resize-y border-none font-mono text-xs leading-relaxed focus-visible:ring-0"
                />
              </div>
            )}

            {/* Tab 2: Preview */}
            {activeTab === "preview" && (
              <div className="prose dark:prose-invert min-h-[400px] max-w-none p-8 text-sm">
                {content ? (
                  <div className="leading-relaxed whitespace-pre-line">{content}</div>
                ) : (
                  <p className="py-12 text-center text-muted-foreground italic">
                    Start typing content in the editor tab to see live preview here...
                  </p>
                )}
              </div>
            )}

            {/* Tab 3: SEO */}
            {activeTab === "seo" && (
              <div className="space-y-6 p-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-2xs">
                    <label htmlFor="meta-title" className="block text-xs font-semibold">
                      Meta Title (Search Engine Display)
                    </label>
                    <span
                      className={
                        metaTitle.length > 60 ? "font-bold text-amber-500" : "text-muted-foreground"
                      }
                    >
                      {metaTitle.length} / 60 chars
                    </span>
                  </div>
                  <Input
                    id="meta-title"
                    value={metaTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setMetaTitle(e.target.value)
                    }
                    placeholder={title || "SEO optimized title..."}
                    className="rounded-xl text-xs"
                  />
                  <p className="text-2xs text-muted-foreground">
                    If left blank, article title will be used. Optimal length is 50-60 characters.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-2xs">
                    <label htmlFor="meta-desc" className="block text-xs font-semibold">
                      Meta Description (Snippet)
                    </label>
                    <span
                      className={
                        metaDescription.length > 160
                          ? "font-bold text-amber-500"
                          : "text-muted-foreground"
                      }
                    >
                      {metaDescription.length} / 160 chars
                    </span>
                  </div>
                  <Textarea
                    id="meta-desc"
                    rows={3}
                    value={metaDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setMetaDescription(e.target.value)
                    }
                    placeholder={excerpt || "Search result summary description..."}
                    className="rounded-xl text-xs"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Optimal length is 140-160 characters for high search CTR on Google.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="canonical-url" className="block text-xs font-semibold">
                    Canonical URL (Optional)
                  </label>
                  <Input
                    id="canonical-url"
                    value={canonicalUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCanonicalUrl(e.target.value)
                    }
                    placeholder={`${SITE.url}/blog/...`}
                    className="rounded-xl text-xs"
                  />
                </div>

                {/* Google Search Preview Card */}
                <div className="space-y-1 rounded-xl border border-border bg-card p-4">
                  <span className="mb-2 block text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Google Search Result Mockup
                  </span>
                  <div className="font-mono text-2xs text-emerald-600 dark:text-emerald-400">
                    {SITE.url.replace(/^https?:\/\//, "")} › blog › {slug || "your-post-slug"}
                  </div>
                  <div className="line-clamp-1 cursor-pointer text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
                    {metaTitle || title || "Your Article Title Will Appear Here"}
                  </div>
                  <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {metaDescription ||
                      excerpt ||
                      "Your article meta description snippet will be rendered here for Google search visitors."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Settings (1 col) */}
        <div className="space-y-6">
          {/* Post Settings */}
          <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Folder className="size-4 text-primary-ink" />
              Publishing Options
            </h2>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">Post Status</label>
              <select
                value={status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStatus(e.target.value as "DRAFT" | "PUBLISHED" | "ARCHIVED")
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary"
              >
                <option value="DRAFT">📝 Draft</option>
                <option value="PUBLISHED">🚀 Published</option>
                <option value="ARCHIVED">📦 Archived</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">Category</label>
              <select
                value={category}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary"
              >
                {BLOG_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">Tags (Comma Separated)</label>
              <Input
                value={tagsInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagsInput(e.target.value)}
                placeholder="GST, Amazon, GSTR-1"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <div>
                <label htmlFor="featured-toggle" className="block text-xs font-semibold">
                  Featured Article
                </label>
                <span className="text-2xs text-muted-foreground">
                  Highlight on top of blog index
                </span>
              </div>
              <input
                id="featured-toggle"
                type="checkbox"
                checked={isFeatured}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setIsFeatured(e.target.checked)
                }
                className="size-4 cursor-pointer rounded accent-primary"
              />
            </div>
          </div>

          {/* Media & Author */}
          <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Tag className="size-4 text-primary-ink" />
              Cover Image &amp; Author
            </h2>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">Cover Image URL</label>
              <Input
                value={coverImage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCoverImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="rounded-xl text-xs"
              />
              {coverImage && (
                <div className="relative mt-2 aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImage} alt="Cover preview" className="size-full object-cover" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">Author Name</label>
              <Input
                value={author}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthor(e.target.value)}
                placeholder="GSTPilot Editorial Team"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">Author Role</label>
              <Input
                value={authorRole}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthorRole(e.target.value)}
                placeholder="GST Compliance Specialist"
                className="rounded-xl text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
