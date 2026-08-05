"use client";

import { useState } from "react";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Store,
  Layers,
  Sparkles,
} from "lucide-react";

interface Props {
  state: MultiConvertState;
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepReview({ state, onNext, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<"summary" | "platforms" | "invoices">("summary");
  const [filter, setFilter] = useState<"all" | "errors" | "valid">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const statement = state.statement;
  if (!statement) return null;

  const rows = state.rows;
  const filteredRows = rows.filter((r) => {
    if (filter === "errors" && r.errors.length === 0) return false;
    if (filter === "valid" && r.errors.length > 0) return false;
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

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold">Review Net Sales Statement & Validation</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Combined statement from{" "}
            <span className="font-semibold text-foreground">
              {statement.platformContributions.length} marketplace(s)
            </span>{" "}
            for period{" "}
            <span className="font-mono font-semibold text-foreground">{state.returnPeriod}</span>
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("summary")}
            className={cn(
              "rounded-lg px-3 py-1.5 transition",
              activeTab === "summary"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Net Sales Summary
          </button>
          <button
            onClick={() => setActiveTab("platforms")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
              activeTab === "platforms"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Store className="size-3.5" />
            Marketplace Matrix ({statement.platformContributions.length})
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
              activeTab === "invoices"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="size-3.5" />
            Transactions ({statement.totalInvoices})
          </button>
        </div>
      </div>

      {/* NET SALES SUMMARY TAB */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* Main Net Sales Formula Card */}
          <div className="space-y-4 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-primary-ink uppercase">
                <Sparkles className="size-3.5" /> Net Sales Engine Calculation
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {statement.validInvoices} Valid / {statement.totalInvoices} Total
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
              </div>
            </div>
          </div>

          {/* Tax Breakdown Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Net IGST</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(statement.netIgst)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Net CGST</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(statement.netCgst)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Net SGST</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(statement.netSgst)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Net CESS</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(statement.netCess)}</p>
            </div>
          </div>

          {/* GSTR-1 Category Cards */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold">GSTR-1 Section Summary</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">B2B (Registered)</p>
                <p className="mt-1 text-base font-bold">{statement.b2bCount}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatCurrency(statement.b2bNetTaxable)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">
                  B2CL (Large Interstate)
                </p>
                <p className="mt-1 text-base font-bold">{statement.b2clCount}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatCurrency(statement.b2clNetTaxable)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">B2CS (Small Consumer)</p>
                <p className="mt-1 text-base font-bold">{statement.b2csCount}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatCurrency(statement.b2csNetTaxable)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">CDNR (Credit Notes)</p>
                <p className="mt-1 text-base font-bold">{statement.cdnrCount}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatCurrency(statement.cdnrNetTaxable)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">EXP (Exports)</p>
                <p className="mt-1 text-base font-bold">{statement.expCount}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatCurrency(statement.expNetTaxable)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MARKETPLACE MATRIX TAB */}
      {activeTab === "platforms" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">Marketplace</th>
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

      {/* TRANSACTIONS TAB */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {/* Controls */}
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
                onClick={() => setFilter("valid")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filter === "valid"
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                Valid ({statement.validInvoices})
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
            </div>
          </div>

          {/* Transactions Table */}
          <div className="max-h-[500px] overflow-hidden overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur">
                <tr className="text-left font-semibold text-muted-foreground">
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Invoice #</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">POS</th>
                  <th className="px-3 py-2.5 text-right">Taxable</th>
                  <th className="px-3 py-2.5 text-right">Tax</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border transition last:border-0 hover:bg-accent/30"
                  >
                    <td className="px-3 py-2">
                      <span className="font-semibold text-foreground">{r.sourcePlatformName}</span>
                    </td>
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
                    <td className="px-3 py-2 text-muted-foreground">{r.invoiceDate}</td>
                    <td className="px-3 py-2 font-bold">{r.invoiceType}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.placeOfSupply}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(r.taxableValue)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(r.cgstAmount + r.sgstAmount + r.igstAmount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.errors.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                          title={r.errors.join(", ")}
                        >
                          <AlertTriangle className="size-3" /> {r.errors.length} Issue(s)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <CheckCircle className="size-3" /> Valid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          <ArrowLeft className="size-4" /> Back to Upload
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <span>Generate GSTR-1 & Download</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
