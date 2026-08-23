"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Layers,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PlatformLogo } from "@/features/convert/presentation/platform-logo";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import {
  DEMO_ECO_ROWS,
  DEMO_HSN_ROWS,
  DEMO_SELLER,
  DEMO_TOTALS,
  GSTR1_ROWS,
  MARKETPLACE_PRESETS,
  PIPELINE_STAGES,
  RAW_ROWS,
  TRANSFORMATIONS,
  type DemoMarketplacePreset,
  type RawRow,
} from "@/features/demo/demo-data";

type ViewMode = "output" | "raw";
type OutputTab = "b2cs" | "eco" | "hsn" | "audit";

/**
 * Stages played by the run ticker, indexed into PIPELINE_STAGES — picked so the
 * visible five tell the story (read → normalise → net → split → emit).
 */
const RUN_STAGES = [0, 3, 4, 6, 8].map((i) => PIPELINE_STAGES[i]!);

/* Ledger figures read cleaner without paise; the tables below keep exact ones. */
const INR_WHOLE = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const formatInrWhole = (value: number) => `₹${INR_WHOLE.format(value)}`;

const REFUND_COUNT = RAW_ROWS.filter((r) => r.transactionType === "Refund").length;

export function DemoGenerator() {
  const [selectedPreset, setSelectedPreset] = useState<DemoMarketplacePreset>(
    MARKETPLACE_PRESETS[0]!
  );
  const [viewMode, setViewMode] = useState<ViewMode>("output");
  const [activeTab, setActiveTab] = useState<OutputTab>("b2cs");
  const [isConverting, setIsConverting] = useState(false);
  const [stageStep, setStageStep] = useState(0);

  /* Cycle the run ticker while the pipeline executes. Skipped entirely for
     reduced-motion users, who get a quiet static status instead. The ticker is
     rewound by whoever starts a run, not here — resetting inside the effect
     would render the last run's final stage for one frame first. */
  useEffect(() => {
    if (!isConverting) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setStageStep((step) => Math.min(step + 1, RUN_STAGES.length - 1));
    }, 110);
    return () => window.clearInterval(id);
  }, [isConverting]);

  const handleSelectPreset = (preset: DemoMarketplacePreset) => {
    setSelectedPreset(preset);
    setStageStep(0);
    setIsConverting(true);
    setTimeout(() => setIsConverting(false), 550);
  };

  const handleRunConversion = () => {
    setStageStep(0);
    setIsConverting(true);
    setTimeout(() => {
      setIsConverting(false);
      setViewMode("output");
    }, 650);
  };

  function download(file: "json" | "excel") {
    window.location.href = `/api/demo/download?file=${file}`;
  }

  return (
    <div className="relative">
      {/* Staging behind the instrument: a wide bloom plus a faint drafting grid,
          both masked out so nothing shows a hard edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-12 -top-16 bottom-0 -z-10 brand-glow opacity-90"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-12 -top-16 bottom-0 -z-10 grid-lines [mask-image:radial-gradient(75%_65%_at_50%_38%,black,transparent)] opacity-45"
      />

      <div className="animate-rise overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl ring-1 ring-white/50 sm:rounded-3xl dark:ring-white/10">
        {/* ── Console bar ─────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-subtle/60 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-lg brand-gradient text-white shadow-xs"
            >
              <Layers className="size-3.5" />
            </span>
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="text-xs font-bold tracking-tight whitespace-nowrap text-foreground">
                GSTPilot Workbench
              </span>
              <span aria-hidden className="hidden font-mono text-border-strong sm:inline">
                /
              </span>
              <span className="truncate font-mono text-2xs text-muted-foreground">
                {selectedPreset.sourceFileName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="primary" dot size="sm" className="font-mono text-2xs">
              Live preview
            </Badge>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="size-3" aria-hidden />
              GSTN v3.0
            </span>
          </div>
        </header>

        <div className="space-y-6 p-4 sm:p-6">
          {/* ── Source report selector ────────────────────────────────────── */}
          <section aria-label="Source report" className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-2xs font-bold tracking-wider text-muted-foreground uppercase">
                Source report
              </h3>
              <p className="text-2xs text-muted-foreground">
                Seller GSTIN{" "}
                <strong className="ml-0.5 font-mono font-semibold text-foreground">
                  {DEMO_SELLER.gstin}
                </strong>
                <span aria-hidden className="mx-1.5 text-border-strong">
                  ·
                </span>
                Karnataka · Aug 2026
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {MARKETPLACE_PRESETS.map((preset) => {
                const isSelected = selectedPreset.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    aria-pressed={isSelected}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                      isSelected
                        ? "border-primary/60 bg-primary/[0.06] shadow-xs ring-1 ring-primary/30"
                        : "border-border/70 bg-card hover:-translate-y-px hover:border-border-strong hover:bg-muted/30 hover:shadow-sm"
                    )}
                  >
                    {preset.id === "all" ? (
                      <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg brand-gradient text-white shadow-xs transition-transform duration-200 group-hover:scale-105"
                      >
                        <Layers className="size-4" />
                      </span>
                    ) : (
                      <PlatformLogo
                        id={preset.id}
                        name={preset.name}
                        size="sm"
                        accentColor={PLATFORMS_CONFIG.find((c) => c.id === preset.id)?.accentColor}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-1.5">
                        <span
                          className={cn(
                            "truncate text-xs font-bold tracking-tight",
                            isSelected ? "text-primary-ink" : "text-foreground"
                          )}
                        >
                          {preset.name}
                        </span>
                        {isSelected && (
                          <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-3xs text-muted-foreground">
                        {preset.sourceFileName}
                      </span>
                      <span
                        className={cn(
                          "mt-1 inline-block rounded-full px-1.5 py-px font-mono text-3xs font-semibold",
                          isSelected
                            ? "bg-primary/15 text-primary-ink"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {preset.badge}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Ledger strip ──────────────────────────────────────────────────
              Ruled like an invoice summary: one hairline grid, four readings,
              with Net Taxable carrying the emphasis. */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/80 bg-border/70 shadow-xs sm:grid-cols-4">
            <div className="bg-card px-4 py-3.5">
              <dt className="text-3xs font-semibold tracking-wider text-muted-foreground uppercase">
                Gross sales
              </dt>
              <dd className="mt-1.5 text-lg font-bold tracking-tight text-foreground tabular-nums sm:text-lg sm:text-xl">
                {formatInrWhole(DEMO_TOTALS.grossValue)}
              </dd>
              <dd className="mt-0.5 text-3xs text-muted-foreground">incl. GST, before netting</dd>
            </div>

            <div className="bg-card px-4 py-3.5">
              <dt className="text-3xs font-semibold tracking-wider text-muted-foreground uppercase">
                Returns netted off
              </dt>
              <dd className="mt-1.5 text-lg font-bold tracking-tight text-rose-600 tabular-nums sm:text-lg sm:text-xl dark:text-rose-400">
                −{formatInrWhole(DEMO_TOTALS.refundsNetted)}
              </dd>
              <dd className="mt-0.5 text-3xs text-muted-foreground">
                {REFUND_COUNT} credit notes matched
              </dd>
            </div>

            <div className="bg-secondary/40 px-4 py-3.5">
              <dt className="text-3xs font-semibold tracking-wider text-primary-ink uppercase">
                Net taxable value
              </dt>
              <dd className="mt-1.5 text-lg font-bold tracking-tight text-primary-ink tabular-nums sm:text-lg sm:text-xl">
                {formatInrWhole(DEMO_TOTALS.netTaxable)}
              </dd>
              <dd className="mt-0.5 text-3xs text-primary-ink/70">what tax is charged on</dd>
            </div>

            <div className="bg-card px-4 py-3.5">
              <dt className="text-3xs font-semibold tracking-wider text-muted-foreground uppercase">
                Total tax
              </dt>
              <dd className="mt-1.5 text-lg font-bold tracking-tight text-emerald-700 tabular-nums sm:text-lg sm:text-xl dark:text-emerald-400">
                {formatInrWhole(DEMO_TOTALS.totalTax)}
              </dd>
              <dd className="mt-0.5 text-3xs text-muted-foreground">IGST + CGST + SGST split</dd>
            </div>
          </dl>

          {/* ── Toolbar ───────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-subtle/40 p-2 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="group"
              aria-label="Switch between filing output and raw source"
              className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/60 p-0.5"
            >
              <ViewToggle
                active={viewMode === "output"}
                onClick={() => setViewMode("output")}
                icon={<Sparkles className="size-3.5 text-primary" aria-hidden />}
                label="GSTR-1 Output"
                hint="Filing ready"
              />
              <ViewToggle
                active={viewMode === "raw"}
                onClick={() => setViewMode("raw")}
                icon={<FileSpreadsheet className="size-3.5 text-amber-500" aria-hidden />}
                label="Raw Data"
                hint={`${selectedPreset.rawRows.length} lines`}
              />
            </div>

            <div className="flex items-center gap-2 px-0.5 pb-0.5 sm:pb-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunConversion}
                disabled={isConverting}
                className="text-xs"
              >
                {isConverting ? (
                  <>
                    <RotateCcw className="size-3.5 animate-spin text-primary" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-3.5 text-primary" />
                    Re-run Pipeline
                  </>
                )}
              </Button>

              <Button asChild variant="brand" size="sm" className="text-xs">
                <Link href="/register">
                  Start Free Trial
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* ── Content viewport ──────────────────────────────────────────────
              Fixed minimum height so switching views never jolts the footer. */}
          <div className="min-h-[320px]">
            {isConverting ? (
              <PipelineRunPanel fileName={selectedPreset.sourceFileName} step={stageStep} />
            ) : viewMode === "raw" ? (
              <div key="raw" className="animate-fade-in space-y-3">
                <div className="flex items-center justify-between px-1 text-2xs text-muted-foreground">
                  <span>Exactly what the marketplace hands you, before processing</span>
                  <span className="font-medium text-rose-500">Refunds highlighted</span>
                </div>
                <RawTable rows={selectedPreset.rawRows} />
              </div>
            ) : (
              <div key={`output-${activeTab}`} className="animate-fade-in space-y-4">
                <div
                  role="tablist"
                  aria-label="Output tables"
                  className="scrollbar-none flex items-center gap-5 overflow-x-auto border-b border-border"
                >
                  <SubTabButton
                    active={activeTab === "b2cs"}
                    onClick={() => setActiveTab("b2cs")}
                    icon={Layers}
                    label="Table 7 · B2CS"
                    badge={`${GSTR1_ROWS.length} states`}
                  />
                  <SubTabButton
                    active={activeTab === "eco"}
                    onClick={() => setActiveTab("eco")}
                    icon={ShoppingBag}
                    label="Table 14 · ECO"
                    badge="TCS u/s 52"
                  />
                  <SubTabButton
                    active={activeTab === "hsn"}
                    onClick={() => setActiveTab("hsn")}
                    icon={FileText}
                    label="Table 12 · HSN"
                    badge={`${DEMO_HSN_ROWS.length} codes`}
                  />
                  <SubTabButton
                    active={activeTab === "audit"}
                    onClick={() => setActiveTab("audit")}
                    icon={ClipboardCheck}
                    label="Transformations"
                  />
                </div>

                {activeTab === "b2cs" && <OutputTable />}
                {activeTab === "eco" && <EcoTable />}
                {activeTab === "hsn" && <HsnTable />}
                {activeTab === "audit" && <TransformationList />}
              </div>
            )}
          </div>

          {/* ── Exports ───────────────────────────────────────────────────── */}
          <div className="space-y-3 border-t border-border/70 pt-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-2xs font-bold tracking-wider text-muted-foreground uppercase">
                Filing-ready exports
              </span>
              <span className="flex items-center gap-1 text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="size-3" aria-hidden />
                Uploads directly to gst.gov.in
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <DownloadCard
                icon={FileJson}
                title="GSTR-1 JSON"
                badge="GSTN v3.0 schema"
                body="Government-ready file for direct portal upload."
                onClick={() => download("json")}
              />
              <DownloadCard
                icon={FileSpreadsheet}
                title="Official Excel Template"
                badge="Government format"
                body="Multi-sheet workbook: B2CS, ECO 14, HSN 12 & DOCS."
                onClick={() => download("excel")}
              />
            </div>

            {/* Closing banner */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-brand/[0.04] to-transparent p-4 sm:p-5">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold tracking-tight text-foreground">
                    Now run your own marketplace spreadsheets through it
                  </h4>
                  <p className="text-2xs text-muted-foreground">
                    30-day free trial · 7 client GSTINs · No credit card required
                  </p>
                </div>
                <Button asChild variant="brand" size="md" className="w-full shrink-0 sm:w-auto">
                  <Link href="/register">
                    <Zap className="size-3.5" />
                    Start Free Trial
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Pieces
   ------------------------------------------------------------------------ */

function ViewToggle({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200",
        active
          ? "bg-card text-foreground shadow-xs ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-px font-mono text-3xs font-semibold",
          active ? "bg-primary/10 text-primary-ink" : "bg-muted-foreground/10 text-muted-foreground"
        )}
      >
        {hint}
      </span>
    </button>
  );
}

function SubTabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Layers;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative pt-1 pb-2.5 text-xs font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-opacity",
        active
          ? "text-foreground after:bg-primary after:opacity-100"
          : "text-muted-foreground after:opacity-0 hover:text-foreground"
      )}
    >
      <span className="flex items-center gap-1.5">
        <Icon className="size-3.5" aria-hidden />
        <span>{label}</span>
        {badge && (
          <span
            className={cn(
              "rounded-full px-1.5 py-px font-mono text-3xs font-semibold",
              active ? "bg-primary/10 text-primary-ink" : "bg-muted text-muted-foreground"
            )}
          >
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

/** The signature moment: instead of a bare spinner, the actual pipeline stages
    light up in order while the conversion runs. */
function PipelineRunPanel({ fileName, step }: { fileName: string; step: number }) {
  return (
    <div
      role="status"
      className="flex min-h-[320px] animate-fade-in items-center justify-center py-8"
    >
      <div className="w-full max-w-md">
        <div className="mb-3.5 flex items-baseline justify-between gap-4">
          <span className="text-2xs font-bold tracking-wider text-muted-foreground uppercase">
            Running pipeline
          </span>
          <span className="truncate font-mono text-2xs text-muted-foreground">{fileName}</span>
        </div>

        <ol aria-hidden className="space-y-0.5">
          {RUN_STAGES.map((stage, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={stage}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-150",
                  active && "bg-primary/[0.07] font-semibold text-foreground",
                  done && "text-muted-foreground",
                  !active && !done && "text-muted-foreground/50"
                )}
              >
                <span className="flex w-3.5 shrink-0 justify-center">
                  {done ? (
                    <Check className="size-3.5 text-success" />
                  ) : active ? (
                    <RotateCcw className="size-3.5 animate-spin text-primary" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-border-strong" />
                  )}
                </span>
                {stage}
              </li>
            );
          })}
        </ol>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full brand-gradient transition-[width] duration-150 ease-linear"
            style={{ width: `${((step + 1) / RUN_STAGES.length) * 100}%` }}
          />
        </div>

        <p className="sr-only">Converting the sample export to GSTR-1…</p>
      </div>
    </div>
  );
}

function DownloadCard({
  icon: Icon,
  title,
  badge,
  body,
  onClick,
}: {
  icon: typeof FileJson;
  title: string;
  badge: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-3 text-left transition-all duration-200 hover:border-primary/50 hover:shadow-md"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-brand/10 text-primary-ink ring-1 ring-primary/20 transition-transform duration-200 group-hover:scale-105">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs font-bold text-foreground transition-colors group-hover:text-primary-ink">
            {title}
          </span>
          <span className="rounded bg-muted px-1.5 py-px font-mono text-3xs font-semibold text-muted-foreground">
            {badge}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-3xs text-muted-foreground">{body}</span>
      </span>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary-ink"
      >
        <Download className="size-3.5" />
      </span>
    </button>
  );
}

function RawTable({ rows }: { rows: RawRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead className="bg-subtle/70 text-3xs font-semibold tracking-wider text-muted-foreground uppercase">
          <tr>
            <th className="px-3.5 py-2.5">Platform</th>
            <th className="px-3.5 py-2.5">Order ID</th>
            <th className="px-3.5 py-2.5">Date</th>
            <th className="px-3.5 py-2.5">Raw State Name</th>
            <th className="px-3.5 py-2.5">Type</th>
            <th className="px-3.5 py-2.5 text-right">Invoice Amount</th>
            <th className="px-3.5 py-2.5 text-right">Tax Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card font-mono text-2xs">
          {rows.map((row, i) => (
            <tr
              key={row.orderId + row.invoiceDate + i}
              className={cn(
                "font-sans transition-colors hover:bg-muted/30",
                row.transactionType === "Refund" && "bg-rose-500/[0.05]"
              )}
            >
              <td className="px-3.5 py-2 font-medium text-foreground">
                <span className="rounded bg-primary/[0.08] px-1.5 py-0.5 text-3xs font-semibold text-primary-ink">
                  {row.platform}
                </span>
              </td>
              <td className="px-3.5 py-2 font-mono text-3xs text-muted-foreground">
                {row.orderId}
              </td>
              <td className="px-3.5 py-2 whitespace-nowrap text-muted-foreground">
                {row.invoiceDate}
              </td>
              <td className="px-3.5 py-2">
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-3xs font-medium text-amber-700 dark:text-amber-300">
                  {row.shipToState}
                </span>
              </td>
              <td className="px-3.5 py-2">
                {row.transactionType === "Refund" ? (
                  <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-3xs font-semibold text-rose-600 dark:text-rose-400">
                    Refund
                  </span>
                ) : (
                  <span className="text-3xs text-muted-foreground">Shipment</span>
                )}
              </td>
              <td className="px-3.5 py-2 text-right font-mono font-medium tabular-nums">
                {row.invoiceAmount}
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-muted-foreground">
                {row.taxRate}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const B2CS_TOTALS = GSTR1_ROWS.reduce(
  (t, r) => ({
    taxable: +(t.taxable + r.taxableValue).toFixed(2),
    igst: +(t.igst + r.igst).toFixed(2),
    cgst: +(t.cgst + r.cgst).toFixed(2),
    sgst: +(t.sgst + r.sgst).toFixed(2),
  }),
  { taxable: 0, igst: 0, cgst: 0, sgst: 0 }
);

function OutputTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-emerald-500/[0.06] px-3.5 py-2">
        <span className="text-2xs font-semibold text-emerald-800 dark:text-emerald-200">
          Outward supplies (B2C) — consolidated by place of supply
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-3xs font-semibold text-emerald-700 dark:text-emerald-300">
          <Check className="size-3" aria-hidden />
          Filing ready
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-left text-xs">
          <thead className="bg-subtle/70 text-3xs font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="px-3.5 py-2.5">Place of Supply</th>
              <th className="px-3.5 py-2.5 text-right">GST Rate</th>
              <th className="px-3.5 py-2.5 text-right">Net Taxable (₹)</th>
              <th className="px-3.5 py-2.5 text-right">IGST (₹)</th>
              <th className="px-3.5 py-2.5 text-right">CGST (₹)</th>
              <th className="px-3.5 py-2.5 text-right">SGST (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {GSTR1_ROWS.map((row) => (
              <tr
                key={row.placeOfSupply + row.rate}
                className="transition-colors hover:bg-muted/30"
              >
                <td className="px-3.5 py-2 font-medium">
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-2xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {row.placeOfSupply}
                  </span>
                  {row.netned && (
                    <span className="mt-0.5 block font-sans text-3xs text-muted-foreground">
                      returns netted
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-2xs tabular-nums">
                  {row.rate}%
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-2xs font-bold text-foreground tabular-nums">
                  ₹{row.taxableValue.toLocaleString("en-IN")}
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-2xs text-muted-foreground tabular-nums">
                  {row.igst ? `₹${row.igst.toLocaleString("en-IN")}` : "—"}
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-2xs text-muted-foreground tabular-nums">
                  {row.cgst ? `₹${row.cgst.toLocaleString("en-IN")}` : "—"}
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-2xs text-muted-foreground tabular-nums">
                  {row.sgst ? `₹${row.sgst.toLocaleString("en-IN")}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/80 bg-muted/40">
              <td
                colSpan={2}
                className="px-3.5 py-2.5 text-2xs font-bold tracking-wider text-muted-foreground uppercase"
              >
                Total
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono text-2xs font-bold text-foreground tabular-nums">
                ₹{B2CS_TOTALS.taxable.toLocaleString("en-IN")}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono text-2xs font-bold text-foreground tabular-nums">
                {B2CS_TOTALS.igst ? `₹${B2CS_TOTALS.igst.toLocaleString("en-IN")}` : "—"}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono text-2xs font-bold text-foreground tabular-nums">
                {B2CS_TOTALS.cgst ? `₹${B2CS_TOTALS.cgst.toLocaleString("en-IN")}` : "—"}
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono text-2xs font-bold text-foreground tabular-nums">
                {B2CS_TOTALS.sgst ? `₹${B2CS_TOTALS.sgst.toLocaleString("en-IN")}` : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function EcoTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
      <table className="w-full min-w-[500px] text-left text-xs">
        <thead className="bg-subtle/70 text-3xs font-semibold tracking-wider text-muted-foreground uppercase">
          <tr>
            <th className="px-3.5 py-2.5">E-Commerce Operator</th>
            <th className="px-3.5 py-2.5">ECO GSTIN</th>
            <th className="px-3.5 py-2.5 text-right">Gross Sales</th>
            <th className="px-3.5 py-2.5 text-right">Returns</th>
            <th className="px-3.5 py-2.5 text-right">Net Taxable</th>
            <th className="px-3.5 py-2.5 text-right">TCS u/s 52</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {DEMO_ECO_ROWS.map((eco) => (
            <tr key={eco.ecoGstin} className="transition-colors hover:bg-muted/30">
              <td className="px-3.5 py-2 font-medium text-foreground">{eco.ecoName}</td>
              <td className="px-3.5 py-2 font-mono text-3xs text-muted-foreground">
                {eco.ecoGstin}
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs font-medium tabular-nums">
                ₹{eco.grossSales.toLocaleString("en-IN")}
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs font-medium text-rose-500 tabular-nums">
                −₹{eco.returnsNetted.toLocaleString("en-IN")}
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs font-bold text-foreground tabular-nums">
                ₹{eco.netTaxable.toLocaleString("en-IN")}
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                ₹{eco.tcsDeducted.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HsnTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs">
      <table className="w-full min-w-[500px] text-left text-xs">
        <thead className="bg-subtle/70 text-3xs font-semibold tracking-wider text-muted-foreground uppercase">
          <tr>
            <th className="px-3.5 py-2.5">HSN Code</th>
            <th className="px-3.5 py-2.5">Description</th>
            <th className="px-3.5 py-2.5">UQC</th>
            <th className="px-3.5 py-2.5 text-right">Total Qty</th>
            <th className="px-3.5 py-2.5 text-right">Taxable Value</th>
            <th className="px-3.5 py-2.5 text-right">Rate</th>
            <th className="px-3.5 py-2.5 text-right">Tax Liability</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {DEMO_HSN_ROWS.map((hsn) => (
            <tr key={hsn.hsnCode} className="transition-colors hover:bg-muted/30">
              <td className="px-3.5 py-2 font-mono text-2xs font-semibold text-primary-ink">
                {hsn.hsnCode}
              </td>
              <td className="px-3.5 py-2 font-medium text-foreground">{hsn.description}</td>
              <td className="px-3.5 py-2 font-mono text-3xs text-muted-foreground">{hsn.uqc}</td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs font-medium tabular-nums">
                {hsn.quantity}
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs font-bold text-foreground tabular-nums">
                ₹{hsn.taxableValue.toLocaleString("en-IN")}
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs text-muted-foreground">
                {hsn.rate}%
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                ₹{hsn.taxAmount.toLocaleString("en-IN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransformationList() {
  return (
    <div>
      <p className="mb-2.5 px-1 text-2xs font-bold tracking-wider text-muted-foreground uppercase">
        What the engine changed — and why
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {TRANSFORMATIONS.map((t) => (
          <li
            key={t.id}
            className="flex card-lift gap-2.5 rounded-xl border border-border/70 bg-card p-3"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">{t.label}</p>
              <p className="mt-0.5 text-3xs leading-relaxed text-muted-foreground">{t.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
