import type { Metadata } from "next";
import Link from "next/link";
import { DOCS_DATA } from "@/lib/seo/docs-data";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation Portal & Guides | GSTPilot",
  description:
    "Comprehensive guides for uploading Amazon, Meesho, and Flipkart reports, fixing GSTIN errors, and reconciling TCS.",
};

export default function DocsPage() {
  const docs = Object.values(DOCS_DATA);

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 py-16">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary uppercase">
          Documentation Portal
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          GSTPilot Guides & Documentation
        </h1>
        <p className="text-sm text-muted-foreground">
          Step-by-step tutorials and reference guides for marketplace GST filing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="group flex flex-col justify-between space-y-3 rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/50 hover:bg-accent/40"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-primary">
                  {doc.category}
                </span>
                <span className="font-mono text-muted-foreground">{doc.readTime}</span>
              </div>
              <h2 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                {doc.title}
              </h2>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {doc.description}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs font-bold text-primary">
              <span>Read Guide</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
