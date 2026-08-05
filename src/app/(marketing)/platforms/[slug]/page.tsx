import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PLATFORMS_SEO_DATA } from "@/lib/seo/platforms-data";
import { Zap, CheckCircle, ShieldCheck, FileCheck } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const plat = PLATFORMS_SEO_DATA[slug];
  if (!plat) return {};

  return {
    title: plat.metaTitle,
    description: plat.metaDescription,
    openGraph: {
      title: plat.metaTitle,
      description: plat.metaDescription,
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(PLATFORMS_SEO_DATA).map((slug) => ({ slug }));
}

export default async function PlatformDetailPage({ params }: Props) {
  const { slug } = await params;
  const plat = PLATFORMS_SEO_DATA[slug];
  if (!plat) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: plat.name,
    applicationCategory: "BusinessApplication",
    description: plat.description,
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: plat.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero Header */}
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          {plat.badge}
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{plat.name}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{plat.tagline}</p>
        <div className="pt-2">
          <Link
            href="/convert"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
          >
            <Zap className="size-4" /> Start Free {plat.name.split(" ")[0]} Conversion
          </Link>
        </div>
      </div>

      {/* Required Reports & Workflow */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <FileCheck className="size-5 text-success" /> Supported & Required Reports
          </h2>
          <div className="space-y-3">
            {plat.requiredFiles.map((f) => (
              <div key={f.name} className="space-y-0.5 rounded-xl bg-muted/40 p-3 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span>{f.name}</span>
                  <span
                    className={
                      f.required
                        ? "font-bold text-destructive uppercase"
                        : "text-muted-foreground uppercase"
                    }
                  >
                    {f.required ? "Required" : "Optional"}
                  </span>
                </div>
                <p className="text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ShieldCheck className="size-5 text-primary-ink" /> Key Automation Features
          </h2>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {plat.keyFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2">
                <CheckCircle className="size-4 flex-shrink-0 text-success" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Workflow */}
      <div className="space-y-6 rounded-3xl border border-border bg-card p-8 shadow-sm">
        <h2 className="text-xl font-bold">Conversion Workflow</h2>
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-4">
          {plat.workflowSteps.map((step, idx) => (
            <div key={idx} className="space-y-2 rounded-2xl bg-muted/40 p-4">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {idx + 1}
              </span>
              <p className="leading-relaxed text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-6">
        <h2 className="text-center text-xl font-bold">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {plat.faqs.map((f, i) => (
            <div key={i} className="space-y-1 rounded-2xl border border-border bg-card p-5 text-xs">
              <p className="text-sm font-bold text-foreground">{f.question}</p>
              <p className="leading-relaxed text-muted-foreground">{f.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
