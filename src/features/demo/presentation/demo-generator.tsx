"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
  UploadCloud,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  DEMO_SELLER,
  DEMO_TOTALS,
  GSTR1_ROWS,
  PIPELINE_STAGES,
  RAW_ROWS,
  TRANSFORMATIONS,
  buildDemoCsv,
  formatInr,
} from "@/features/demo/demo-data";

type Phase = "idle" | "loaded" | "processing" | "done";

const STAGE_MS = 260;

export function DemoGenerator() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Any pending stage timer must die with the component, or a reset mid-run
  // keeps advancing the old sequence over the new state.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const convert = useCallback(() => {
    clearTimers();
    setPhase("processing");
    setStage(0);

    PIPELINE_STAGES.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStage(i + 1), STAGE_MS * (i + 1)));
    });
    timers.current.push(
      setTimeout(() => setPhase("done"), STAGE_MS * (PIPELINE_STAGES.length + 1))
    );
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setStage(0);
    setPhase("idle");
  }, [clearTimers]);

  function download() {
    const blob = new Blob([buildDemoCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "GSTPilot-demo-GSTR1-output.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      {/* Chrome */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-subtle px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-destructive/40" />
            <span className="size-2.5 rounded-full bg-warning/40" />
            <span className="size-2.5 rounded-full bg-success/40" />
          </div>
          <p className="ml-1 font-mono text-2xs text-muted-foreground">
            {phase === "idle" ? "gstpilot — new conversion" : DEMO_SELLER.sourceFile}
          </p>
        </div>
        <Badge variant="primary" dot>
          Live demo · sample data
        </Badge>
      </div>

      <div className="p-5 sm:p-7">
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <button
                type="button"
                onClick={() => setPhase("loaded")}
                className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border-strong px-6 py-16 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.04]"
              >
                <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                  <UploadCloud className="size-7" />
                </span>
                <span className="text-base font-semibold">Load the sample marketplace report</span>
                <span className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                  No signup, no file needed. We&rsquo;ll use a real-shaped Amazon MTR export so you
                  can watch the conversion end to end.
                </span>
                <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background">
                  <FileSpreadsheet className="size-3.5" />
                  Use sample file
                </span>
              </button>
            </motion.div>
          )}

          {phase === "loaded" && (
            <motion.div
              key="loaded"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <Header
                eyebrow="Step 1 — your raw file"
                title="This is what the marketplace gives you"
                note={`${DEMO_TOTALS.rawLineCount} lines · mixed shipments and refunds · states as free text`}
              />
              <RawTable />
              <div className="flex flex-col items-center gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Filing this by hand means netting refunds, coding states and splitting tax — every
                  month.
                </p>
                <Button variant="brand" size="lg" onClick={convert} className="w-full sm:w-auto">
                  <Wand2 />
                  Convert to GSTR-1
                  <ArrowRight />
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-10"
            >
              <Pipeline stage={stage} />
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Header
                eyebrow="Step 2 — filing-ready output"
                title="Before and after, side by side"
                note={`${DEMO_TOTALS.rawLineCount} raw lines became ${DEMO_TOTALS.outputLineCount} GSTR-1 rows`}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel label="Before · raw marketplace export" tone="muted">
                  <RawTable compact />
                </Panel>
                <Panel label="After · GSTR-1 table 7 (B2CS)" tone="success">
                  <OutputTable />
                </Panel>
              </div>

              <TransformationList />
              <Reconciliation />

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="md" onClick={download}>
                    <Download />
                    Download demo output
                  </Button>
                  <Button variant="ghost" size="md" onClick={reset}>
                    <RotateCcw />
                    Run it again
                  </Button>
                </div>
                <Button asChild variant="brand" size="lg">
                  <Link href="/convert">
                    <Sparkles />
                    Do this with your own file
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Header({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <div className="space-y-1">
      <p className="text-2xs font-semibold tracking-wider text-primary-ink uppercase">{eyebrow}</p>
      <h3 className="text-lg font-bold tracking-tight">{title}</h3>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Panel({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "muted" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        tone === "success" ? "border-success/30 bg-success/[0.04]" : "border-border bg-subtle"
      )}
    >
      <p
        className={cn(
          "border-b px-3 py-2 text-2xs font-semibold tracking-wide uppercase",
          tone === "success"
            ? "border-success/25 text-success-ink"
            : "border-border text-muted-foreground"
        )}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function RawTable({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-muted/60 text-2xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 font-semibold">Order ID</th>
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">Ship to state</th>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 text-right font-semibold">Invoice amount</th>
            <th className="px-3 py-2 text-right font-semibold">Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {RAW_ROWS.map((row, i) => (
            <motion.tr
              key={row.orderId + row.invoiceDate}
              initial={compact ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className={row.transactionType === "Refund" ? "bg-destructive/[0.05]" : undefined}
            >
              <td className="px-3 py-2 font-mono text-2xs text-muted-foreground">{row.orderId}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.invoiceDate}</td>
              <td className="px-3 py-2">
                {/* The messiness is the point — highlight it. */}
                <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-2xs text-warning-ink">
                  {row.shipToState}
                </span>
              </td>
              <td className="px-3 py-2">
                {row.transactionType === "Refund" ? (
                  <Badge variant="destructive">Refund</Badge>
                ) : (
                  <span className="text-muted-foreground">Shipment</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{row.invoiceAmount}</td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                {row.taxRate}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutputTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead className="bg-success/10 text-2xs tracking-wide text-success-ink uppercase">
          <tr>
            <th className="px-3 py-2 font-semibold">Place of supply</th>
            <th className="px-3 py-2 text-right font-semibold">Rate</th>
            <th className="px-3 py-2 text-right font-semibold">Taxable</th>
            <th className="px-3 py-2 text-right font-semibold">IGST</th>
            <th className="px-3 py-2 text-right font-semibold">CGST</th>
            <th className="px-3 py-2 text-right font-semibold">SGST</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-success/15">
          {GSTR1_ROWS.map((row, i) => (
            <motion.tr
              key={row.placeOfSupply + row.rate}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.3 }}
            >
              <td className="px-3 py-2 font-medium">
                <span className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-2xs text-success-ink">
                  {row.placeOfSupply}
                </span>
                {row.netted && (
                  <span className="mt-1 block text-2xs text-muted-foreground">refund netted</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{row.rate}%</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {row.taxableValue.toLocaleString("en-IN")}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                {row.igst || "—"}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                {row.cgst || "—"}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                {row.sgst || "—"}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pipeline({ stage }: { stage: number }) {
  const percent = Math.round((stage / PIPELINE_STAGES.length) * 100);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <div className="relative mx-auto size-24">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="7" className="stroke-muted" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              className="stroke-primary transition-[stroke-dashoffset] duration-300 ease-out"
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - percent / 100)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-primary-ink tabular-nums">
            {percent}%
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold">Running the conversion pipeline</p>
      </div>

      <ul className="space-y-1.5">
        {PIPELINE_STAGES.map((name, i) => {
          const done = stage > i;
          const current = stage === i;
          return (
            <li
              key={name}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs transition-colors duration-300",
                current && "bg-primary/10 font-semibold text-primary-ink",
                done && "text-foreground",
                !done && !current && "text-muted-foreground/50"
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  done && "border-success bg-success text-success-foreground",
                  current && "border-primary",
                  !done && !current && "border-border"
                )}
              >
                {done && <Check className="size-2.5" />}
              </span>
              {name}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TransformationList() {
  return (
    <div className="rounded-xl border border-border bg-subtle p-4">
      <p className="mb-3 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        What changed
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {TRANSFORMATIONS.map((t, i) => (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
            className="flex gap-2"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
            <div>
              <p className="text-xs font-semibold">{t.label}</p>
              <p className="text-2xs text-muted-foreground">{t.detail}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Reconciliation() {
  const cells = [
    { label: "Gross in raw file", value: formatInr(DEMO_TOTALS.grossValue) },
    { label: "Refunds netted off", value: `− ${formatInr(DEMO_TOTALS.refundsNetted)}` },
    { label: "Net taxable value", value: formatInr(DEMO_TOTALS.netTaxable), accent: true },
    { label: "Total tax", value: formatInr(DEMO_TOTALS.totalTax) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {cells.map((c) => (
        <div
          key={c.label}
          className={cn(
            "rounded-xl border p-3.5",
            c.accent ? "border-primary/25 bg-primary/[0.06]" : "border-border bg-card"
          )}
        >
          <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            {c.label}
          </p>
          <p
            className={cn("mt-1 text-base font-bold tabular-nums", c.accent && "text-primary-ink")}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
