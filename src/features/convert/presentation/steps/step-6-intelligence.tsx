"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { evaluateWorkbooksAction } from "@/features/convert/actions/convert.actions";
import type {
  QuestionAnswer,
  ImportIntelligenceReport,
} from "@/features/convert/engine/universal/types";
import type { SessionResult } from "@/features/convert/engine/pipeline/import-session.manager";
import { CANONICAL_FIELDS } from "@/features/convert/engine/universal/canonical-fields";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Bot,
  CheckCircle2,
} from "lucide-react";

interface Props {
  state: MultiConvertState;
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step6Intelligence({ state, onChange, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<ImportIntelligenceReport[]>([]);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  // File -> ExcelHeader -> SelectedCanonicalKey
  const [userMappings, setUserMappings] = useState<Record<string, Record<string, string>>>({});
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    let mounted = true;

    async function evaluate() {
      try {
        setLoading(true);
        const res = await evaluateWorkbooksAction(state.uploadedFiles, state.gstinNumber);
        if (!mounted) return;

        setReports(res.data.reports);
        setSessionResult(res.data.sessionResult as unknown as SessionResult);

        // Pre-fill initial user mappings from AI / engine resolutions
        const initialMappings: Record<string, Record<string, string>> = {};
        const initialAnswers: Record<string, Record<string, string>> = {};

        for (const report of res.data.reports) {
          initialMappings[report.fileName] = {};
          initialAnswers[report.fileName] = {};

          // Map resolutions
          for (const resItem of report.resolutions) {
            if (resItem.column) {
              initialMappings[report.fileName]![resItem.column] = resItem.field;
            }
          }

          // Questions
          for (const q of report.questions) {
            initialAnswers[report.fileName]![q.id] = "";
          }
        }

        setUserMappings(initialMappings);
        setAnswers(initialAnswers);
      } catch (err) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : "Evaluation failed";
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    evaluate();

    return () => {
      mounted = false;
    };
  }, [state.uploadedFiles]);

  function handleMappingChange(fileName: string, header: string, canonicalKey: string) {
    setUserMappings((prev) => ({
      ...prev,
      [fileName]: {
        ...prev[fileName],
        [header]: canonicalKey,
      },
    }));
  }

  function handleAnswer(fileName: string, questionId: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [fileName]: {
        ...prev[fileName],
        [questionId]: value,
      },
    }));
  }

  function handleNext() {
    // Check required questions
    for (const report of reports) {
      const fileAns = answers[report.fileName] || {};
      for (const q of report.questions) {
        if (!fileAns[q.id]) {
          toast.error(`Please answer all questions for ${report.fileName}`);
          return;
        }
      }
    }

    // Formatted answers
    const formattedAnswers: Record<string, QuestionAnswer[]> = {};
    for (const report of reports) {
      const fileAns = answers[report.fileName] || {};
      formattedAnswers[report.fileName] = Object.entries(fileAns).map(([id, value]) => ({
        id,
        value,
      }));
    }

    onChange({ answersByFile: formattedAnswers });
    onNext();
  }

  /**
   * Whether a model was actually consulted. Most uploads are recognised
   * marketplaces and never reach one, so naming Gemini and Grok unconditionally
   * advertised work the product did not do.
   */
  const aiWasUsed = reports.some((r) => r.aiResult);

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center space-y-4 p-8 text-center">
        <div className="relative">
          <Loader2 className="size-12 animate-spin text-primary" />
          <Sparkles className="absolute -top-1 -right-1 size-5 animate-pulse text-amber-500" />
        </div>
        <h2 className="text-xl font-bold">Reading your workbooks…</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Identifying each marketplace, reconstructing the tables and matching columns to GST
          fields.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="size-8" />
        </div>
        <h2 className="text-xl font-bold">Evaluation Failed</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
              Step 6 of 10
            </span>
            {aiWasUsed && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600">
                <Sparkles className="size-3.5 text-amber-500" /> AI column mapping
              </span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-bold">
            {aiWasUsed ? "Column mapping needs a look" : "Import understanding"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {aiWasUsed
              ? "One or more sheets were not a known marketplace format, so their columns were matched by AI. Check them before continuing."
              : "Every file was recognised and mapped by the engine. Review what it found, then continue."}
          </p>
        </div>

        {aiWasUsed && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1 font-semibold">
              <Bot className="size-3.5 text-blue-500" /> AI mappers
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Render Known Platforms First */}
        {sessionResult &&
          Object.entries(sessionResult.resultsByPlatform).map(([platformId, result]) => (
            <div
              key={platformId}
              className="overflow-hidden rounded-2xl border border-border bg-success/5 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border bg-success/10 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-success" />
                  <h3 className="font-bold tracking-wider text-success-ink uppercase">
                    {platformId} Adapter
                  </h3>
                  <span className="rounded-md bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground shadow-sm">
                    {result.sourceContext.reportType}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm font-semibold">
                  <span className="text-muted-foreground">Processed Files:</span>
                  <span className="text-foreground">{sessionResult.filesProcessed}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 p-4 sm:p-6">
                <div className="rounded-lg border border-border bg-background p-4 text-center">
                  <p className="text-xs font-semibold text-muted-foreground">Total Rows</p>
                  <p className="text-2xl font-bold">{result.totalRows}</p>
                </div>
                <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
                  <p className="text-xs font-semibold text-success">Valid Canonical</p>
                  <p className="text-2xl font-bold text-success">{result.validRows}</p>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                  <p className="text-xs font-semibold text-destructive">Error Rows</p>
                  <p className="text-2xl font-bold text-destructive">{result.errorRows}</p>
                </div>
              </div>
              <div className="px-6 pb-6 text-sm text-muted-foreground">
                <p>
                  This marketplace was recognised automatically. GSTPilot applied its deterministic
                  canonical mapping and kept each source isolated, so nothing here needs your input.
                </p>
              </div>
            </div>
          ))}

        {/* Sheets read and deliberately set aside. Stated plainly so a workbook
            never looks half-read, and so nobody hunts for a summary tab that
            "did not import". */}
        {(sessionResult?.skippedSheets?.length ?? 0) > 0 && (
          <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-5">
            <h3 className="text-sm font-bold text-foreground">
              Companion sheets skipped ({sessionResult!.skippedSheets.length})
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              These carry summaries and instructions, not line items. Every figure in them is
              rebuilt from your transactions, so importing them would double-count.
            </p>
            <ul className="mt-3 space-y-1.5">
              {sessionResult!.skippedSheets.map((sheet) => (
                <li
                  key={`${sheet.fileName}::${sheet.sheetName}`}
                  className="flex flex-wrap items-baseline gap-x-2 text-xs"
                >
                  <span className="font-mono font-medium text-foreground">{sheet.sheetName}</span>
                  <span className="text-muted-foreground">— {sheet.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {reports.length > 0 && (
          <h3 className="mt-8 text-lg font-bold">
            {aiWasUsed
              ? "Unrecognised files (AI mapping applied)"
              : "Unrecognised files (check the mapping)"}
          </h3>
        )}

        {reports.map((report) => {
          const aiRes = report.aiResult;
          // Use the sheet's actual headers in order. Deduplicate so React keys are unique.
          const rawHeaders =
            report.understanding.columnCount > 0
              ? report.resolutions.map((r) => r.column || r.field)
              : [];
          // Deduplicate: keep first occurrence of each header
          const seen = new Set<string>();
          const headersToMap = rawHeaders.filter((h) => {
            if (seen.has(h)) return false;
            seen.add(h);
            return true;
          });

          return (
            <div
              key={`${report.fileName}::${report.sheetName}`}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              {/* Report Header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">{report.fileName}</h3>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Sheet: {report.sheetName}
                  </span>
                </div>

                {aiRes && (
                  <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-0.5 text-xs font-semibold text-success">
                    <CheckCircle2 className="size-3.5" />
                    <span>AI Synthesis Applied ({aiRes.activeModels.join(" + ")})</span>
                  </div>
                )}
              </div>

              {/* Clean Mapping Table */}
              <div className="overflow-x-auto p-4 sm:p-6">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground uppercase">
                      <th className="pb-3 font-semibold">Excel Header</th>
                      <th className="pb-3 font-semibold">Mapped GST Canonical Field</th>
                      <th className="pb-3 font-semibold">Why this mapping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {headersToMap.map((header, idx) => {
                      const currentField = userMappings[report.fileName]?.[header] || "";
                      const aiExplanation =
                        aiRes?.explanations[header] ||
                        report.resolutions.find((r) => r.column === header)?.evidence[0]?.detail ||
                        (aiRes ? "Mapped by AI analysis" : "Matched by the engine");

                      return (
                        <tr
                          key={`${report.fileName}::${report.sheetName}-${header}-${idx}`}
                          className="hover:bg-muted/20"
                        >
                          <td className="py-3 font-mono font-bold text-foreground">{header}</td>
                          <td className="py-3 pr-4">
                            <select
                              value={currentField}
                              onChange={(e) =>
                                handleMappingChange(report.fileName, header, e.target.value)
                              }
                              className="w-full min-w-[200px] rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                            >
                              <option value="">-- Ignore Column --</option>
                              {CANONICAL_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label} ({f.key})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Sparkles className="size-3 flex-shrink-0 text-amber-500" />
                              {aiExplanation}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Questions Section (if required) */}
              {report.questions.length > 0 && (
                <div className="border-t border-border p-4 sm:p-6">
                  <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-warning-ink">
                    <AlertCircle className="size-4 text-warning" />
                    Human Clarification Required
                  </h4>
                  <div className="space-y-4">
                    {report.questions.map((q) => (
                      <div
                        key={q.id}
                        className="space-y-3 rounded-xl border border-warning/20 bg-warning/5 p-4"
                      >
                        <p className="text-sm font-semibold">{q.question}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = answers[report.fileName]?.[q.id] === opt.value;
                            return (
                              <button
                                key={`${opt.value}-${optIdx}`}
                                type="button"
                                onClick={() => handleAnswer(report.fileName, q.id, opt.value)}
                                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                                    : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
                                }`}
                              >
                                <span
                                  className={`text-sm font-semibold ${isSelected ? "text-primary-ink" : "text-foreground"}`}
                                >
                                  {opt.label}
                                </span>
                                {opt.hint && (
                                  <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {opt.hint}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Controls */}
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent sm:w-auto"
        >
          <ArrowLeft className="size-4" /> Back to Upload
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-6 py-2.5 font-bold text-primary-foreground shadow-accent transition hover:brightness-110 active:scale-[0.98] sm:w-auto"
        >
          <span>Confirm &amp; Process GSTR-1</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
