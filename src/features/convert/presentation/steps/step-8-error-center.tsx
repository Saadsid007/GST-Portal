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
import type { TcsReconciliationResult } from "@/features/convert/engine/tcs/tcs.reconciler";
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
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"summary" | "invoices" | "tcs">("summary");
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

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
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

        <div className="flex items-center gap-2">
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
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-50"
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
        <div className="flex items-start gap-2.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3.5 py-2.5 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-500" />
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
                className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/50 px-2.5 py-1 text-xs font-bold text-violet-600 transition hover:bg-violet-500/10"
              >
                Review Individually <ArrowRight className="size-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {rateErrorCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
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
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-amber-700"
            >
              Fix {rateErrorCount} Rows <ArrowRight className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("summary")}
          className={cn(
            "rounded-xl px-4 py-2 text-xs font-bold transition",
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
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition",
            activeTab === "invoices"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          <Layers className="size-3.5" />
          Interactive Error Editor ({statement.errorInvoices} Error
          {reviewCount > 0 ? ` / ${reviewCount} Review` : ""} / {statement.totalInvoices} Total)
        </button>
        <button
          onClick={() => setActiveTab("tcs")}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition",
            activeTab === "tcs"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          <Scale className="size-3.5" />
          TCS Reconciliation {tcsResult ? "✓" : ""}
        </button>
      </div>

      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-primary uppercase">
                <Sparkles className="size-3.5" /> Net Sales Formula Result
              </span>
              <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                {statement.validInvoices} Valid / {statement.totalInvoices} Total
                {reviewCount > 0 && (
                  <span className="rounded bg-violet-500/10 px-2 py-0.5 font-sans font-bold text-violet-600">
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
                <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
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
                <p className="mt-1 text-xl font-bold text-rose-500">
                  - {formatCurrency(statement.totalReturnTaxable)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Tax: - {formatCurrency(statement.totalReturnTax)}
                </p>
              </div>

              <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
                <p className="text-xs font-semibold text-primary uppercase">Net Sales Taxable</p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {formatCurrency(statement.netTaxable)}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-primary/90">
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

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-xs">
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
                    <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.salesTaxable)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-rose-500">
                      - {formatCurrency(p.returnTaxable)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">
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
                  <Scale className="size-5 text-primary" /> TCS Reconciliation with GST Portal
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
                    <p className="mt-1 text-lg font-bold text-primary">
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
                    className={`rounded-xl border p-3 ${tcsResult.isReconciled ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"}`}
                  >
                    <p className="text-xs text-muted-foreground">Difference Amount</p>
                    <p
                      className={`mt-1 text-lg font-bold ${tcsResult.isReconciled ? "text-emerald-600" : "text-rose-500"}`}
                    >
                      {formatCurrency(tcsResult.totalDiffTaxable)}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-xs">
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
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${c.status === "MATCHED" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}
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

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
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
                    ? "bg-violet-600 text-white"
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
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Valid ({statement.validInvoices - reviewCount})
              </button>
            </div>
          </div>

          <div className="max-h-[500px] overflow-hidden overflow-y-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs">
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
                        inReview && "bg-violet-500/5"
                      )}
                    >
                      <td className="px-3 py-2 font-bold">{r.sourcePlatformName}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                            r.transactionType === "Return"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-emerald-500/10 text-emerald-600"
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
                                  ? "bg-violet-500/10 text-violet-500"
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
                                className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
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
                            className="inline-flex items-center gap-1 rounded bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-600"
                            title={r.reviews?.join(", ")}
                          >
                            <Sparkles className="size-3" /> Needs Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            <CheckCircle className="size-3" /> Valid
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingRowId(r.id)}
                          className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-primary"
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

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          <ArrowLeft className="size-4" /> Back to Mapping
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
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
