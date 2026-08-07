import { normalizeStateCode } from "@/features/convert/domain/state-codes";
import type { NormalizedInvoiceRow, PlatformInfo } from "@/features/convert/types/convert.types";

export interface ColumnMapping {
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceType?: string;
  buyerName?: string;
  buyerGstin?: string;
  placeOfSupply?: string;
  hsnCode?: string;
  quantity?: string;
  taxableValue?: string;
  cgstRate?: string;
  sgstRate?: string;
  igstRate?: string;
  cessRate?: string;
  cgstAmount?: string;
  sgstAmount?: string;
  igstAmount?: string;
  cessAmount?: string;
  totalValue?: string;
  originalInvoiceNumber?: string;
  originalInvoiceDate?: string;
}

/**
 * NO LONGER IN THE CONVERSION PATH.
 *
 * Uploads are solved by `engine/universal` from the evidence in the file
 * itself. These parsers are retained only because `getAllPlatforms()` supplies
 * the platform names and icons the upload screen lists; nothing calls `parse()`
 * during a conversion, and editing one will not change how a file is read.
 *
 * Supporting a new marketplace does not require a parser here.
 */
export abstract class BasePlatformParser {
  abstract info: PlatformInfo;

  abstract autoMap(headers: string[]): ColumnMapping;

  abstract parse(
    rawRows: Record<string, unknown>[],
    supplierGstin?: string,
    customMapping?: ColumnMapping
  ): NormalizedInvoiceRow[];

  protected sanitizeHeader(header: string): string {
    return String(header || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  protected parseNumber(val: unknown): number {
    if (val === undefined || val === null || val === "") return 0;
    const num = Number(String(val).replace(/[^0-9.-]/g, ""));
    return isNaN(num) ? 0 : Math.round((num + Number.EPSILON) * 100) / 100;
  }

  protected parseDate(val: unknown): string {
    if (!val) return new Date().toISOString().split("T")[0]!;
    const str = String(val).trim();

    // Excel serial number e.g. 45123
    if (/^\d{5}$/.test(str)) {
      const excelEpoch = new Date(1899, 11, 30);
      const days = Number(str);
      const date = new Date(excelEpoch.getTime() + days * 86400000);
      return date.toISOString().split("T")[0]!;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str);
    if (ddmmyyyy && ddmmyyyy[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
      const day = ddmmyyyy[1].padStart(2, "0");
      const month = ddmmyyyy[2].padStart(2, "0");
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    // YYYY-MM-DD
    const yyyymmdd = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(str);
    if (yyyymmdd && yyyymmdd[1] && yyyymmdd[2] && yyyymmdd[3]) {
      const year = yyyymmdd[1];
      const month = yyyymmdd[2].padStart(2, "0");
      const day = yyyymmdd[3].padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0]!;
      }
    } catch {
      // Fallback
    }

    return new Date().toISOString().split("T")[0]!;
  }

  protected determineCategory(
    buyerGstin: string,
    taxableValue: number,
    supplierState: string,
    buyerState: string,
    isReturn = false
  ): "B2B" | "B2CL" | "B2CS" | "CDNR" | "EXP" {
    if (isReturn || taxableValue < 0) {
      return "CDNR";
    }

    if (buyerGstin && buyerGstin.trim().length === 15) {
      return "B2B";
    }

    const isInterState = supplierState !== "" && buyerState !== "" && supplierState !== buyerState;

    if (isInterState && taxableValue > 250000) {
      return "B2CL";
    }

    return "B2CS";
  }

  protected extractState(val: unknown, buyerGstin?: string): string {
    const fromGstin = normalizeStateCode(buyerGstin);
    if (fromGstin) return fromGstin;
    return normalizeStateCode(val);
  }

  protected getValue(row: Record<string, unknown>, key?: string): unknown {
    if (!key) return undefined;
    return row[key];
  }
}
