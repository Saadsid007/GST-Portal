"use client";

import { useCallback, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
  Wand2,
  FileJson,
  FileSpreadsheet as FileXls,
  ClipboardCheck,
  Layers,
  ShoppingBag,
  TrendingDown,
  FileText,
  Building2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  DEMO_SELLER,
  DEMO_TOTALS,
  DEMO_ECO_ROWS,
  DEMO_HSN_ROWS,
  GSTR1_ROWS,
  MARKETPLACE_PRESETS,
  TRANSFORMATIONS,
  formatInr,
  type DemoMarketplacePreset,
  type RawRow,
} from "@/features/demo/demo-data";

type ViewMode = "output" | "raw";
type OutputTab = "b2cs" | "eco" | "hsn" | "audit";

export function DemoGenerator() {
  const [selectedPreset, setSelectedPreset] = useState<DemoMarketplacePreset>(MARKETPLACE_PRESETS[0]!);
  const [viewMode, setViewMode] = useState<ViewMode>("output");
  const [activeTab, setActiveTab] = useState<OutputTab>("b2cs");
  const [isConverting, setIsConverting] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState(true);

  const handleSelectPreset = (preset: DemoMarketplacePreset) => {
    setSelectedPreset(preset);
    setIsConverting(true);
    setTimeout(() => {
      setIsConverting(false);
      setConversionSuccess(true);
    }, 350);
  };

  const handleRunConversion = () => {
    setIsConverting(true);
    setTimeout(() => {
      setIsConverting(false);
      setViewMode("output");
      setConversionSuccess(true);
    }, 450);
  };

  function download(file: "json" | "excel") {
    window.location.href = `/api/demo/download?file=${file}`;
  }

  return (
    <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-card shadow-xl transition-all duration-300">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-subtle/70 px-4 sm:px-6 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-rose-500/80" />
            <span className="size-2.5 rounded-full bg-amber-500/80" />
            <span className="size-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="ml-1 text-xs font-semibold text-foreground">
            GSTPilot Real-Time Workbench
          </span>
          <span className="text-muted-foreground/40 font-mono text-xs">/</span>
          <span className="font-mono text-2xs text-muted-foreground truncate max-w-[180px] sm:max-w-xs">
            {selectedPreset.sourceFileName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary" dot className="font-mono text-2xs">
            Live Preview
          </Badge>
          <span className="hidden sm:inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
            GSTN v3.0 Verified
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Marketplace Selector Tabs */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Sample Report Structure
            </label>
            <span className="text-2xs text-muted-foreground">
              Seller GSTIN: <strong className="font-mono text-foreground">{DEMO_SELLER.gstin} (Karnataka)</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MARKETPLACE_PRESETS.map((preset) => {
              const isSelected = selectedPreset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200",
                    isSelected
                      ? "border-primary bg-primary/[0.06] shadow-xs ring-1 ring-primary/30"
                      : "border-border/70 bg-card hover:border-border-strong hover:bg-muted/30"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className={cn(
                      "text-xs font-bold truncate",
                      isSelected ? "text-primary" : "text-foreground"
                    )}>
                      {preset.name}
                    </span>
                    <span className={cn(
                      "rounded-full px-1.5 py-0.2 font-mono text-3xs font-semibold shrink-0",
                      isSelected ? "bg-primary/20 text-primary-ink" : "bg-muted text-muted-foreground"
                    )}>
                      {preset.badge}
                    </span>
                  </div>
                  <span className="text-3xs text-muted-foreground font-mono truncate w-full">
                    {preset.sourceFileName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-xl border border-border/80 bg-subtle/50 p-3">
            <span className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gross Marketplace Sales
            </span>
            <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-foreground">
              {formatInr(DEMO_TOTALS.grossValue)}
            </p>
          </div>

          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-3">
            <span className="text-3xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Returns Netted Off
            </span>
            <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">
              −{formatInr(DEMO_TOTALS.refundsNetted)}
            </p>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
            <span className="text-3xs font-semibold uppercase tracking-wider text-primary-ink">
              Net Taxable Value
            </span>
            <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-primary-ink">
              {formatInr(DEMO_TOTALS.netTaxable)}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
            <span className="text-3xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Total Tax (IGST+CGST+SGST)
            </span>
            <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatInr(DEMO_TOTALS.totalTax)}
            </p>
          </div>
        </div>

        {/* Action / View Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode("output")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                viewMode === "output"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>GSTR-1 Output (Filing Ready)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                viewMode === "raw"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileSpreadsheet className="size-3.5 text-amber-500" />
              <span>Raw Marketplace Data ({selectedPreset.rawRows.length} lines)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
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
                  Processing...
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
                <span>Start Free Trial</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Content View: Raw vs Output */}
        {isConverting ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="relative size-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <RotateCcw className="size-6 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Executing GST Compliance Pipeline</p>
              <p className="text-2xs text-muted-foreground">Normalising POS, matching return credit notes & calculating tax split...</p>
            </div>
          </div>
        ) : viewMode === "raw" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-2xs text-muted-foreground px-1">
              <span>Raw export format before GSTPilot automated processing</span>
              <span className="text-rose-500 font-medium">Refund credit notes highlighted</span>
            </div>
            <RawTable rows={selectedPreset.rawRows} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Output Sub-Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/70 pb-2">
              <SubTabButton
                active={activeTab === "b2cs"}
                onClick={() => setActiveTab("b2cs")}
                icon={Layers}
                label="Table 7 (B2CS)"
                badge={`${GSTR1_ROWS.length} States`}
              />
              <SubTabButton
                active={activeTab === "eco"}
                onClick={() => setActiveTab("eco")}
                icon={ShoppingBag}
                label="Table 14 (ECO Supplies)"
                badge="TCS u/s 52"
              />
              <SubTabButton
                active={activeTab === "hsn"}
                onClick={() => setActiveTab("hsn")}
                icon={FileText}
                label="Table 12 (HSN Summary)"
                badge={`${DEMO_HSN_ROWS.length} Codes`}
              />
              <SubTabButton
                active={activeTab === "audit"}
                onClick={() => setActiveTab("audit")}
                icon={ClipboardCheck}
                label="Transformations & Audit"
              />
            </div>

            {/* Sub-Tab Panels */}
            {activeTab === "b2cs" && <OutputTable />}
            {activeTab === "eco" && <EcoTable />}
            {activeTab === "hsn" && <HsnTable />}
            {activeTab === "audit" && (
              <div className="space-y-4">
                <TransformationList />
              </div>
            )}
          </div>
        )}

        {/* Download Buttons Strip */}
        <div className="space-y-3 border-t border-border/70 pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-2xs">
            <span className="font-bold tracking-wider text-muted-foreground uppercase">
              Download Government-Ready Output Files
            </span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="size-3" /> Ready for direct upload to GST Portal (gst.gov.in)
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DownloadCard
              icon={FileJson}
              title="GSTR-1 JSON"
              badge="GSTN v3.0 Schema"
              body="Government-ready JSON file ready for direct upload to GST Portal (gst.gov.in)."
              onClick={() => download("json")}
            />
            <DownloadCard
              icon={FileXls}
              title="GSTN Official Excel Template"
              badge="Government Format"
              body="Multi-sheet Excel workbook matching government tables (B2CS, ECO 14, HSN 12 & DOCS)."
              onClick={() => download("excel")}
            />
          </div>

          {/* Bottom Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/[0.08] via-primary/[0.02] to-transparent p-4 sm:p-5">
            <div className="text-center sm:text-left space-y-0.5">
              <h4 className="text-sm font-bold text-foreground">
                Process your actual marketplace spreadsheets with 100% accuracy
              </h4>
              <p className="text-2xs text-muted-foreground">
                Get started with <strong>30-Day Free Trial (7 GSTIN capacity)</strong>. No credit card required.
              </p>
            </div>
            <Button asChild variant="brand" size="md" className="w-full sm:w-auto shrink-0 shadow-md">
              <Link href="/register">
                <Zap className="size-3.5" />
                <span>Start Free Trial</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
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
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
        active
          ? "bg-foreground text-background shadow-xs"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
      {badge && (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.2 text-3xs font-mono",
            active ? "bg-background/20 text-background" : "bg-muted-foreground/15 text-muted-foreground"
          )}
        >
          {badge}
        </span>
      )}
    </button>
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
      className="group flex flex-col items-start gap-1 rounded-xl border border-border/80 bg-card p-3.5 text-left transition-all duration-200 hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex w-full items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform duration-200 group-hover:scale-105">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-3xs font-semibold text-muted-foreground">
          {badge}
        </span>
      </div>
      <span className="mt-1 flex items-center gap-1 text-xs font-bold text-foreground group-hover:text-primary transition-colors">
        {title}
        <Download className="size-3 text-muted-foreground ml-0.5" aria-hidden />
      </span>
      <span className="text-3xs leading-relaxed text-muted-foreground">{body}</span>
    </button>
  );
}

function RawTable({ rows }: { rows: RawRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead className="bg-muted/70 text-3xs tracking-wider text-muted-foreground uppercase font-semibold">
          <tr>
            <th className="px-3.5 py-2">Platform</th>
            <th className="px-3.5 py-2">Order ID</th>
            <th className="px-3.5 py-2">Date</th>
            <th className="px-3.5 py-2">Raw State Name</th>
            <th className="px-3.5 py-2">Type</th>
            <th className="px-3.5 py-2 text-right">Invoice Amount</th>
            <th className="px-3.5 py-2 text-right">Tax Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card font-mono text-2xs">
          {rows.map((row, i) => (
            <tr
              key={row.orderId + row.invoiceDate + i}
              className={cn(
                "hover:bg-muted/30 transition-colors font-sans",
                row.transactionType === "Refund" && "bg-rose-500/[0.04]"
              )}
            >
              <td className="px-3.5 py-2 font-medium text-foreground">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-3xs font-semibold text-primary-ink">
                  {row.platform}
                </span>
              </td>
              <td className="px-3.5 py-2 font-mono text-3xs text-muted-foreground">{row.orderId}</td>
              <td className="px-3.5 py-2 whitespace-nowrap text-muted-foreground">{row.invoiceDate}</td>
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
                  <span className="text-muted-foreground text-3xs">Shipment</span>
                )}
              </td>
              <td className="px-3.5 py-2 text-right font-medium tabular-nums font-mono">{row.invoiceAmount}</td>
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

function OutputTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-emerald-500/25">
      <table className="w-full min-w-[500px] text-left text-xs">
        <thead className="bg-emerald-500/10 text-3xs tracking-wider text-emerald-800 dark:text-emerald-200 uppercase font-semibold">
          <tr>
            <th className="px-3.5 py-2">Place of Supply (POS)</th>
            <th className="px-3.5 py-2 text-right">GST Rate</th>
            <th className="px-3.5 py-2 text-right">Net Taxable (₹)</th>
            <th className="px-3.5 py-2 text-right">IGST (₹)</th>
            <th className="px-3.5 py-2 text-right">CGST (₹)</th>
            <th className="px-3.5 py-2 text-right">SGST (₹)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {GSTR1_ROWS.map((row) => (
            <tr key={row.placeOfSupply + row.rate} className="hover:bg-muted/30 transition-colors">
              <td className="px-3.5 py-2 font-medium">
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-2xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {row.placeOfSupply}
                </span>
                {row.netned && (
                  <span className="mt-0.5 block text-3xs text-muted-foreground font-sans">returns netted</span>
                )}
              </td>
              <td className="px-3.5 py-2 text-right font-mono text-2xs tabular-nums">{row.rate}%</td>
              <td className="px-3.5 py-2 text-right font-bold tabular-nums font-mono text-2xs text-foreground">
                ₹{row.taxableValue.toLocaleString("en-IN")}
              </td>
              <td className="px-3.5 py-2 text-right text-muted-foreground tabular-nums font-mono text-2xs">
                {row.igst ? `₹${row.igst.toLocaleString("en-IN")}` : "—"}
              </td>
              <td className="px-3.5 py-2 text-right text-muted-foreground tabular-nums font-mono text-2xs">
                {row.cgst ? `₹${row.cgst.toLocaleString("en-IN")}` : "—"}
              </td>
              <td className="px-3.5 py-2 text-right text-muted-foreground tabular-nums font-mono text-2xs">
                {row.sgst ? `₹${row.sgst.toLocaleString("en-IN")}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EcoTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80">
      <table className="w-full min-w-[500px] text-left text-xs">
        <thead className="bg-muted/70 text-3xs tracking-wider text-muted-foreground uppercase font-semibold">
          <tr>
            <th className="px-3.5 py-2">E-Commerce Operator</th>
            <th className="px-3.5 py-2">ECO GSTIN</th>
            <th className="px-3.5 py-2 text-right">Gross Sales</th>
            <th className="px-3.5 py-2 text-right">Returns</th>
            <th className="px-3.5 py-2 text-right">Net Taxable</th>
            <th className="px-3.5 py-2 text-right">TCS u/s 52</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {DEMO_ECO_ROWS.map((eco) => (
            <tr key={eco.ecoGstin} className="hover:bg-muted/30 transition-colors">
              <td className="px-3.5 py-2 font-medium text-foreground">{eco.ecoName}</td>
              <td className="px-3.5 py-2 font-mono text-3xs text-muted-foreground">{eco.ecoGstin}</td>
              <td className="px-3.5 py-2 text-right font-medium tabular-nums font-mono text-2xs">₹{eco.grossSales.toLocaleString("en-IN")}</td>
              <td className="px-3.5 py-2 text-right text-rose-500 font-medium tabular-nums font-mono text-2xs">−₹{eco.returnsNetted.toLocaleString("en-IN")}</td>
              <td className="px-3.5 py-2 text-right font-bold tabular-nums font-mono text-2xs text-foreground">₹{eco.netTaxable.toLocaleString("en-IN")}</td>
              <td className="px-3.5 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold tabular-nums text-2xs">₹{eco.tcsDeducted.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HsnTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80">
      <table className="w-full min-w-[500px] text-left text-xs">
        <thead className="bg-muted/70 text-3xs tracking-wider text-muted-foreground uppercase font-semibold">
          <tr>
            <th className="px-3.5 py-2">HSN Code</th>
            <th className="px-3.5 py-2">Description</th>
            <th className="px-3.5 py-2">UQC</th>
            <th className="px-3.5 py-2 text-right">Total Qty</th>
            <th className="px-3.5 py-2 text-right">Taxable Value</th>
            <th className="px-3.5 py-2 text-right">Rate</th>
            <th className="px-3.5 py-2 text-right">Tax Liability</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card">
          {DEMO_HSN_ROWS.map((hsn) => (
            <tr key={hsn.hsnCode} className="hover:bg-muted/30 transition-colors">
              <td className="px-3.5 py-2 font-mono text-2xs font-semibold text-primary-ink">{hsn.hsnCode}</td>
              <td className="px-3.5 py-2 text-foreground font-medium">{hsn.description}</td>
              <td className="px-3.5 py-2 font-mono text-3xs text-muted-foreground">{hsn.uqc}</td>
              <td className="px-3.5 py-2 text-right font-medium tabular-nums font-mono text-2xs">{hsn.quantity}</td>
              <td className="px-3.5 py-2 text-right font-bold tabular-nums font-mono text-2xs text-foreground">₹{hsn.taxableValue.toLocaleString("en-IN")}</td>
              <td className="px-3.5 py-2 text-right font-mono text-muted-foreground text-2xs">{hsn.rate}%</td>
              <td className="px-3.5 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono text-2xs">₹{hsn.taxAmount.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransformationList() {
  return (
    <div className="rounded-xl border border-border/80 bg-subtle/50 p-4">
      <p className="mb-3 text-3xs font-bold tracking-wider text-muted-foreground uppercase">
        Engineered Compliance Transformations
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {TRANSFORMATIONS.map((t) => (
          <li key={t.id} className="flex gap-2 text-left rounded-lg bg-card/80 border border-border/60 p-2.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-xs font-bold text-foreground">{t.label}</p>
              <p className="text-3xs text-muted-foreground mt-0.5">{t.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
