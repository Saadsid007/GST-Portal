"use client";

import { useState } from "react";
import { AlertTriangle, Save, Sparkles } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { STATE_CODES } from "@/features/convert/domain/state-codes";
import { suggestGstRate } from "@/features/convert/engine/error-center/rate-suggester";
import type {
  EditableRowFields,
  NormalizedInvoiceRow,
} from "@/features/convert/types/convert.types";
import { cn } from "@/lib/utils";

interface Props {
  row: NormalizedInvoiceRow;
  /** Needed to re-derive a suggestion for a row edited since the last validation pass. */
  allRows: NormalizedInvoiceRow[];
  saving: boolean;
  onSave: (patch: EditableRowFields) => void;
  onClose: () => void;
}

/** Only one of the two buckets is ever populated, so the sum is the effective slab. */
function combinedRate(row: NormalizedInvoiceRow): number {
  return row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate;
}

const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28];

export function RowEditDialog({ row, allRows, saving, onSave, onClose }: Props) {
  const [form, setForm] = useState<EditableRowFields>({
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    buyerName: row.buyerName,
    buyerGstin: row.buyerGstin,
    placeOfSupply: row.placeOfSupply,
    hsnCode: row.hsnCode,
    quantity: row.quantity,
    taxableValue: row.taxableValue,
    gstRate: combinedRate(row),
  });

  function set<K extends keyof EditableRowFields>(key: K, value: EditableRowFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Suggested only while the row still has no rate of its own — a stored hint from an earlier
  // validation pass would otherwise invite overwriting a rate the user just set.
  const suggestion =
    combinedRate(row) > 0 ? null : (row.suggestedGstRate ?? suggestGstRate(row, allRows));
  const inputClass =
    "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Edit row ${row.rowIndex}`}
      description={`${row.sourcePlatformName} · ${row.transactionType} · ${row.invoiceNumber}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            loadingText="Saving…"
            onClick={() => onSave(form)}
          >
            <Save />
            Save &amp; revalidate row
          </Button>
        </>
      }
    >
      <div className="pb-5">
        {row.errors.length > 0 && (
          <div className="mx-5 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-destructive">
              <AlertTriangle className="size-3.5" /> {row.errors.length} issue
              {row.errors.length === 1 ? "" : "s"} on this row
            </p>
            <ul className="mt-1.5 space-y-0.5 pl-5 text-[11px] text-destructive">
              {row.errors.map((e) => (
                <li key={e} className="list-disc">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <label className="space-y-1">
            <span className={labelClass}>Invoice Number</span>
            <input
              className={inputClass}
              value={form.invoiceNumber}
              onChange={(e) => set("invoiceNumber", e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Invoice Date</span>
            <input
              type="date"
              className={inputClass}
              value={form.invoiceDate}
              onChange={(e) => set("invoiceDate", e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Buyer Name</span>
            <input
              className={inputClass}
              value={form.buyerName}
              onChange={(e) => set("buyerName", e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Buyer GSTIN</span>
            <input
              className={cn(inputClass, "font-mono uppercase")}
              placeholder="Leave blank for B2C"
              value={form.buyerGstin}
              onChange={(e) => set("buyerGstin", e.target.value.toUpperCase())}
            />
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Place of Supply</span>
            <select
              className={inputClass}
              value={form.placeOfSupply}
              onChange={(e) => set("placeOfSupply", e.target.value)}
            >
              <option value="">Select a state</option>
              {Object.entries(STATE_CODES).map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className={labelClass}>HSN / SAC Code</span>
            <input
              className={cn(inputClass, "font-mono")}
              placeholder="4, 6 or 8 digits"
              value={form.hsnCode}
              onChange={(e) => set("hsnCode", e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Quantity</span>
            <input
              type="number"
              className={inputClass}
              value={form.quantity}
              onChange={(e) => set("quantity", Number(e.target.value))}
            />
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Taxable Value</span>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={form.taxableValue}
              onChange={(e) => set("taxableValue", Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground">
              Negative for returns and credit notes.
            </span>
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className={labelClass}>GST Rate (%)</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {GST_SLABS.map((slab) => (
                <button
                  key={slab}
                  type="button"
                  onClick={() => set("gstRate", slab)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-bold transition",
                    form.gstRate === slab
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {slab}%
                </button>
              ))}
              <input
                type="number"
                step="0.01"
                aria-label="Custom GST rate"
                className={cn(inputClass, "w-24")}
                value={form.gstRate}
                onChange={(e) => set("gstRate", Number(e.target.value))}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              CGST/SGST or IGST is decided from the place of supply, and the tax amounts are
              recalculated from this rate on save.
            </span>
            {suggestion && (
              <button
                type="button"
                onClick={() => set("gstRate", suggestion.rate)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-primary/50 px-2 py-1 text-[11px] font-bold text-primary-ink transition hover:bg-primary/10"
              >
                <Sparkles className="size-3" />
                Use suggested {suggestion.rate}% ({suggestion.confidence}% confidence,{" "}
                {suggestion.source === "HSN" ? "same HSN" : "same description"},{" "}
                {suggestion.sampleSize} row{suggestion.sampleSize === 1 ? "" : "s"})
              </button>
            )}
          </label>
        </div>
      </div>
    </Modal>
  );
}
