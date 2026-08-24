import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The one Markdown renderer.
 *
 * Blog posts, docs pages and the admin editor's preview all previously printed
 * their Markdown source through `whitespace-pre-line`, so a `## Heading` reached
 * the reader as the literal characters "## Heading" — the editor's formatting
 * toolbar wrote syntax that nothing ever interpreted.
 *
 * Raw HTML is deliberately NOT enabled (no rehype-raw): post content is stored
 * in the database and rendered on public pages, so allowing embedded HTML would
 * turn the admin editor into a stored-XSS vector the moment an author account is
 * compromised. Markdown alone covers everything the toolbar can produce.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        // Tailwind Typography handles the element rhythm; the overrides below are
        // only where the default clashes with this app's tokens.
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:scroll-mt-24 prose-headings:font-bold prose-headings:tracking-tight",
        "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base",
        "prose-p:text-foreground/90 prose-li:text-foreground/90",
        "prose-strong:font-semibold prose-strong:text-foreground",
        "prose-a:font-medium prose-a:text-primary-ink prose-a:underline-offset-2",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:border prose-pre:border-border prose-pre:bg-subtle",
        "prose-blockquote:border-l-primary/40 prose-blockquote:not-italic",
        "prose-img:rounded-xl prose-hr:border-border",
        "prose-table:text-sm prose-th:text-foreground",
        className
      )}
    >
      <ReactMarkdown
        // GFM adds the pieces authors actually reach for: tables, strikethrough,
        // task lists and bare-URL autolinking.
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            const url = href ?? "";
            const isInternal = url.startsWith("/") || url.startsWith("#");

            // Internal links go through next/link so navigation stays client-side;
            // external ones get noopener, which is required whenever target=_blank.
            if (isInternal) {
              return (
                <Link href={url} {...props}>
                  {children}
                </Link>
              );
            }
            return (
              <a href={url} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
