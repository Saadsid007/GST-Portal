import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, ShieldCheck, Lock, Star } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

const POINTS = [
  {
    title: "Unified Multi-Marketplace Sync",
    desc: "Amazon (B2B/B2C/MTR), Flipkart, Meesho, Myntra & JioMart consolidated into one return.",
  },
  {
    title: "100% Portal-Ready Offline JSON",
    desc: "Strictly matching the official GSTN offline utility schema for zero upload errors.",
  },
  {
    title: "Automated POS & HSN Validation",
    desc: "Returns netted, state place of supply mapped, and tax slabs verified automatically.",
  },
];

const PLATFORMS = ["Amazon", "Flipkart", "Meesho", "Myntra", "JioMart", "Custom Excel"];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      {/* ── Left Side: Visual Hero Image & Text Overlays ── */}
      <aside className="relative hidden overflow-hidden border-r border-blue-500/20 bg-[#060B18] text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-12">
        {/* Background Image with Layered Gradients */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
          <Image
            src="/auth-hero-backdrop.jpg"
            alt="GSTPilot Financial & Compliance Analytics"
            fill
            priority
            className="object-cover object-center opacity-35 brightness-90 contrast-110 filter"
          />
          {/* Gradients to blend seamlessly into dark aesthetic */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/75 to-[#060B18]/45" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060B18]/90 via-transparent to-[#060B18]/80" />
          <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-indigo-600/20 blur-3xl" />
        </div>

        {/* Top Header: Logo + Live Compliance Pill */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link href="/" className="w-fit transition hover:opacity-95" aria-label="GSTPilot home">
            <AppLogo size="lg" forceDark priority />
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-2xs font-extrabold text-blue-200 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span>CBIC GSTR-1 Verified Schema Engine</span>
          </div>
        </div>

        {/* Center Content: Eyebrow, Main Headline, Value Props & Marketplace badges */}
        <div className="relative z-10 max-w-lg space-y-7 py-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-0.5 text-2xs font-extrabold tracking-wider text-indigo-300 uppercase">
              <ShieldCheck className="size-3.5 text-indigo-400" />
              Enterprise GST Automation Platform
            </div>

            <h1 className="text-3xl leading-tight font-black tracking-tight text-white xl:text-4xl">
              Turn raw marketplace reports into{" "}
              <span className="bg-gradient-to-r from-blue-300 via-indigo-200 to-sky-300 bg-clip-text text-transparent">
                portal-ready GSTR-1 returns.
              </span>
            </h1>

            <p className="text-xs leading-relaxed text-blue-100/75">
              Reconcile thousands of orders from Amazon, Flipkart, Meesho, and your ERP in minutes
              with automated HSN verification and zero spreadsheet formulas.
            </p>
          </div>

          {/* 3 Checkpoints */}
          <ul className="space-y-3.5">
            {POINTS.map((point) => (
              <li key={point.title} className="flex items-start gap-3 text-xs">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                </div>
                <div>
                  <p className="font-bold text-white">{point.title}</p>
                  <p className="text-[11px] leading-relaxed text-blue-200/70">{point.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Supported Marketplaces Badge Strip */}
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md">
            <p className="text-[10px] font-extrabold tracking-wider text-blue-300 uppercase">
              Supported Sales &amp; Return Reports
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((platform) => (
                <span
                  key={platform}
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-2xs"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>

          {/* Social Proof / Testimonial Box */}
          <div className="rounded-2xl border border-blue-400/20 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-blue-950/40 p-4 backdrop-blur-md">
            <div className="mb-1.5 flex items-center gap-1 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-3 fill-amber-400" />
              ))}
              <span className="ml-1.5 text-2xs font-extrabold text-blue-200">5.0 / 5.0 Rating</span>
            </div>
            <p className="text-xs leading-relaxed text-blue-100 italic">
              &ldquo;Cut our monthly filing reconciliation time from 3 full days to under 15
              minutes. The error detection catches schema discrepancies before the GST portal
              does.&rdquo;
            </p>
            <p className="mt-2 text-[11px] font-semibold text-blue-300">
              — Senior Tax Partner &amp; E-Commerce Consultant, Mumbai
            </p>
          </div>
        </div>

        {/* Bottom Security Badges */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-blue-200/70">
          <div className="flex items-center gap-4 text-2xs font-bold">
            <span className="flex items-center gap-1.5">
              <Lock className="size-3 text-emerald-400" />
              256-Bit SSL Encrypted
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-blue-400" />
              ISO 27001 Standard
            </span>
            <span>·</span>
            <span>DPDP 2023 Compliant</span>
          </div>
          <span className="text-2xs text-blue-300/60">Trusted by 5,000+ businesses</span>
        </div>
      </aside>

      {/* ── Right Side: Form Container with Premium Layered Shadow ── */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8 lg:px-12">
        <div className="w-full max-w-[450px] space-y-6">
          {/* Mobile Logo View */}
          <div className="mx-auto block text-center lg:hidden">
            <Link href="/" className="inline-block" aria-label="GSTPilot home">
              <AppLogo size="lg" priority />
            </Link>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Official Multi-Marketplace GSTR-1 Automation
            </p>
          </div>

          {/* Elevated Floating Form Card with Soft Shadow */}
          <div className="relative rounded-3xl border border-border/80 bg-card p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12),0_10px_25px_-5px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] transition-all sm:p-9 dark:border-blue-500/25 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] dark:ring-white/[0.05]">
            {children}
          </div>

          {/* Secure Footer Note */}
          <p className="flex items-center justify-center gap-1.5 text-center text-2xs text-muted-foreground">
            <Lock className="size-3 text-muted-foreground" />
            <span>Bank-grade 256-bit SSL encrypted connection</span>
          </p>
        </div>
      </main>
    </div>
  );
}

/** A labelled input with the form's shared styling. */
export function AuthField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const authInputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-60";

export const authButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50";
