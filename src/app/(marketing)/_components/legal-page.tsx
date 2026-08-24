import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui";
import { SITE } from "@/config/site";
import { LEGAL_DOCUMENTS, POLICY_LAST_UPDATED, type LegalDocument } from "@/lib/seo/legal-data";
import { PageHero } from "@/app/(marketing)/_components/page-hero";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema } from "@/lib/seo/structured-data";

/**
 * One shell for every policy page, so Terms, Privacy, Refund, Delivery and
 * Disclaimer are structurally identical: same hero, same table of contents,
 * same numbering, same cross-links. Divergent legal pages look unmaintained,
 * which is exactly the wrong signal on the pages people read when deciding
 * whether to trust you with money.
 */

export function legalMetadata(doc: LegalDocument): Metadata {
  return {
    title: doc.metaTitle,
    description: doc.metaDescription,
    alternates: { canonical: `/${doc.slug}` },
    openGraph: {
      title: `${doc.metaTitle} | ${SITE.name}`,
      description: doc.metaDescription,
      url: `${SITE.url}/${doc.slug}`,
      type: "article",
    },
  };
}

export function LegalPage({ doc }: { doc: LegalDocument }) {
  const others = Object.values(LEGAL_DOCUMENTS).filter((d) => d.slug !== doc.slug);

  return (
    <div className="pb-20">
      {/* Declared once here rather than in each of the five policy pages, so a
          new policy inherits its breadcrumb by existing. */}
      <JsonLd
        schema={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: doc.title, path: `/${doc.slug}` },
        ])}
      />
      <PageHero eyebrow="Legal" title={doc.title} description={doc.summary} />

      <div className="mx-auto mt-6 grid max-w-5xl gap-8 px-6 lg:grid-cols-[15rem_1fr] lg:items-start">
        {/* Contents. Long-form legal text is unusable without a way in. */}
        <nav aria-label="On this page" className="lg:sticky lg:top-24">
          <Card variant="subtle" className="p-4">
            <p className="mb-2 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              On this page
            </p>
            <ol className="space-y-1.5">
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block text-xs leading-snug text-muted-foreground transition-colors hover:text-primary-ink"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </Card>
        </nav>

        <article className="min-w-0">
          <Card variant="solid" className="p-6 sm:p-9">
            <p className="mb-6 border-b border-border pb-4 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Last updated {POLICY_LAST_UPDATED}
            </p>

            <div className="prose-content">
              {doc.sections.map((section) => (
                <section key={section.id} className="scroll-mt-24" id={section.id}>
                  <h2>{section.heading}</h2>
                  {section.body?.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul>
                      {section.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </Card>

          {/* Every policy links to the others — people arrive on one and need
              the set. */}
          <div className="mt-6">
            <p className="mb-2.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              Related policies
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {others.map((d) => (
                <Link key={d.slug} href={`/${d.slug}`}>
                  <Card variant="solid" interactive className="flex items-center gap-2.5 p-3">
                    <FileText className="size-4 flex-shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{d.title}</span>
                      <span className="block truncate text-2xs text-muted-foreground">
                        {d.summary}
                      </span>
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
