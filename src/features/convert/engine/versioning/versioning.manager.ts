import * as XLSX from "xlsx";
import { PREDEFINED_TEMPLATES } from "@/features/convert/engine/mapping/mapping.templates";

export interface ParserVersionInfo {
  platformId: string;
  version: string; // e.g. "v1", "v2", "v3"
  label: string;
  description: string;
  isCurrent: boolean;
}

export const PARSER_VERSIONS: Record<string, ParserVersionInfo[]> = {
  amazon: [
    {
      platformId: "amazon",
      version: "v3",
      label: "Amazon MTR 2025 (v3)",
      description: "Latest Amazon Merchant Tax Report layout",
      isCurrent: true,
    },
    {
      platformId: "amazon",
      version: "v2",
      label: "Amazon MTR 2024 (v2)",
      description: "Legacy Amazon MTR B2B/B2C layout",
      isCurrent: false,
    },
    {
      platformId: "amazon",
      version: "v1",
      label: "Amazon Tax Report (v1)",
      description: "Original Amazon Merchant Report layout",
      isCurrent: false,
    },
  ],
  meesho: [
    {
      platformId: "meesho",
      version: "v2",
      label: "Meesho Panel 2025 (v2)",
      description: "Current Meesho Supplier Sales & Return reports",
      isCurrent: true,
    },
    {
      platformId: "meesho",
      version: "v1",
      label: "Meesho Panel (v1)",
      description: "Original Meesho Supplier report",
      isCurrent: false,
    },
  ],
  flipkart: [
    {
      platformId: "flipkart",
      version: "v2",
      label: "Flipkart Seller Hub (v2)",
      description: "Latest Flipkart Seller Hub GST sales export",
      isCurrent: true,
    },
    {
      platformId: "flipkart",
      version: "v1",
      label: "Flipkart Seller Hub (v1)",
      description: "Legacy Flipkart Sales report",
      isCurrent: false,
    },
  ],
  custom: [
    {
      platformId: "custom",
      version: "v1",
      label: "Custom Template Builder (v1)",
      description: "Universal Excel / CSV mapper template",
      isCurrent: true,
    },
  ],
};

/**
 * Versioning & Template Manager — Generates sample Excel templates per platform and manages format versions.
 */
export class VersioningManager {
  /**
   * Get version history for a platform.
   */
  static getVersions(platformId: string): ParserVersionInfo[] {
    return (
      PARSER_VERSIONS[platformId] ?? [
        {
          platformId,
          version: "v1",
          label: `${platformId.toUpperCase()} Standard (v1)`,
          description: "Standard marketplace format",
          isCurrent: true,
        },
      ]
    );
  }

  /**
   * Generate sample Excel template buffer for testing or download.
   */
  static generateSampleExcel(platformId: string): Uint8Array {
    const templateHeaders = PREDEFINED_TEMPLATES[platformId] ?? {
      invoiceNumber: "Invoice Number",
      invoiceDate: "Invoice Date",
      buyerGstin: "Buyer GSTIN",
      buyerName: "Buyer Name",
      placeOfSupply: "Place of Supply",
      hsnCode: "HSN Code",
      quantity: "Quantity",
      taxableValue: "Taxable Value",
      cgstAmount: "CGST Amount",
      sgstAmount: "SGST Amount",
      igstAmount: "IGST Amount",
      totalValue: "Total Amount",
    };

    // Sample data rows
    const sampleRow1: Record<string, unknown> = {};
    const sampleRow2: Record<string, unknown> = {};

    for (const [key, headerName] of Object.entries(templateHeaders)) {
      if (key === "invoiceNumber") {
        sampleRow1[headerName] = "INV-2025-001";
        sampleRow2[headerName] = "INV-2025-002";
      } else if (key === "invoiceDate") {
        sampleRow1[headerName] = "2025-07-10";
        sampleRow2[headerName] = "2025-07-12";
      } else if (key === "buyerGstin") {
        sampleRow1[headerName] = "27AAAAA0000A1Z5";
        sampleRow2[headerName] = "";
      } else if (key === "buyerName") {
        sampleRow1[headerName] = "Acme Retail Pvt Ltd";
        sampleRow2[headerName] = "John Doe";
      } else if (key === "placeOfSupply") {
        sampleRow1[headerName] = "27";
        sampleRow2[headerName] = "07";
      } else if (key === "hsnCode") {
        sampleRow1[headerName] = "998313";
        sampleRow2[headerName] = "998313";
      } else if (key === "quantity") {
        sampleRow1[headerName] = 2;
        sampleRow2[headerName] = 1;
      } else if (key === "taxableValue") {
        sampleRow1[headerName] = 5000;
        sampleRow2[headerName] = 1500;
      } else if (key === "cgstAmount") {
        sampleRow1[headerName] = 450;
        sampleRow2[headerName] = 0;
      } else if (key === "sgstAmount") {
        sampleRow1[headerName] = 450;
        sampleRow2[headerName] = 0;
      } else if (key === "igstAmount") {
        sampleRow1[headerName] = 0;
        sampleRow2[headerName] = 270;
      } else if (key === "totalValue") {
        sampleRow1[headerName] = 5900;
        sampleRow2[headerName] = 1770;
      } else {
        sampleRow1[headerName] = "";
        sampleRow2[headerName] = "";
      }
    }

    const workbook = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([sampleRow1, sampleRow2]);
    XLSX.utils.book_append_sheet(workbook, ws, "Sample Sales Data");

    return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Uint8Array;
  }
}
