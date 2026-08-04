"use client";

import { useState } from "react";
import { FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateGstr1ExcelAction } from "@/features/convert/actions/convert.actions";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Only the fields this component actually uses. Passing the whole Prisma row would drag
 * Decimal instances across the server/client boundary, which React cannot serialize.
 */
interface Props {
  record: {
    gstinNumber: string;
    returnPeriod: string;
    jsonPayload: unknown;
    normalizedData: unknown;
  };
}

export function HistoryDownloader({ record }: Props) {
  const [loadingExcel, setLoadingExcel] = useState(false);

  function downloadJson() {
    if (!record.jsonPayload) return;
    const json = JSON.stringify(record.jsonPayload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_${record.gstinNumber}_${record.returnPeriod}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON downloaded");
  }

  async function downloadExcel() {
    setLoadingExcel(true);
    try {
      const rows = (record.normalizedData ?? []) as unknown as NormalizedInvoiceRow[];
      const res = await generateGstr1ExcelAction(rows, record.gstinNumber, record.returnPeriod);
      if (!res.success) {
        toast.error("Failed to generate Excel");
        return;
      }
      const buffer = new Uint8Array(res.data.buffer);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR1_${record.gstinNumber}_${record.returnPeriod}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch {
      toast.error("Failed to generate Excel");
    } finally {
      setLoadingExcel(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={downloadJson}
        title="Download JSON"
        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-blue-500/10 hover:text-blue-500"
      >
        <FileJson className="size-4" />
      </button>
      <button
        onClick={downloadExcel}
        disabled={loadingExcel}
        title="Download Excel"
        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-emerald-500/10 hover:text-emerald-500 disabled:opacity-50"
      >
        {loadingExcel ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-4" />
        )}
      </button>
    </div>
  );
}
