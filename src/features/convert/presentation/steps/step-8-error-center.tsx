"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import type {
  EditableRowFields,
  NormalizedInvoiceRow,
} from "@/features/convert/types/convert.types";
import {
  applyAutoFixAction,
  applySuggestedRatesAction,
  revalidateAllAction,
  updateRowAction,
} from "@/features/convert/actions/convert.actions";
import {
  isConfidentSuggestion,
  RATE_CONFIDENCE_THRESHOLD,
  suggestGstRate,
} from "@/features/convert/engine/error-center/rate-suggester";
import { RowEditDialog } from "@/features/convert/presentation/steps/row-edit-dialog";
import { reconcileTcsAction } from "@/features/convert/actions/tcs.actions";
import { compareGstr1Action } from "@/features/convert/actions/gstr1-compare.actions";
import type { TcsReconciliationResult } from "@/features/convert/engine/tcs/tcs.reconciler";
import type { Gstr1ComparisonResult } from "@/features/convert/engine/comparison/gstr1.comparator";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Wand2,
  CheckCircle,
  AlertTriangle,
  Search,
  Layers,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Loader2,
  RefreshCw,
  Sparkles,
  Scale,
  Upload,
  GitCompare,
} from "lucide-react";
import { ImportIntelligenceReports } from "@/features/convert/presentation/import-intelligence-report";

interface Props {
  state: MultiConvertState;
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Only one of the two buckets is ever populated, so the sum is the effective slab. */
function totalRate(row: NormalizedInvoiceRow): number {
  return row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate;
}

/** A row is in review when nothing blocks it but something still wants a human glance. */
function needsReview(row: NormalizedInvoiceRow): boolean {
  return row.errors.length === 0 && (row.reviews?.length ?? 0) > 0;
}

type RowFilter = "all" | "errors" | "review" | "valid";

/**
 * The suggestion to show for a row, or null when the row already carries a rate.
 *
 * The rate check is not redundant with the stored suggestion: a row edited since the last
 * validation pass can still carry the previous pass's hint, and offering it would invite the
 * user to overwrite a rate they just set.
 */
function displaySuggestion(row: NormalizedInvoiceRow, rows: NormalizedInvoiceRow[]) {
  if (totalRate(row) > 0) return null;
  return row.suggestedGstRate ?? suggestGstRate(row, rows);
}

/**
 * A one-click Apply is only offered when the server would actually accept the suggestion —
 * showing it for a weaker inference produced a button that reported "Applied 0". The suggestion
 * itself is still displayed either way, since a 80%-confidence hint is useful to a human even
 * when it is not strong enough to write into a return unattended.
 */
function applicableSuggestion(row: NormalizedInvoiceRow, rows: NormalizedInvoiceRow[]) {
  const suggestion = displaySuggestion(row, rows);
  return isConfidentSuggestion(suggestion) ? suggestion : null;
}

export function Step8ErrorCenter({ state, onChange, onNext, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<"summary" | "invoices" | "tcs" | "gstr1cmp">(
    "summary"
  );
  const [filter, setFilter] = useState<RowFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [applyingRates, setApplyingRates] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  // TCS Reconciliation State
  const [tcsResult, setTcsResult] = useState<TcsReconciliationResult | null>(null);
  const [reconciling, setReconciling] = useState(false);

  // GSTR-1 Comparison State
  const [gstr1CmpResult, setGstr1CmpResult] = useState<Gstr1ComparisonResult | null>(
    state.gstr1CmpResult ?? null
  );
  const [gstr1CmpLabel, setGstr1CmpLabel] = useState<string>(state.gstr1CmpLabel ?? "");
  const [gstr1Comparing, setGstr1Comparing] = useState(false);
  const [gstr1CmpSection, setGstr1CmpSection] = useState<"b2b" | "b2cs" | "b2cl" | "cdnr">("b2b");

  const statement = state.statement;
  if (!statement) return null;

  const rows = state.rows;
  const rateErrorCount = rows.filter((r) => r.errors.some((e) => e.includes("GST rate"))).length;
  const inferredRows = rows.filter((r) => applicableSuggestion(r, rows));
  const reviewCount = rows.filter(needsReview).length;
  const editingRow = editingRowId ? rows.find((r) => r.id === editingRowId) : undefined;
  const pendingTaxable = rows
    .filter((r) => r.errors.length > 0)
    .reduce((s, r) => s + Math.abs(r.taxableValue), 0);
  const filteredRows = rows.filter((r) => {
    if (filter === "errors" && r.errors.length === 0) return false;
    if (filter === "review" && !needsReview(r)) return false;
    if (filter === "valid" && (r.errors.length > 0 || needsReview(r))) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.buyerName.toLowerCase().includes(q) ||
        r.buyerGstin.toLowerCase().includes(q) ||
        r.hsnCode.toLowerCase().includes(q) ||
        (r.sourcePlatformName ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleRowSave(patch: EditableRowFields) {
    if (!editingRowId) return;
    setSaving(true);
    try {
      const res = await updateRowAction(rows, editingRowId, patch, state.gstinNumber);
      if (res.success) {
        onChange({
          rows: res.data.rows,
          statement: res.data.statement,
          gstr1Json: res.data.gstr1Json,
        });
        setEditingRowId(null);
        if (res.data.rowErrors.length === 0) {
          toast.success("Row updated — no remaining issues");
        } else {
          toast.warning(`Row saved, but ${res.data.rowErrors.length} issue(s) remain`);
        }
      }
    } catch {
      toast.error("Failed to save the row");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevalidateAll() {
    setRevalidating(true);
    try {
      const res = await revalidateAllAction(rows, state.gstinNumber);
      if (res.success) {
        onChange({
          rows: res.data.rows,
          statement: res.data.statement,
          gstr1Json: res.data.gstr1Json,
        });
        toast.success(
          res.data.errorCount === 0
            ? "Revalidated — every row is clear"
            : `Revalidated — ${res.data.errorCount} row(s) still need attention`
        );
      }
    } catch {
      toast.error("Failed to revalidate");
    } finally {
      setRevalidating(false);
    }
  }

  async function handleAutoFixAll() {
    setAutoFixing(true);
    try {
      const res = await applyAutoFixAction(rows, state.gstinNumber);
      if (res.success) {
        onChange({
          rows: res.data.rows,
          statement: res.data.statement,
          gstr1Json: res.data.gstr1Json,
        });
        toast.success(
          `Auto-fixed ${res.data.fixSummary.totalFixed} data issues across GSTINs, POS, and HSN codes!`
        );
      }
    } catch {
      toast.error("Failed to apply auto-fixers");
    } finally {
      setAutoFixing(false);
    }
  }

  /** `rowIds` omitted applies every confident suggestion in the upload. */
  async function handleApplySuggestedRates(rowIds?: string[]) {
    setApplyingRates(true);
    try {
      const res = await applySuggestedRatesAction(rows, state.gstinNumber, rowIds);
      if (res.success) {
        onChange({
          rows: res.data.rows,
          statement: res.data.statement,
          gstr1Json: res.data.gstr1Json,
        });
        if (res.data.appliedCount === 0) {
          toast.warning("No rate was confident enough to apply — edit the row to set one");
        } else {
          toast.success(
            res.data.appliedCount === 1
              ? "Suggested GST rate applied"
              : `Applied ${res.data.appliedCount} suggested GST rates`
          );
        }
      }
    } catch {
      toast.error("Failed to apply suggested rates");
    } finally {
      setApplyingRates(false);
    }
  }

  async function handleTcsFileUpload(file: File) {
    setReconciling(true);
    try {
      const res = await reconcileTcsAction(rows, file);
      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setTcsResult(res.data);
      toast.success("TCS Report reconciled against GSTR-1 state-wise net sales!");
    } catch {
      toast.error("Failed to process TCS report");
    } finally {
      setReconciling(false);
    }
  }

  async function handleGstr1Compare(file: File) {
    setGstr1Comparing(true);
    try {
      const res = await compareGstr1Action(rows, file);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setGstr1CmpResult(res.data);
      setGstr1CmpLabel(res.data.sourceLabel);
      toast.success(
        `GSTR-1 Comparison complete — ${res.data.matchedCount} matched, ${res.data.mismatchCount} mismatched`
      );
    } catch {
      toast.error("Failed to process GSTR-1 comparison file");
    } finally {
      setGstr1Comparing(false);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
            Step 8 of 10
          </span>
          <h2 className="mt-2 text-xl font-bold">
            Smart Error Resolution Center & TCS Reconciliation
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Fix row errors inline, use Auto-Fix, or reconcile state-wise TCS with GST Portal
            exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRevalidateAll}
            disabled={revalidating}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold transition hover:bg-accent disabled:opacity-50"
          >
            {revalidating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            <span>Revalidate All Rows</span>
          </button>
          <button
            type="button"
            onClick={handleAutoFixAll}
            disabled={autoFixing || statement.errorInvoices === 0}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-50"
          >
            {autoFixing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wand2 className="size-3.5" />
            )}
            <span>Auto-Fix Data Issues</span>
          </button>
        </div>
      </div>

      {inferredRows.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary-ink" />
          <div className="space-y-1.5">
            <p>
              <span className="font-semibold">
                {inferredRows.length} row(s) have a suggested GST rate.
              </span>{" "}
              These are not errors — the rate was inferred from other rows in this upload at{" "}
              {RATE_CONFIDENCE_THRESHOLD}% confidence or higher. Review and apply them, or set a
              rate yourself.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={applyingRates}
                onClick={() => handleApplySuggestedRates()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {applyingRates ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Apply All {inferredRows.length} Rates
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("invoices");
                  setFilter("review");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 px-2.5 py-1 text-xs font-bold text-primary-ink transition hover:bg-primary/10"
              >
                Review Individually <ArrowRight className="size-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {rateErrorCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="space-y-1.5">
            <p>
              <span className="font-semibold">{rateErrorCount} row(s) have no GST rate.</span> The
              rate could not be inferred from the rest of the upload with enough confidence to
              suggest one. Use the edit button on each row to set it — or add a GST rate column to
              the source file and upload it again.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveTab("invoices");
                setFilter("errors");
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-warning px-2.5 py-1 text-xs font-bold text-warning-foreground transition hover:bg-warning/90"
            >
              Fix {rateErrorCount} Rows <ArrowRight className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs. The middle label alone exceeds a phone's width, so these scroll rather than
          pushing the third tab off-screen where the container would clip it. */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("summary")}
          className={cn(
            "flex-shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition",
            activeTab === "summary"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          Net Sales & Matrix Summary
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={cn(
            "flex flex-shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition",
            activeTab === "invoices"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          <Layers className="size-3.5 flex-shrink-0" />
          Interactive Error Editor ({statement.errorInvoices} Error
          {reviewCount > 0 ? ` / ${reviewCount} Review` : ""} / {statement.totalInvoices} Total)
        </button>
        <button
          onClick={() => setActiveTab("tcs")}
          className={cn(
            "flex flex-shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition",
            activeTab === "tcs"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          <Scale className="size-3.5 flex-shrink-0" />
          TCS Reconciliation {tcsResult ? "✓" : ""}
        </button>
        <button
          onClick={() => setActiveTab("gstr1cmp")}
          className={cn(
            "flex flex-shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition",
            activeTab === "gstr1cmp"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          <GitCompare className="size-3.5 flex-shrink-0" />
          GSTR-1 Comparison {gstr1CmpResult ? "✓" : ""}
        </button>
      </div>

      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-primary-ink uppercase">
                <Sparkles className="size-3.5" /> Net Sales Formula Result
              </span>
              <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                {statement.validInvoices} Valid / {statement.totalInvoices} Total
                {reviewCount > 0 && (
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-sans font-bold text-primary-ink">
                    {reviewCount} Needs Review
                  </span>
                )}
                {statement.errorInvoices > 0 && (
                  <span className="rounded bg-destructive/10 px-2 py-0.5 font-sans font-bold text-destructive">
                    {statement.errorInvoices} Need Attention
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Gross Sales</p>
                <p className="mt-1 text-xl font-bold text-success">
                  {formatCurrency(statement.totalSalesTaxable)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Tax: {formatCurrency(statement.totalSalesTax)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Sales Returns / Refunds
                </p>
                <p className="mt-1 text-xl font-bold text-destructive">
                  - {formatCurrency(statement.totalReturnTaxable)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Tax: - {formatCurrency(statement.totalReturnTax)}
                </p>
              </div>

              <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
                <p className="text-xs font-semibold text-primary-ink uppercase">
                  Net Sales Taxable
                </p>
                <p className="mt-1 text-2xl font-bold text-primary-ink">
                  {formatCurrency(statement.netTaxable)}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-primary-ink/90">
                  Net Tax: {formatCurrency(statement.netTax)}
                </p>
                {pendingTaxable > 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-destructive">
                    Pending validation: {formatCurrency(pendingTaxable)} not yet included
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[680px] text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left font-bold text-muted-foreground">
                  <th className="px-4 py-3">Marketplace</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right">Sales Taxable</th>
                  <th className="px-4 py-3 text-right">Returns Taxable</th>
                  <th className="px-4 py-3 text-right">Net Taxable</th>
                  <th className="px-4 py-3 text-right">Net Tax</th>
                </tr>
              </thead>
              <tbody>
                {statement.platformContributions.map((p) => (
                  <tr
                    key={p.platformId}
                    className="border-b border-border transition last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-3 font-bold">{p.platformName}</td>
                    <td className="px-4 py-3 text-right font-mono">{p.totalInvoices}</td>
                    <td className="px-4 py-3 text-right font-medium text-success">
                      {formatCurrency(p.salesTaxable)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-destructive">
                      - {formatCurrency(p.returnTaxable)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary-ink">
                      {formatCurrency(p.netTaxable)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(p.netTax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "tcs" && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <Scale className="size-5 text-primary-ink" /> TCS Reconciliation with GST Portal
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upload your GST Portal TCS Excel or CSV export to compare state-wise net sales and
                  tax calculations.
                </p>
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90">
                {reconciling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                <span>Upload GST Portal TCS Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleTcsFileUpload(f);
                  }}
                />
              </label>
            </div>

            {tcsResult && (
              <div className="space-y-4 border-t border-border pt-2">
                <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Generated GSTR-1 Taxable</p>
                    <p className="mt-1 text-lg font-bold text-primary-ink">
                      {formatCurrency(tcsResult.totalGstr1Taxable)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">GST Portal TCS Taxable</p>
                    <p className="mt-1 text-lg font-bold">
                      {formatCurrency(tcsResult.totalPortalTaxable)}
                    </p>
                  </div>
                  <div
                    className={`rounded-xl border p-3 ${tcsResult.isReconciled ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}
                  >
                    <p className="text-xs text-muted-foreground">Difference Amount</p>
                    <p
                      className={`mt-1 text-lg font-bold ${tcsResult.isReconciled ? "text-success" : "text-destructive"}`}
                    >
                      {formatCurrency(tcsResult.totalDiffTaxable)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left font-bold text-muted-foreground">
                        <th className="px-4 py-2.5">State Code</th>
                        <th className="px-4 py-2.5 text-right">GSTR-1 Taxable</th>
                        <th className="px-4 py-2.5 text-right">Portal TCS Taxable</th>
                        <th className="px-4 py-2.5 text-right">Difference</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tcsResult.stateComparisons.map((c) => (
                        <tr
                          key={c.stateCode}
                          className="border-b border-border transition last:border-0 hover:bg-accent/40"
                        >
                          <td className="px-4 py-2 font-mono font-bold">State {c.stateCode}</td>
                          <td className="px-4 py-2 text-right font-medium">
                            {formatCurrency(c.gstr1Taxable)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {formatCurrency(c.portalTaxable)}
                          </td>
                          <td className="px-4 py-2 text-right font-bold">
                            {formatCurrency(c.diffTaxable)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${c.status === "MATCHED" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                            >
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "gstr1cmp" && (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold">
                <GitCompare className="size-5 text-primary-ink" /> GSTR-1 Comparison
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Upload Amazon&apos;s auto-generated GSTR-1 or the Government GSTR-1 Template V2.1 to
                compare against our output. Reference data is <strong>never merged</strong> —
                it&apos;s validation-only.
              </p>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90">
              {gstr1Comparing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              <span>Upload GSTR-1 for Comparison</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleGstr1Compare(f);
                }}
              />
            </label>
          </div>

          {gstr1CmpResult && (
            <div className="space-y-5 border-t border-border pt-4">
              {/* Source label */}
              <p className="text-xs text-muted-foreground">
                Comparing against: <strong className="text-foreground">{gstr1CmpLabel}</strong>
              </p>

              {/* KPI summary */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Matched",
                    value: gstr1CmpResult.matchedCount,
                    color: "text-success",
                    bg: "bg-success/10 border-success/30",
                  },
                  {
                    label: "Mismatch",
                    value: gstr1CmpResult.mismatchCount,
                    color: "text-destructive",
                    bg: "bg-destructive/10 border-destructive/30",
                  },
                  {
                    label: "Only in Ours",
                    value: gstr1CmpResult.onlyInOursCount,
                    color: "text-warning",
                    bg: "bg-warning/10 border-warning/30",
                  },
                  {
                    label: "Only in Reference",
                    value: gstr1CmpResult.onlyInRefCount,
                    color: "text-muted-foreground",
                    bg: "bg-muted border-border",
                  },
                ].map((k) => (
                  <div key={k.label} className={`rounded-xl border p-3 text-center ${k.bg}`}>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className={`mt-1 text-xl font-bold ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Section tabs */}
              <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-2">
                {(["b2b", "b2cs", "b2cl", "cdnr"] as const).map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setGstr1CmpSection(sec)}
                    className={cn(
                      "flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition",
                      gstr1CmpSection === sec
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {sec === "b2cs"
                      ? `B2CS (${gstr1CmpResult.b2csSummary.length})`
                      : sec === "b2b"
                        ? `B2B (${gstr1CmpResult.b2bRows.length})`
                        : sec === "b2cl"
                          ? `B2CL (${gstr1CmpResult.b2clRows.length})`
                          : `CDNR (${gstr1CmpResult.cdnrRows.length + gstr1CmpResult.cdnurRows.length})`}
                  </button>
                ))}
              </div>

              {/* B2B table */}
              {gstr1CmpSection === "b2b" && (
                <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="sticky top-0 border-b border-border bg-muted/90 backdrop-blur">
                      <tr className="text-left font-semibold text-muted-foreground">
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Invoice #</th>
                        <th className="px-3 py-2.5">Buyer GSTIN</th>
                        <th className="px-3 py-2.5 text-right">Our Taxable</th>
                        <th className="px-3 py-2.5 text-right">Ref Taxable</th>
                        <th className="px-3 py-2.5 text-right">Diff</th>
                        <th className="px-3 py-2.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr1CmpResult.b2bRows.map((r, i) => (
                        <tr
                          key={`${r.invoiceNumber}-${i}`}
                          className={cn(
                            "border-b border-border last:border-0 hover:bg-accent/30",
                            r.status === "mismatch" && "bg-destructive/5",
                            r.status === "only_in_ours" && "bg-warning/5",
                            r.status === "only_in_ref" && "bg-muted/40"
                          )}
                        >
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                r.status === "matched" && "bg-success/10 text-success",
                                r.status === "mismatch" && "bg-destructive/10 text-destructive",
                                r.status === "only_in_ours" && "bg-warning/10 text-warning",
                                r.status === "only_in_ref" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {r.status === "matched"
                                ? "✓ Matched"
                                : r.status === "mismatch"
                                  ? "⚠ Mismatch"
                                  : r.status === "only_in_ours"
                                    ? "➕ Only Ours"
                                    : "➖ Only Ref"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">{r.invoiceNumber}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            {r.ourBuyerGstin || r.refBuyerGstin || "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {r.ourTaxableValue != null ? formatCurrency(r.ourTaxableValue) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {r.refTaxableValue != null ? formatCurrency(r.refTaxableValue) : "—"}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-bold",
                              r.diffTaxable && Math.abs(r.diffTaxable) > 2
                                ? "text-destructive"
                                : "text-success"
                            )}
                          >
                            {r.diffTaxable != null ? formatCurrency(r.diffTaxable) : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {r.notes.join("; ") || "—"}
                          </td>
                        </tr>
                      ))}
                      {gstr1CmpResult.b2bRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                            No B2B entries found in comparison
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* B2CS table */}
              {gstr1CmpSection === "b2cs" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-background p-3 text-center">
                      <p className="text-xs text-muted-foreground">Our B2CS Total</p>
                      <p className="mt-1 text-lg font-bold text-primary-ink">
                        {formatCurrency(gstr1CmpResult.b2csTotalOur)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3 text-center">
                      <p className="text-xs text-muted-foreground">Reference B2CS Total</p>
                      <p className="mt-1 text-lg font-bold">
                        {formatCurrency(gstr1CmpResult.b2csTotalRef)}
                      </p>
                    </div>
                  </div>
                  <div className="max-h-[400px] overflow-auto rounded-xl border border-border">
                    <table className="w-full min-w-[540px] text-xs">
                      <thead className="sticky top-0 border-b border-border bg-muted/90 backdrop-blur">
                        <tr className="text-left font-semibold text-muted-foreground">
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">State</th>
                          <th className="px-3 py-2.5 text-right">Rate</th>
                          <th className="px-3 py-2.5 text-right">Our Taxable</th>
                          <th className="px-3 py-2.5 text-right">Ref Taxable</th>
                          <th className="px-3 py-2.5 text-right">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstr1CmpResult.b2csSummary.map((r, i) => (
                          <tr
                            key={i}
                            className={cn(
                              "border-b border-border last:border-0 hover:bg-accent/30",
                              r.status === "mismatch" && "bg-destructive/5"
                            )}
                          >
                            <td className="px-3 py-2">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                  r.status === "matched" && "bg-success/10 text-success",
                                  r.status === "mismatch" && "bg-destructive/10 text-destructive",
                                  r.status === "only_in_ours" && "bg-warning/10 text-warning",
                                  r.status === "only_in_ref" && "bg-muted text-muted-foreground"
                                )}
                              >
                                {r.status === "matched"
                                  ? "✓"
                                  : r.status === "mismatch"
                                    ? "⚠"
                                    : r.status === "only_in_ours"
                                      ? "➕"
                                      : "➖"}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono">{r.placeOfSupply}</td>
                            <td className="px-3 py-2 text-right font-mono">{r.rate}%</td>
                            <td className="px-3 py-2 text-right">
                              {formatCurrency(r.ourTaxableValue)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatCurrency(r.refTaxableValue)}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2 text-right font-bold",
                                Math.abs(r.diffTaxable) > 2 ? "text-destructive" : "text-success"
                              )}
                            >
                              {formatCurrency(r.diffTaxable)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* B2CL table */}
              {gstr1CmpSection === "b2cl" && (
                <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead className="sticky top-0 border-b border-border bg-muted/90 backdrop-blur">
                      <tr className="text-left font-semibold text-muted-foreground">
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Invoice #</th>
                        <th className="px-3 py-2.5">POS</th>
                        <th className="px-3 py-2.5 text-right">Rate</th>
                        <th className="px-3 py-2.5 text-right">Our Taxable</th>
                        <th className="px-3 py-2.5 text-right">Ref Taxable</th>
                        <th className="px-3 py-2.5 text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr1CmpResult.b2clRows.map((r, i) => (
                        <tr
                          key={`${r.invoiceNumber}-${i}`}
                          className={cn(
                            "border-b border-border last:border-0 hover:bg-accent/30",
                            r.status === "mismatch" && "bg-destructive/5"
                          )}
                        >
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                r.status === "matched" && "bg-success/10 text-success",
                                r.status === "mismatch" && "bg-destructive/10 text-destructive",
                                r.status === "only_in_ours" && "bg-warning/10 text-warning",
                                r.status === "only_in_ref" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {r.status === "matched"
                                ? "✓"
                                : r.status === "mismatch"
                                  ? "⚠"
                                  : r.status === "only_in_ours"
                                    ? "➕"
                                    : "➖"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">{r.invoiceNumber}</td>
                          <td className="px-3 py-2 font-mono">
                            {r.ourPlaceOfSupply || r.refPlaceOfSupply || "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {r.ourRate ?? r.refRate ?? 0}%
                          </td>
                          <td className="px-3 py-2 text-right">
                            {r.ourTaxableValue != null ? formatCurrency(r.ourTaxableValue) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {r.refTaxableValue != null ? formatCurrency(r.refTaxableValue) : "—"}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-bold",
                              r.diffTaxable && Math.abs(r.diffTaxable) > 2
                                ? "text-destructive"
                                : "text-success"
                            )}
                          >
                            {r.diffTaxable != null ? formatCurrency(r.diffTaxable) : "—"}
                          </td>
                        </tr>
                      ))}
                      {gstr1CmpResult.b2clRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                            No B2CL entries found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CDNR + CDNUR table */}
              {gstr1CmpSection === "cdnr" && (
                <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                  <table className="w-full min-w-[700px] text-xs">
                    <thead className="sticky top-0 border-b border-border bg-muted/90 backdrop-blur">
                      <tr className="text-left font-semibold text-muted-foreground">
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Section</th>
                        <th className="px-3 py-2.5">Note #</th>
                        <th className="px-3 py-2.5">Buyer GSTIN</th>
                        <th className="px-3 py-2.5 text-right">Our Taxable</th>
                        <th className="px-3 py-2.5 text-right">Ref Taxable</th>
                        <th className="px-3 py-2.5 text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...gstr1CmpResult.cdnrRows, ...gstr1CmpResult.cdnurRows].map((r, i) => (
                        <tr
                          key={`${r.invoiceNumber}-${i}`}
                          className={cn(
                            "border-b border-border last:border-0 hover:bg-accent/30",
                            r.status === "mismatch" && "bg-destructive/5"
                          )}
                        >
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                r.status === "matched" && "bg-success/10 text-success",
                                r.status === "mismatch" && "bg-destructive/10 text-destructive",
                                r.status === "only_in_ours" && "bg-warning/10 text-warning",
                                r.status === "only_in_ref" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {r.status === "matched"
                                ? "✓"
                                : r.status === "mismatch"
                                  ? "⚠"
                                  : r.status === "only_in_ours"
                                    ? "➕"
                                    : "➖"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[11px] font-bold text-muted-foreground">
                            {r.section}
                          </td>
                          <td className="px-3 py-2 font-mono">{r.invoiceNumber}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            {r.ourBuyerGstin || r.refBuyerGstin || "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {r.ourTaxableValue != null ? formatCurrency(r.ourTaxableValue) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {r.refTaxableValue != null ? formatCurrency(r.refTaxableValue) : "—"}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-bold",
                              r.diffTaxable && Math.abs(r.diffTaxable) > 2
                                ? "text-destructive"
                                : "text-success"
                            )}
                          >
                            {r.diffTaxable != null ? formatCurrency(r.diffTaxable) : "—"}
                          </td>
                        </tr>
                      ))}
                      {gstr1CmpResult.cdnrRows.length === 0 &&
                        gstr1CmpResult.cdnurRows.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                              No credit/debit notes found in comparison
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="relative w-full sm:w-72">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search invoice, buyer, GSTIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-1.5 pr-3 pl-9 text-xs focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                All ({rows.length})
              </button>
              <button
                onClick={() => setFilter("errors")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filter === "errors"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Errors ({statement.errorInvoices})
              </button>
              <button
                onClick={() => setFilter("review")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filter === "review"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Needs Review ({reviewCount})
              </button>
              <button
                onClick={() => setFilter("valid")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filter === "valid"
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Valid ({statement.validInvoices - reviewCount})
              </button>
            </div>
          </div>

          {/* Scrolls in both axes: overflow-hidden used to clip the last five columns, including
              the Action button that is the only way to repair a row. */}
          <div className="max-h-[500px] overflow-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[1000px] text-xs">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur">
                <tr className="text-left font-semibold text-muted-foreground">
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Invoice #</th>
                  <th className="px-3 py-2.5">Buyer GSTIN</th>
                  <th className="px-3 py-2.5">POS</th>
                  <th className="px-3 py-2.5">HSN</th>
                  <th className="px-3 py-2.5 text-right">Taxable</th>
                  <th className="px-3 py-2.5 text-right">GST %</th>
                  <th className="px-3 py-2.5 text-center">Suggested Rate</th>
                  <th className="px-3 py-2.5 text-center">Status / Errors</th>
                  <th className="px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const suggestion = displaySuggestion(r, rows);
                  const canApply = isConfidentSuggestion(suggestion);
                  const inReview = needsReview(r);

                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-b border-border transition last:border-0 hover:bg-accent/30",
                        r.errors.length > 0 && "bg-destructive/5",
                        inReview && "bg-primary/5"
                      )}
                    >
                      <td className="px-3 py-2 font-bold">{r.sourcePlatformName}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                            r.transactionType === "Return"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-success/10 text-success"
                          )}
                        >
                          {r.transactionType}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">{r.invoiceNumber}</td>
                      <td className="px-3 py-2 font-mono">
                        {r.buyerGstin || <span className="text-muted-foreground italic">N/A</span>}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.placeOfSupply}</td>
                      <td className="px-3 py-2 font-mono">{r.hsnCode}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(r.taxableValue)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {totalRate(r) > 0 ? (
                          `${totalRate(r)}%`
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {suggestion ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              title={suggestion.reason}
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
                                canApply
                                  ? "bg-primary/10 text-primary-ink"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Sparkles className="size-3" />
                              {suggestion.rate}%
                              <span className="font-normal opacity-80">
                                · {suggestion.confidence}%
                              </span>
                            </span>
                            {canApply ? (
                              <button
                                type="button"
                                disabled={saving || applyingRates}
                                onClick={() => handleApplySuggestedRates([r.id])}
                                className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                              >
                                Apply
                              </button>
                            ) : (
                              <span
                                className="text-[10px] text-muted-foreground"
                                title={`Below the ${RATE_CONFIDENCE_THRESHOLD}% threshold — confirm it in the row editor`}
                              >
                                too weak
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.errors.length > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                            title={r.errors.join(", ")}
                          >
                            <AlertTriangle className="size-3" /> {r.errors[0]}
                          </span>
                        ) : inReview ? (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary-ink"
                            title={r.reviews?.join(", ")}
                          >
                            <Sparkles className="size-3" /> Needs Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                            <CheckCircle className="size-3" /> Valid
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingRowId(r.id)}
                          className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-primary-ink"
                          title="Open this row for editing"
                        >
                          <Edit2 className="size-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ImportIntelligenceReports reports={state.importReports} />

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent sm:w-auto"
        >
          <ArrowLeft className="size-4" /> Back to Mapping
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-6 py-2.5 font-bold text-primary-foreground shadow-accent transition hover:brightness-110 active:scale-[0.98] sm:w-auto"
        >
          <span>Next: Confirm & Generate Return</span>
          <ArrowRight className="size-4" />
        </button>
      </div>

      {editingRow && (
        <RowEditDialog
          row={editingRow}
          allRows={rows}
          saving={saving}
          onSave={handleRowSave}
          onClose={() => setEditingRowId(null)}
        />
      )}
    </div>
  );
}
