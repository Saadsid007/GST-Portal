import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, ShieldCheck, Lock } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

const HIGHLIGHTS = [
  "Multi-marketplace sync (Amazon, Flipkart, Meesho & JioMart)",
  "100% portal-ready JSON matching the official GSTN offline schema",
  "Automated state POS mapping, credit note netting & HSN validation",
];

const PLATFORMS = ["Amazon", "Flipkart", "Meesho", "Myntra", "JioMart"];

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
            // Decorative, 30% opacity, and the panel is hidden below lg — no
            // preload, so phones never download it.
            sizes="(min-width: 1280px) 55vw, 52vw"
            quality={60}
            className="object-cover object-center opacity-30 brightness-90 contrast-110 filter"
          />
          {/* Gradients to blend seamlessly into dark aesthetic */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060B18] via-[#060B18]/80 to-[#060B18]/50" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060B18]/90 via-transparent to-[#060B18]/85" />
          <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-indigo-600/20 blur-3xl" />
        </div>

        {/* Top Header: Logo + Live Compliance Pill */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link href="/" className="w-fit transition hover:opacity-95" aria-label="GSTPilot home">
            <AppLogo size="lg" forceDark priority />
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-2xs font-bold text-blue-200 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span>CBIC GSTR-1 Verified Engine</span>
          </div>
        </div>

        {/* Center Content: Balanced, Airy & Elegant */}
        <div className="relative z-10 my-auto max-w-lg space-y-7 py-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-2xs font-bold tracking-wide text-indigo-300 uppercase">
              <ShieldCheck className="size-3.5 text-indigo-400" />
              Enterprise GST Automation
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl xl:text-[2rem] xl:leading-snug">
              Turn raw marketplace reports into{" "}
              <span className="bg-gradient-to-r from-blue-300 via-indigo-200 to-sky-300 bg-clip-text text-transparent">
                portal-ready GSTR-1 returns.
              </span>
            </h1>

            <p className="text-xs leading-relaxed text-blue-100/75 sm:text-sm">
              Reconcile thousands of e-commerce orders, returns, and tax slabs in seconds with
              automated HSN validation and zero spreadsheet formulas.
            </p>
          </div>

          {/* Crisp Benefits Checklist */}
          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-xs text-blue-100/90 sm:text-[13px]"
              >
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* Clean Supported Channels Row */}
          <div className="space-y-2 pt-1">
            <p className="text-2xs font-bold tracking-wider text-blue-300/75 uppercase">
              Reconciles All Major Sales Channels
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {PLATFORMS.map((platform) => (
                <span
                  key={platform}
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white/90 shadow-2xs backdrop-blur-sm"
                >
                  {platform}
                </span>
              ))}
              <span className="rounded-lg border border-dashed border-white/20 px-2.5 py-1 text-xs font-medium text-blue-200/70">
                + Custom ERP
              </span>
            </div>
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
          <span className="text-2xs text-blue-300/60">5,000+ returns processed</span>
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
