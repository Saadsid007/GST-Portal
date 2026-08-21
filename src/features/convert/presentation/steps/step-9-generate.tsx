"use client";

import { useEffect, useState, useTransition } from "react";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { formatCurrency } from "@/lib/utils";
import {
  consumeGenerationCreditAction,
  getGenerationQuoteAction,
} from "@/features/billing/actions/metering.actions";
import {
  ArrowLeft,
  ArrowRight,
  FileJson,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface Props {
  state: MultiConvertState;
  onNext: (watermark: boolean) => void;
  onBack: () => void;
}

interface QuoteData {
  planSlug: string;
  planName: string;
  isActive: boolean;
  isTrial: boolean;
  daysRemaining: number;
  watermark: boolean;
}

export function Step9Generate({ state, onNext, onBack }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getGenerationQuoteAction().then((result) => {
      if (result.success && result.data) setQuote(result.data);
    });
  }, []);

  function handleGenerate() {
    setGateError(null);
    startTransition(async () => {
      const result = await consumeGenerationCreditAction(null);
      if (!result.success) {
        setGateError(result.error);
        const refreshed = await getGenerationQuoteAction();
        if (refreshed.success && refreshed.data) setQuote(refreshed.data);
        return;
      }
      onNext(result.data.watermark);
    });
  }

  const statement = state.statement;
  if (!statement) return null;

  const blocked = quote !== null && !quote.isActive;
  const excludedRows = state.rows.filter((r) => r.errors.length > 0);
  const ecoWarnings = statement.issues.filter((i) => i.field === "ecoGstin").length;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Step 9 of 10 — Review & Final Approval
        </span>
        <h2 className="mt-2 text-xl font-bold">Confirm & Generate Government GSTR-1</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Review the final net sales statement summary and confirm approval before outputting GSTR-1
          return files.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
          Final Return Highlights
        </h3>

        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Target GSTIN</p>
            <p className="mt-1 truncate font-mono text-xs font-bold">{state.gstinNumber}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Return Filing Period</p>
            <p className="mt-1 font-mono text-xs font-bold">{state.returnPeriod}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Total Documents</p>
            <p className="mt-1 text-sm font-bold">{statement.totalInvoices}</p>
          </div>
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
            <p className="text-xs font-semibold text-primary-ink">Net Taxable Amount</p>
            <p className="mt-1 text-base font-bold text-primary-ink">
              {formatCurrency(statement.netTaxable)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
          <div className="space-y-1 rounded-xl border border-border bg-background p-4 text-xs">
            <p className="font-bold text-muted-foreground">Generated Files Format:</p>
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <FileJson className="size-4 text-primary-ink" /> GSTN Offline Tool v3.0 JSON Payload
            </p>
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />{" "}
              Official Multi-Sheet Excel (B2B, B2CL, B2CS, CDNR, HSN, ECO, DOCS)
            </p>
          </div>

          <div className="space-y-1 rounded-xl border border-border bg-background p-4 text-xs">
            <p className="font-mono font-bold text-muted-foreground">GST Compliance Checks:</p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ {statement.validInvoices} / {statement.totalInvoices} Invoices Validated
            </p>
            <p className="text-muted-foreground">✓ Place of supply & state codes verified</p>
          </div>
        </div>

        {excludedRows.length > 0 && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">
                {excludedRows.length} row(s) are pending validation and will not be included yet
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Nothing has been deleted — these rows still have errors, so{" "}
                {formatCurrency(excludedRows.reduce((s, r) => s + Math.abs(r.taxableValue), 0))} of
                taxable value stays out of the return until they are fixed.
              </p>
            </div>
          </div>
        )}

        {ecoWarnings > 0 && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="font-semibold">
                Table 14 cannot be generated — no operator GSTIN for {ecoWarnings} row(s)
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Table 14 reports supplies on which the marketplace collected TCS. Go back to
                Marketplaces step to map operator GSTINs.
              </p>
            </div>
          </div>
        )}

        {quote && !blocked && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs">
            <span className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              {quote.isTrial
                ? `30-Day Free Trial — Unlimited GSTR-1 Generations (${quote.daysRemaining} days left)`
                : `${quote.planName} Plan — Unlimited GSTR-1 Generations`}
            </span>
            <span className="flex items-center gap-1.5 font-bold text-primary-ink">
              <Zap className="size-3.5" /> Instant Generation
            </span>
          </div>
        )}

        {blocked && (
          <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-bold text-foreground">
                  Your Free Trial / Subscription has Expired
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upgrade your plan to unlock unlimited GSTR-1 generations. Your client data, GSTINs,
                  and historical reports remain safe and accessible.
                </p>
                <div className="mt-3">
                  <Link
                    href="/billing"
                    className="inline-flex items-center gap-1.5 rounded-lg brand-gradient px-4 py-1.5 text-xs font-bold text-white shadow transition hover:brightness-110"
                  >
                    View Plans &amp; Upgrade
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Approval Checkbox */}
        <button
          type="button"
          onClick={() => setConfirmed(!confirmed)}
          className="mt-3 flex w-full cursor-pointer items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-left transition hover:bg-primary/10"
        >
          {confirmed ? (
            <CheckSquare className="mt-0.5 size-5 flex-shrink-0 text-primary-ink" />
          ) : (
            <Square className="mt-0.5 size-5 flex-shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-xs font-bold text-foreground">
              I approve and confirm these GSTR-1 figures
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              I have reviewed the Net Sales calculation and state breakdowns and authorize
              generating official GSTR-1 JSON and Excel files.
            </p>
          </div>
        </button>
      </div>

      {!blocked && gateError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="font-semibold">{gateError}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent sm:w-auto"
        >
          <ArrowLeft className="size-4" /> Back to Error Resolution
        </button>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!confirmed || pending || blocked}
          className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-6 py-2.5 font-bold text-primary-foreground shadow-accent transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          <span>Generate Return &amp; Proceed to Download</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
