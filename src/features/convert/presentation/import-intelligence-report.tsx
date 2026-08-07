"use client";

import { useState } from "react";
import {
  Brain,
  ChevronDown,
  CircleAlert,
  Copy,
  FileSpreadsheet,
  Layers,
  Scissors,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  Evidence,
  FieldResolution,
  ImportIntelligenceReport,
} from "@/features/convert/engine/universal/types";

/**
 * The import intelligence report.
 *
 * The engine makes a lot of decisions on the user's behalf, and a return is
 * something they sign. Every conclusion here is therefore shown with the
 * evidence that produced it, so the file can be audited rather than trusted.
 */

const DOCUMENT_LABELS: Record<string, string> = {
  SALES: "Sales register",
  RETURNS: "Returns register",
  CREDIT_NOTES: "Credit notes",
  MIXED: "Sales and returns",
  SETTLEMENT: "Settlement report",
  TAX_REPORT: "Tax report",
  UNKNOWN: "Unrecognised",
};

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 55) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function ScoreDial({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", scoreTone(score))}>{score}%</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-current transition-[width] duration-500"
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {evidence.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-2xs leading-relaxed">
          <span
            className={cn(
              "mt-0.5 rounded px-1 font-mono font-semibold tabular-nums",
              item.weight >= 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
            )}
          >
            {item.weight >= 0 ? "+" : ""}
            {Math.round(item.weight)}
          </span>
          <span className="text-muted-foreground">{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function ResolutionRow({ resolution }: { resolution: FieldResolution }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border/70 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-subtle/60"
      >
        <ChevronDown
          className={cn(
            "size-3.5 flex-shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{resolution.label}</span>
          <span className="block truncate text-2xs text-muted-foreground">
            {resolution.column ? `from “${resolution.column}”` : "not found in this workbook"}
          </span>
        </span>
        {resolution.required && !resolution.column && (
          <Badge variant="destructive" className="flex-shrink-0">
            Required
          </Badge>
        )}
        <span
          className={cn(
            "flex-shrink-0 text-xs font-bold tabular-nums",
            resolution.column ? scoreTone(resolution.confidence) : "text-muted-foreground"
          )}
        >
          {resolution.column ? `${resolution.confidence}%` : "—"}
        </span>
      </button>

      {open && (
        <div className="pb-3 pl-7">
          <p className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
            Why
          </p>
          <EvidenceList evidence={resolution.evidence} />

          {resolution.alternatives.length > 0 && (
            <>
              <p className="mt-3 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                Also considered
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {resolution.alternatives.map((alt) => (
                  <span
                    key={alt.column}
                    className="rounded border border-border bg-subtle px-1.5 py-0.5 text-2xs text-muted-foreground"
                  >
                    {alt.column} · {alt.confidence}%
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Brain;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold">
        <Icon className="size-3.5 text-primary-ink" aria-hidden />
        {title}
        {count !== undefined && (
          <span className="rounded bg-subtle px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </p>
      {children}
    </div>
  );
}

export function ImportIntelligencePanel({ report }: { report: ImportIntelligenceReport }) {
  const { understanding: u } = report;
  const bound = report.resolutions.filter((r) => r.column).length;

  return (
    <Card variant="solid" className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold">
            <FileSpreadsheet className="size-4 text-primary-ink" aria-hidden />
            <span className="truncate">{report.fileName}</span>
          </p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            Sheet “{u.rowCount > 0 ? report.sheetName : report.sheetName}” · {u.rowCount} rows ·{" "}
            {u.columnCount} columns · solved in {report.passes}{" "}
            {report.passes === 1 ? "pass" : "passes"}
          </p>
        </div>
        <Badge variant={report.scores.overall >= 80 ? "success" : "warning"}>
          {report.scores.overall}% confidence
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScoreDial label="Field discovery" score={report.scores.fieldDiscovery} />
        <ScoreDial label="Validation" score={report.scores.validation} />
        <ScoreDial label="Reasoning" score={report.scores.reasoning} />
        <ScoreDial label="Overall" score={report.scores.overall} />
      </div>

      <Section icon={Brain} title="What this workbook is">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-2xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Document</dt>
            <dd className="font-semibold">{DOCUMENT_LABELS[u.documentType] ?? u.documentType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Period</dt>
            <dd className="font-semibold">
              {u.period ? `${u.period.slice(0, 2)}/${u.period.slice(2)}` : "Not determined"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Supply mix</dt>
            <dd className="font-semibold">
              {u.supplyMix} · {Math.round(u.b2bShare * 100)}% with GSTIN
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="font-semibold">{u.marketplaceHint ?? "Unrecognised format"}</dd>
          </div>
        </dl>
        <EvidenceList evidence={u.documentEvidence} />
      </Section>

      <Section icon={Target} title="Field discovery" count={bound}>
        <div className="-my-1">
          {report.resolutions.map((resolution) => (
            <ResolutionRow key={resolution.field} resolution={resolution} />
          ))}
        </div>
        {report.unmappedColumns.length > 0 && (
          <p className="mt-3 text-2xs text-muted-foreground">
            <span className="font-semibold">Ignored columns:</span>{" "}
            {report.unmappedColumns.join(", ")}
          </p>
        )}
      </Section>

      {report.recoveries.length > 0 && (
        <Section icon={Sparkles} title="Recovered values" count={report.recoveries.length}>
          <div className="space-y-2">
            {report.recoveries.slice(0, 8).map((recovery, index) => (
              <div key={index} className="rounded border border-border/70 bg-subtle/50 p-2.5">
                <p className="flex items-center gap-2 text-2xs font-semibold">
                  Row {recovery.rowIndex + 1} · {recovery.field} ={" "}
                  <span className="text-primary-ink">{recovery.value}</span>
                  <span className={cn("ml-auto tabular-nums", scoreTone(recovery.confidence))}>
                    {recovery.confidence}%
                  </span>
                </p>
                <ol className="mt-1 space-y-0.5">
                  {recovery.path.map((step, i) => (
                    <li key={i} className="text-2xs text-muted-foreground">
                      {i + 1}. {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {report.recoveries.length > 8 && (
              <p className="text-2xs text-muted-foreground">
                and {report.recoveries.length - 8} more, all listed in the CA review report.
              </p>
            )}
          </div>
        </Section>
      )}

      {report.duplicates.length > 0 && (
        <Section icon={Copy} title="Duplicate analysis" count={report.duplicates.length}>
          <div className="space-y-1.5">
            {report.duplicates.slice(0, 6).map((verdict, index) => (
              <p key={index} className="text-2xs leading-relaxed text-muted-foreground">
                <span className="mr-1.5 rounded bg-subtle px-1.5 py-0.5 font-semibold text-foreground">
                  {verdict.classification.replace(/_/g, " ").toLowerCase()}
                </span>
                {verdict.explanation}
              </p>
            ))}
          </div>
        </Section>
      )}

      {report.discarded.length > 0 && (
        <Section
          icon={Scissors}
          title="Rows excluded before parsing"
          count={report.discarded.length}
        >
          <div className="space-y-1">
            {report.discarded.slice(0, 6).map((region, index) => (
              <p key={index} className="text-2xs text-muted-foreground">
                <span className="font-mono">Row {region.rowIndex + 1}</span> — {region.reason}
              </p>
            ))}
          </div>
        </Section>
      )}

      {report.questions.length > 0 && (
        <Section icon={CircleAlert} title="Needs your judgement" count={report.questions.length}>
          <div className="space-y-2">
            {report.questions.map((question) => (
              <div
                key={question.id}
                className="rounded border border-amber-500/40 bg-amber-500/5 p-2.5"
              >
                <p className="text-2xs font-semibold">{question.question}</p>
                <ul className="mt-1 space-y-0.5">
                  {question.options.map((option) => (
                    <li key={option.value} className="text-2xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{option.label}</span> —{" "}
                      {option.hint}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}
    </Card>
  );
}

export function ImportIntelligenceReports({ reports }: { reports: ImportIntelligenceReport[] }) {
  if (reports.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-primary-ink" aria-hidden />
        <h3 className="text-sm font-bold">How your files were understood</h3>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Each workbook was solved on its own evidence — no saved mapping, no per-marketplace parser.
        Expand any field to see exactly why it was matched.
      </p>
      {reports.map((report, index) => (
        <ImportIntelligencePanel key={`${report.fileName}-${index}`} report={report} />
      ))}
    </div>
  );
}
