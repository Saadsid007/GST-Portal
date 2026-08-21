import Link from "next/link";
import {
  ArrowRight,
  Check,
  X,
  ShieldCheck,
  Zap,
  Wand2,
  Layers,
  FileJson,
  GitMerge,
  Scale,
  Clock,
  Lock,
  Star,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ── Workflow ───────────────────────────────────────────────────────────── */

const WORKFLOW = [
  { icon: Layers, title: "Upload", body: "Drop exports from every marketplace you sell on." },
  {
    icon: ShieldCheck,
    title: "Validate",
    body: "GSTIN, HSN, state codes and rates checked on the way in.",
  },
  {
    icon: GitMerge,
    title: "Merge & net",
    body: "Sales and returns reconciled into true net sales.",
  },
  {
    icon: Wand2,
    title: "Transform",
    body: "Tax split into IGST or CGST + SGST per place of supply.",
  },
  { icon: FileJson, title: "Download", body: "GSTN-ready JSON plus a multi-sheet Excel workbook." },
];

export function WorkflowSection() {
  return (
    <Section
      eyebrow="How it works"
      title="Five steps between the export and the portal"
      description="No templates to maintain, no formulas to babysit. The same pipeline runs on every marketplace."
    >
      <ol className="relative grid gap-4 md:grid-cols-5">
        {/* Connector rail, desktop only. */}
        <div
          aria-hidden
          className="absolute top-9 right-[10%] left-[10%] hidden h-px bg-gradient-to-r from-transparent via-border-strong to-transparent md:block"
        />
        {WORKFLOW.map((step, i) => (
          <li key={step.title} className="relative">
            <Card variant="solid" className="h-full p-5 text-center">
              <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary-ink ring-1 ring-primary/20">
                <step.icon className="size-5" aria-hidden />
              </div>
              <p className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                Step {i + 1}
              </p>
              <p className="mt-0.5 text-sm font-semibold">{step.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ── Features ───────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: GitMerge,
    title: "Net sales engine",
    body: "Refunds and cancellations are matched to their original shipment and subtracted, so you stop paying tax on goods that came back.",
    stat: "Sales − returns, automatically",
  },
  {
    icon: Layers,
    title: "Multi-marketplace merge",
    body: "Amazon, Flipkart, Meesho, Myntra, JioMart and more combine into a single return, deduplicated by invoice.",
    stat: "10 platforms supported",
  },
  {
    icon: Wand2,
    title: "One-click auto-fixers",
    body: "Malformed GSTINs, missing state codes and out-of-range HSN codes are flagged with a suggested fix you can apply in a click.",
    stat: "Fix errors before GSTN does",
  },
  {
    icon: Scale,
    title: "TCS section 52 reconciliation",
    body: "State-wise TCS collected by each operator, reconciled against your own figures so the mismatch shows up here, not in a notice.",
    stat: "State-wise breakdown",
  },
  {
    icon: FileJson,
    title: "Government-ready output",
    body: "GSTN v3.0 schema JSON for direct upload, plus a multi-sheet Excel workbook your CA can actually review.",
    stat: "JSON + Excel, every time",
  },
  {
    icon: Clock,
    title: "Minutes, not evenings",
    body: "A month of multi-marketplace sales goes from a two-to-four hour spreadsheet session to a single pass.",
    stat: "Under 5 seconds to process",
  },
];

export function FeaturesSection() {
  return (
    <Section
      eyebrow="Built for e-commerce GST"
      title="The parts that make marketplace GST painful"
      description="Every feature exists because a seller or CA lost hours to it."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} variant="solid" interactive className="group p-6">
            <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary-ink ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
              <f.icon className="size-5" aria-hidden />
            </div>
            <h3 className="text-sm font-semibold">{f.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
            <p className="mt-4 border-t border-border pt-3 text-2xs font-semibold text-primary-ink">
              {f.stat}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

/* ── Comparison ─────────────────────────────────────────────────────────── */

const COMPARISON = [
  { feature: "Time per monthly return", manual: "2–4 hours", pilot: "Under 5 seconds" },
  {
    feature: "Combining marketplaces",
    manual: "Manual copy-paste",
    pilot: "One-click merge engine",
  },
  {
    feature: "Sales returns (net sales)",
    manual: "Error-prone formulas",
    pilot: "Automatic net sales engine",
  },
  { feature: "State code mapping", manual: "Looked up by hand", pilot: "Resolved on every row" },
  { feature: "TCS section 52 reconciliation", manual: "Not attempted", pilot: "State-wise module" },
  {
    feature: "Validation before filing",
    manual: "Discovered on the portal",
    pilot: "Caught in the error centre",
  },
  { feature: "Output format", manual: "Hand-built sheet", pilot: "GSTN JSON + Excel" },
];

export function ComparisonSection() {
  return (
    <Section
      eyebrow="Why switch"
      title="Manual filing vs GSTPilot"
      description="The same return, both ways."
    >
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border bg-subtle text-2xs tracking-wide text-muted-foreground uppercase">
              <th className="px-5 py-3.5 text-left font-semibold">What you deal with</th>
              <th className="px-5 py-3.5 text-center font-semibold">Manual / spreadsheets</th>
              <th className="px-5 py-3.5 text-center font-semibold text-primary-ink">GSTPilot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {COMPARISON.map((row) => (
              <tr key={row.feature} className="transition-colors hover:bg-accent/40">
                <td className="px-5 py-3 text-xs font-medium">{row.feature}</td>
                <td className="px-5 py-3 text-center text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <X className="size-3.5 text-destructive-ink" aria-hidden />
                    {row.manual}
                  </span>
                </td>
                <td className="px-5 py-3 text-center text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-success" aria-hidden />
                    {row.pilot}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ── Testimonials ───────────────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote:
      "We sell on four marketplaces. Reconciling returns used to take most of a Saturday — now the net sales figure is just correct when the file comes out.",
    name: "Priya Raghavan",
    role: "Founder, D2C apparel brand",
    initials: "PR",
  },
  {
    quote:
      "The error centre is the part I care about. Bad GSTINs and state codes surface before the portal rejects the upload, not after.",
    name: "Anand Mehta",
    role: "Chartered Accountant",
    initials: "AM",
  },
  {
    quote:
      "TCS reconciliation state-wise was the thing no other tool did. That alone justified moving our client filings over.",
    name: "Sneha Kulkarni",
    role: "Partner, tax practice",
    initials: "SK",
  },
];

export function TestimonialsSection() {
  return (
    <Section
      eyebrow="From sellers and CAs"
      title="Built with the people who file every month"
      description="Representative feedback from early GSTPilot users."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <Card key={t.name} variant="solid" className="flex flex-col p-6">
            <div className="mb-3 flex gap-0.5" aria-label="5 out of 5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-warning text-warning" aria-hidden />
              ))}
            </div>
            <blockquote className="flex-1 text-xs leading-relaxed text-muted-foreground">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-2xs font-bold text-primary-ink ring-1 ring-primary/20">
                {t.initials}
              </span>
              <div>
                <p className="text-xs font-semibold">{t.name}</p>
                <p className="text-2xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}

/* ── FAQ ────────────────────────────────────────────────────────────────── */

export const FAQS = [
  {
    q: "Which marketplaces does GSTPilot support?",
    a: "Amazon (MTR B2B and B2C, including v3), Flipkart, Meesho, Myntra, JioMart, Shopdeck, GlowRoad, Snapdeal and Roposo Clout. Any other platform can be handled through the universal custom Excel mapper.",
  },
  {
    q: "Does it calculate net sales after returns?",
    a: "Yes. The net sales engine matches refund and cancellation rows back to their original shipment and subtracts them, so you are not paying GST on goods that were returned.",
  },
  {
    q: "Is the output accepted by the GST portal?",
    a: "GSTPilot generates JSON against the GSTN v3.0 schema for direct upload, alongside a multi-sheet Excel workbook for review. Validation runs before generation so schema errors surface here rather than on the portal.",
  },
  {
    q: "How much does it cost?",
    a: "GSTPilot uses simple, GSTIN-based subscription pricing starting at ₹79/month for 10 GSTINs. All GSTR-1 return generations on active plans are 100% UNLIMITED with zero per-report charges.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes! Every new account starts with a full 30-Day Free Trial including 7 GSTIN client capacity and unlimited, watermark-free GSTR-1 JSON and Excel generation without entering any credit card.",
  },
  {
    q: "What happens to my sales data?",
    a: "Files are processed over an encrypted connection and used only to produce your return. See the security page for the full data handling model.",
  },
  {
    q: "Does it handle TCS under section 52?",
    a: "Yes. TCS collected by each e-commerce operator is reconciled state-wise against your own figures, so mismatches are visible before you file.",
  },
];

export function FaqSection() {
  return (
    <Section
      eyebrow="Questions"
      title="Frequently asked"
      description="Still unsure? The documentation goes deeper, and sales will answer anything it doesn't cover."
    >
      <div className="mx-auto max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold transition-colors hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
              {faq.q}
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="px-5 pb-4 text-xs leading-relaxed text-muted-foreground">{faq.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ── Closing CTA ────────────────────────────────────────────────────────── */

export function ClosingCta() {
  return (
    <section className="mx-auto max-w-5xl px-6">
      <div className="relative overflow-hidden rounded-3xl brand-gradient px-8 py-14 text-center shadow-xl md:px-14">
        <div aria-hidden className="absolute inset-0 grid-lines opacity-20 mix-blend-overlay" />
        <div className="relative space-y-5">
          <h2 className="text-3xl font-bold tracking-tight text-balance text-primary-foreground sm:text-4xl">
            File your next GSTR-1 in minutes
          </h2>
          <p className="mx-auto max-w-xl text-sm text-primary-foreground/80">
            30-day free trial with 7 GSTINs. Unlimited returns, no card required, no spreadsheet surgery.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row">
            <Button asChild size="xl" className="bg-background text-foreground hover:bg-card">
              <Link href="/register">
                <Zap />
                Start 30-Day Free Trial
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/contact">Talk to sales</Link>
            </Button>
          </div>
          <p className="flex items-center justify-center gap-1.5 pt-1 text-2xs text-primary-foreground/70">
            <Lock className="size-3" aria-hidden />
            Encrypted in transit · your data is never sold
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Shared shell ───────────────────────────────────────────────────────── */

export function Section({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto max-w-7xl space-y-10 px-6", className)}>
      <div className="mx-auto max-w-2xl space-y-2.5 text-center">
        {eyebrow && (
          <Badge variant="primary" size="md">
            {eyebrow}
          </Badge>
        )}
        <h2 className="text-3xl font-bold tracking-tight text-balance">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
