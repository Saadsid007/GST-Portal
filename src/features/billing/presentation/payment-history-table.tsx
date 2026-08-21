"use client";

import { CreditCard, CheckCircle2, XCircle, Clock } from "lucide-react";

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentType: string;
  planSlug: string | null;
  providerPaymentId: string | null;
  createdAt: Date;
}

interface Props {
  history: PaymentRecord[];
}

export function PaymentHistoryTable({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CreditCard className="mx-auto size-8 text-muted-foreground opacity-40" />
        <h4 className="mt-2 text-sm font-bold text-foreground">No Transactions Yet</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Your payment history and invoices will appear here once you subscribe or add capacity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h3 className="text-sm font-bold tracking-wide text-foreground uppercase">
          Payment &amp; Invoice History
        </h3>
        <p className="text-xs text-muted-foreground">
          Authoritative record of all plan subscriptions, renewals, and add-on capacity purchases.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-secondary/30 font-bold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Plan / Item</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 font-mono">Payment ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((tx) => {
              const dateStr = new Date(tx.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });

              const isSuccess = tx.status === "SUCCESS" || tx.status === "PAID";
              const isFailed = tx.status === "FAILED";

              return (
                <tr key={tx.id} className="hover:bg-accent/40 transition">
                  <td className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    {dateStr}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                    {tx.paymentType === "SUBSCRIPTION"
                      ? "Plan Subscription"
                      : tx.paymentType === "ADDITIONAL_GSTIN"
                        ? "Extra GSTIN Add-on"
                        : tx.paymentType === "RENEWAL"
                          ? "Plan Renewal"
                          : tx.paymentType}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground whitespace-nowrap">
                    {tx.planSlug ? tx.planSlug.replace("_", " ") : "GSTIN Slots"}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                    ₹{tx.amount}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isSuccess ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> Success
                      </span>
                    ) : isFailed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive">
                        <XCircle className="size-3" /> Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
                        <Clock className="size-3" /> {tx.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {tx.providerPaymentId || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
