"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Receipt } from "lucide-react";
import { exportLedgerCsvAction, getLedgerAction } from "@/features/billing/actions/wallet.actions";
import { TRANSACTION_TYPES } from "@/features/billing/constants/billing.constants";
import type { LedgerEntry, TransactionType } from "@/features/billing/types/billing.types";

const LABELS: Record<TransactionType, string> = {
  RECHARGE: "Recharge",
  BONUS: "Wallet Bonus",
  GENERATION: "Return Generated",
  REFERRAL_REWARD: "Referral Reward",
  ADMIN_CREDIT: "Admin Credit",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
  PROMO_CODE: "Credit Code",
  CAMPAIGN: "Campaign Bonus",
  FREE_TRIAL: "Free Trial",
};

export function TransactionTable() {
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [loadedFilter, setLoadedFilter] = useState<TransactionType | "" | null>(null);
  const [filter, setFilter] = useState<TransactionType | "">("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let stale = false;
    void getLedgerAction(filter === "" ? null : filter).then((result) => {
      if (stale) return;
      if (result.success) setRows(result.data);
      setLoadedFilter(filter);
    });
    return () => {
      stale = true;
    };
  }, [filter]);

  // Derived rather than a `loading` flag set inside the effect: while the fetch for
  // a newly picked filter is in flight, `rows` still holds the previous filter's data.
  const loading = loadedFilter !== filter;

  const formatter = useMemo(
    () => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    []
  );

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportLedgerCsvAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "gstpilot-wallet-ledger.csv";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Receipt className="size-4 text-primary" /> Transaction History
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as TransactionType | "")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {LABELS[type]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p className="px-5 py-10 text-center text-xs text-muted-foreground">Loading ledger…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-muted-foreground">
          No transactions yet. Your recharges and generations will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-2.5 text-left font-bold">Date</th>
                <th className="px-5 py-2.5 text-left font-bold">Type</th>
                <th className="px-5 py-2.5 text-left font-bold">Description</th>
                <th className="px-5 py-2.5 text-right font-bold">Credits</th>
                <th className="px-5 py-2.5 text-right font-bold">Before</th>
                <th className="px-5 py-2.5 text-right font-bold">After</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-5 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatter.format(new Date(row.createdAt))}
                  </td>
                  <td className="px-5 py-2.5 font-semibold">{LABELS[row.type]}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">{row.description}</td>
                  <td
                    className={`px-5 py-2.5 text-right font-bold tabular-nums ${
                      row.creditAmount > 0
                        ? "text-emerald-600"
                        : row.creditAmount < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {row.creditAmount > 0 ? `+${row.creditAmount}` : row.creditAmount}
                  </td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground tabular-nums">
                    {row.balanceBefore}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                    {row.balanceAfter}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
