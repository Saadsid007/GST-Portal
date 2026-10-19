import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

/**
 * The frame every sign-in, sign-up and recovery screen shares.
 *
 * Five pages each carried their own copy of the logo header and card, and had
 * drifted: different taglines, radii and shadows. On wide screens the left
 * column says what the product does, so the form is not the only thing on an
 * otherwise empty page.
 */
const POINTS = [
  "Amazon, Flipkart, Meesho and more — one GSTR-1",
  "Portal-ready JSON matching the official offline tool",
  "Returns netted, states coded, tax split correctly",
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-subtle lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
        <Link href="/" className="relative w-fit" aria-label="GSTPilot home">
          <AppLogo size="lg" priority />
        </Link>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-foreground xl:text-4xl">
            File GSTR-1 from your marketplace reports in minutes.
          </h2>
          <ul className="space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-ink" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          Trusted by e-commerce sellers and CA firms across India.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px] space-y-6">
          <Link href="/" className="mx-auto block w-fit lg:hidden" aria-label="GSTPilot home">
            <AppLogo size="lg" priority />
          </Link>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            {children}
          </div>
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
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none disabled:opacity-60";

export const authButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-50";
