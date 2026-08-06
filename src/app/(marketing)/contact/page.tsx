import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock, LifeBuoy, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { PageHero } from "@/app/(marketing)/_components/page-hero";
import { ContactForm } from "@/features/support/presentation/contact-form";

export const metadata: Metadata = {
  title: "Contact Sales & Support",
  description:
    "Talk to the GSTPilot team about CA firm plans, bulk GSTR-1 generation, custom marketplace mappings or anything else. Most messages answered within one business day.",
  alternates: { canonical: "/contact" },
};

const CHANNELS = [
  {
    icon: Mail,
    title: "Email",
    body: "support@gstpilot.in",
    hint: "Best for anything with a file or screenshot attached.",
  },
  {
    icon: Clock,
    title: "Response time",
    body: "Within 1 business day",
    hint: "Payment problems are triaged ahead of everything else.",
  },
  {
    icon: ShieldCheck,
    title: "Your data",
    body: "Never shared",
    hint: "We only use what you send to answer your question.",
  },
];

const SELF_SERVE = [
  {
    icon: BookOpen,
    title: "Documentation",
    body: "Upload guides for every marketplace, plus the error centre reference.",
    href: "/docs",
    cta: "Browse the docs",
  },
  {
    icon: LifeBuoy,
    title: "Already a customer?",
    body: "Raise a support request from inside the app and track it to resolution.",
    href: "/support",
    cta: "Open support",
  },
];

export default function ContactPage() {
  return (
    <div className="pb-20">
      <PageHero
        eyebrow="Contact"
        title="Talk to a human who knows GST"
        description="Questions about CA firm plans, bulk generation, a marketplace we don't list yet, or anything else — this reaches the team directly."
      />

      <div className="mx-auto mt-8 grid max-w-5xl gap-6 px-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <Card variant="solid" className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary-ink ring-1 ring-primary/20">
              <MessageSquare className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Send us a message</h2>
              <p className="text-xs text-muted-foreground">
                You&rsquo;ll get a reference number to track it.
              </p>
            </div>
          </div>
          <ContactForm />
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card variant="subtle" className="divide-y divide-border p-0">
            {CHANNELS.map((c) => (
              <div key={c.title} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-card text-primary-ink ring-1 ring-border">
                  <c.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {c.title}
                  </p>
                  <p className="mt-0.5 text-sm font-medium break-words">{c.body}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
                </div>
              </div>
            ))}
          </Card>

          {SELF_SERVE.map((s) => (
            <Card key={s.title} variant="solid" interactive className="p-5">
              <Link href={s.href} className="block">
                <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary-ink ring-1 ring-primary/20">
                  <s.icon className="size-4" aria-hidden />
                </span>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                <p className="mt-2.5 text-xs font-semibold text-primary-ink">{s.cta} →</p>
              </Link>
            </Card>
          ))}
        </aside>
      </div>
    </div>
  );
}
