import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Server, KeyRound, Trash2, FileCheck2, EyeOff, ArrowRight } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { PageHero } from "@/app/(marketing)/_components/page-hero";

export const metadata: Metadata = {
  title: "Security Model & Infrastructure",
  description:
    "How GSTPilot protects your tax data: TLS 1.3 in transit, isolated processing, least-privilege access and no third-party data sharing.",
  alternates: { canonical: "/security" },
};

const CONTROLS = [
  {
    icon: Lock,
    title: "Encrypted in transit",
    body: "Every upload and API request travels over HTTPS using modern TLS 1.3. Nothing about your sales data crosses the wire in the clear.",
  },
  {
    icon: Server,
    title: "Isolated processing",
    body: "Uploaded workbooks are parsed in isolated worker sessions scoped to your request, so one account's files are never in reach of another's.",
  },
  {
    icon: EyeOff,
    title: "Never sold, never shared",
    body: "Your sales figures are used for exactly one thing — producing your return. They are not sold, brokered or shared with third parties.",
  },
  {
    icon: KeyRound,
    title: "Least-privilege access",
    body: "Administrative roles are read from the database on every request rather than trusted from a session, so revoking access takes effect immediately.",
  },
  {
    icon: FileCheck2,
    title: "Audited changes",
    body: "Pricing, wallet and credit adjustments are written to an audit log recording which administrator made each change.",
  },
  {
    icon: Trash2,
    title: "Minimal retention",
    body: "We keep the metadata needed to show your filing history. Raw uploads are not retained beyond the processing they were provided for.",
  },
];

export default function SecurityPage() {
  return (
    <div className="pb-20">
      <PageHero
        eyebrow="Security model"
        title="Built for data you can't afford to leak"
        description="GSTPilot handles turnover, invoice values and GSTINs. Here is exactly how that data is treated."
      />

      <section className="mx-auto max-w-5xl px-6 pt-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((c) => (
            <Card key={c.title} variant="solid" className="h-full p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary-ink ring-1 ring-primary/20">
                <c.icon className="size-5" aria-hidden />
              </div>
              <h2 className="text-sm font-semibold">{c.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pt-12">
        <Card variant="subtle" className="p-6 sm:p-8">
          <h2 className="text-base font-semibold">Responsible disclosure</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If you believe you have found a vulnerability, please report it privately before
            disclosing it publicly. We will acknowledge your report and keep you updated while we
            investigate.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/contact">
              Report a security issue
              <ArrowRight />
            </Link>
          </Button>
        </Card>
      </section>
    </div>
  );
}
