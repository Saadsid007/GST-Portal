import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DOCS_DATA } from "@/lib/seo/docs-data";
import { ChevronRight, BookOpen, Clock, ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS_DATA[slug];
  if (!doc) return {};

  return {
    title: doc.metaTitle,
    description: doc.metaDescription,
  };
}

export async function generateStaticParams() {
  return Object.keys(DOCS_DATA).map((slug) => ({ slug }));
}

export default async function DocDetailPage({ params }: Props) {
  const { slug } = await params;
  const doc = DOCS_DATA[slug];
  if (!doc) notFound();

  const allDocs = Object.values(DOCS_DATA);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://gstpilot.in" },
      { "@type": "ListItem", position: 2, name: "Docs", item: "https://gstpilot.in/docs" },
      {
        "@type": "ListItem",
        position: 3,
        name: doc.title,
        item: `https://gstpilot.in/docs/${doc.slug}`,
      },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Sidebar Navigation */}
        <aside className="hidden space-y-6 border-border pr-6 lg:block lg:border-r">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            <BookOpen className="size-4 text-primary" /> Documentation
          </div>
          <nav className="space-y-1 text-xs">
            {allDocs.map((item) => (
              <Link
                key={item.slug}
                href={`/docs/${item.slug}`}
                className={`block rounded-xl px-3 py-2 font-medium transition ${
                  item.slug === slug
                    ? "bg-primary font-bold text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Doc Content Area */}
        <main className="space-y-6 lg:col-span-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <ChevronRight className="size-3" />
            <Link href="/docs" className="hover:underline">
              Docs
            </Link>
            <ChevronRight className="size-3" />
            <span className="truncate font-semibold text-foreground">{doc.title}</span>
          </div>

          {/* Title Header */}
          <div className="space-y-2 border-b border-border pb-6">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {doc.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" /> {doc.readTime}
              </span>
            </div>
            <h1 className="pt-1 text-2xl font-extrabold tracking-tight sm:text-4xl">{doc.title}</h1>
            <p className="text-sm text-muted-foreground">{doc.description}</p>
          </div>

          {/* Article Body */}
          <article className="prose dark:prose-invert max-w-none space-y-4 text-xs leading-relaxed sm:text-sm">
            <div className="whitespace-pre-line text-foreground/90">{doc.content}</div>
          </article>

          {/* Bottom Nav */}
          <div className="flex items-center justify-between border-t border-border pt-8">
            <Link
              href="/docs"
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Back to Docs Index
            </Link>
            <Link
              href="/convert"
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <span>Start Free Conversion</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
