"use client";

import React, { useState, useMemo } from "react";
import { Search, Eye, Filter } from "lucide-react";
import type {
  ExtractedInvoice,
  FlatLineItemRow,
  PdfExtractionBatchResult,
} from "@/features/pdf-extractor/domain/types";

interface ExtractedInvoicesTableProps {
  data: PdfExtractionBatchResult;
}

export function ExtractedInvoicesTable({ data }: ExtractedInvoicesTableProps) {
  const [activeTab, setActiveTab] = useState<"all" | "b2b" | "b2c" | "lines" | "hsn">("all");
  const [hsnFilterMode, setHsnFilterMode] = useState<"b2b" | "all">("b2b");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<ExtractedInvoice | null>(null);

  const filteredInvoices = useMemo(() => {
    return data.invoices.filter((inv) => {
      if (activeTab === "b2b" && inv.classification !== "B2B") return false;
      if (activeTab === "b2c" && inv.classification !== "B2CS" && inv.classification !== "B2CL")
        return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.buyerName.toLowerCase().includes(q) ||
        inv.buyerGstin.toLowerCase().includes(q) ||
        inv.placeOfSupplyStateName.toLowerCase().includes(q) ||
        inv.fileName.toLowerCase().includes(q)
      );
    });
  }, [data.invoices, activeTab, searchQuery]);

  const filteredLineItems = useMemo(() => {
    return data.allLineItems.filter((it) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        it.invoiceNumber.toLowerCase().includes(q) ||
        it.buyerName.toLowerCase().includes(q) ||
        it.hsnCode.toLowerCase().includes(q) ||
        it.itemDescription.toLowerCase().includes(q) ||
        it.placeOfSupply.toLowerCase().includes(q)
      );
    });
  }, [data.allLineItems, searchQuery]);

  const currentHsnData = useMemo(() => {
    return hsnFilterMode === "b2b" ? data.b2bHsnSummary : data.hsnSummary;
  }, [hsnFilterMode, data.b2bHsnSummary, data.hsnSummary]);

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const getBadgeClass = (classification: string) => {
    switch (classification) {
      case "B2B":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "B2CL":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "B2CS":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "CDNR":
      case "CDNUR":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 w-fit">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            All Invoices ({data.invoices.length})
          </button>
          <button
            onClick={() => setActiveTab("b2b")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "b2b"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            B2B Table 4 ({data.b2bCount})
          </button>
          <button
            onClick={() => setActiveTab("b2c")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "b2c"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            B2C Table 7 ({data.b2cCount})
          </button>
          <button
            onClick={() => setActiveTab("lines")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "lines"
                ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Invoice Line Items ({data.allLineItems.length})
          </button>
          <button
            onClick={() => setActiveTab("hsn")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "hsn"
                ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            HSN Summary (Table 12)
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice, HSN, buyer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Table Content */}
      {activeTab === "hsn" ? (
        /* HSN Table View */
        <div>
          {/* Sub-filter toggle: B2B HSN vs All Invoices HSN */}
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing: {hsnFilterMode === "b2b" ? "B2B Invoices HSN Only (Matches Table 12 B2B)" : "All Invoices HSN (B2B + B2C Combined)"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHsnFilterMode("b2b")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                  hsnFilterMode === "b2b"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                }`}
              >
                B2B HSN Only ({data.b2bHsnSummary.length})
              </button>
              <button
                onClick={() => setHsnFilterMode("all")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                  hsnFilterMode === "all"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                }`}
              >
                All Invoices HSN ({data.hsnSummary.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">HSN/SAC</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">UQC</th>
                  <th className="py-3 px-4 text-right">Total Qty</th>
                  <th className="py-3 px-4 text-right">Rate</th>
                  <th className="py-3 px-4 text-right">Taxable Value</th>
                  <th className="py-3 px-4 text-right">IGST</th>
                  <th className="py-3 px-4 text-right">CGST</th>
                  <th className="py-3 px-4 text-right">SGST</th>
                  <th className="py-3 px-4 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {currentHsnData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No HSN records found.
                    </td>
                  </tr>
                ) : (
                  currentHsnData.map((h, i) => (
                    <tr
                      key={`${h.hsnCode}-${h.rate}-${i}`}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {h.hsnCode}
                      </td>
                      <td className="py-3 px-4 max-w-[220px] truncate font-medium text-slate-900 dark:text-slate-100" title={h.description}>
                        {h.description}
                      </td>
                      <td className="py-3 px-4 font-mono">{h.uqc}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {h.totalQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">{h.rate}%</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatINR(h.taxableValue)}
                      </td>
                      <td className="py-3 px-4 text-right">{formatINR(h.igstAmount)}</td>
                      <td className="py-3 px-4 text-right">{formatINR(h.cgstAmount)}</td>
                      <td className="py-3 px-4 text-right">{formatINR(h.sgstAmount)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatINR(h.totalValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "lines" ? (
        /* Flat Line Items View */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">HSN/SAC</th>
                <th className="py-3 px-4">Item Description</th>
                <th className="py-3 px-4 text-right">Qty</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right">Taxable</th>
                <th className="py-3 px-4 text-right">Tax</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4">Buyer / Customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredLineItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No line items found.
                  </td>
                </tr>
              ) : (
                filteredLineItems.map((it) => (
                  <tr
                    key={it.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {it.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold border ${getBadgeClass(it.classification)}`}>
                        {it.classification}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {it.hsnCode}
                    </td>
                    <td className="py-3 px-4 max-w-[240px] truncate" title={it.itemDescription}>
                      {it.itemDescription}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                      {it.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{it.rate}%</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatINR(it.taxableValue)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                      {formatINR(it.igstAmount + it.cgstAmount + it.sgstAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatINR(it.totalAmount)}
                    </td>
                    <td className="py-3 px-4 max-w-[160px] truncate text-slate-600 dark:text-slate-400" title={it.buyerName}>
                      {it.buyerName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Invoices Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Buyer Details</th>
                <th className="py-3 px-4">Place of Supply</th>
                <th className="py-3 px-4 text-right">Items</th>
                <th className="py-3 px-4 text-right">Taxable</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right">Tax Total</th>
                <th className="py-3 px-4 text-right">Total Invoice</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    No matching invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex flex-col">
                        <span>{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={inv.fileName}>
                          {inv.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {inv.invoiceDate || "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border ${getBadgeClass(
                          inv.classification
                        )}`}
                      >
                        {inv.classification}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="flex flex-col">
                        <span className="font-medium truncate text-slate-900 dark:text-slate-100" title={inv.buyerName}>
                          {inv.buyerName}
                        </span>
                        {inv.buyerGstin && (
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                            {inv.buyerGstin}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                        {inv.placeOfSupplyStateName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-600 dark:text-slate-400">
                      {inv.lineItems.length}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatINR(inv.taxableValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{inv.gstRate}%</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-600 dark:text-slate-300">
                      {formatINR(inv.totalTaxAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatINR(inv.totalInvoiceValue)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1 rounded-lg p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="View Extracted Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Invoice: {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500">File: {selectedInvoice.fileName}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <span className="font-semibold text-slate-500">Classification</span>
                <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                  {selectedInvoice.classification} ({selectedInvoice.documentType})
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <span className="font-semibold text-slate-500">Invoice Date</span>
                <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                  {selectedInvoice.invoiceDate || "Not Detected"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <span className="font-semibold text-slate-500">Buyer GSTIN</span>
                <p className="mt-1 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedInvoice.buyerGstin || "Unregistered (B2C)"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <span className="font-semibold text-slate-500">Place of Supply</span>
                <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                  {selectedInvoice.placeOfSupplyStateName}
                </p>
              </div>
            </div>

            {/* Line items in modal */}
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Line Items ({selectedInvoice.lineItems.length})
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
                      <th className="py-2 px-3">HSN</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Taxable</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedInvoice.lineItems.map((li, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-600">{li.hsnCode}</td>
                        <td className="py-2 px-3">{li.itemDescription}</td>
                        <td className="py-2 px-3 text-right font-semibold">{li.quantity}</td>
                        <td className="py-2 px-3 text-right">{formatINR(li.taxableValue)}</td>
                        <td className="py-2 px-3 text-right font-bold">{formatINR(li.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
