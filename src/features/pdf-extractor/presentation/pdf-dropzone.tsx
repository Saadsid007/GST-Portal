"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileText, X, AlertCircle } from "lucide-react";

interface PdfDropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  isProcessing: boolean;
  onExtract: () => void;
}

export function PdfDropzone({
  files,
  onFilesChange,
  isProcessing,
  onExtract,
}: PdfDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (droppedFiles.length > 0) {
      onFilesChange([...files, ...droppedFiles]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      onFilesChange([...files, ...selected]);
    }
  };

  const removeFile = (idx: number) => {
    const updated = [...files];
    updated.splice(idx, 1);
    onFilesChange(updated);
  };

  const clearAll = () => {
    onFilesChange([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-sm">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[0.99]"
            : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-3 shadow-inner">
          <UploadCloud className="h-7 w-7 animate-pulse" />
        </div>

        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Upload PDF Invoices in Bulk
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md">
          Drag and drop B2B, B2C, D2C store, or offline vendor PDF invoices. We will
          extract GSTINs, POS, HSN, Tax, and classify them automatically.
        </p>

        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-200/60 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          Supports multiple PDF files up to 50+ invoices at once
        </span>
      </div>

      {files.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Selected Files ({files.length})
            </span>
            <button
              onClick={clearAll}
              disabled={isProcessing}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 shadow-sm"
              >
                <FileText className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                <span className="truncate max-w-[180px] font-medium" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  disabled={isProcessing}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              onClick={onExtract}
              disabled={isProcessing || files.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Extracting Invoices...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>Extract & Classify {files.length} Invoice{files.length > 1 ? "s" : ""}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
