"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GstinProfile } from "@/generated/prisma/client";
import type {
  PlatformInfo,
  NormalizedInvoiceRow,
  NetSalesStatement,
  MultiUploadFileInput,
} from "@/features/convert/types/convert.types";
import { Step1Gstin } from "./steps/step-1-gstin";
import { Step2Period } from "./steps/step-2-period";
import { Step3Platforms } from "./steps/step-3-platforms";
import { Step4RulesCheck } from "./steps/step-4-rules-check";
import { Step5Upload } from "./steps/step-5-upload";
import { Step6Mapping } from "./steps/step-6-mapping";
import { Step7Processing } from "./steps/step-7-processing";
import { Step8ErrorCenter } from "./steps/step-8-error-center";
import { Step9Generate } from "./steps/step-9-generate";
import { Step10Download } from "./steps/step-10-download";
import { cn, formatPeriod } from "@/lib/utils";
import {
  Check,
  Lock,
  Building2,
  CalendarRange,
  Store,
  ShieldCheck,
  UploadCloud,
  Columns3,
  Cpu,
  AlertTriangle,
  FileJson,
  Download,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "GST Profile", icon: Building2, hint: "Pick the GSTIN you are filing for" },
  { id: 2, label: "Return Period", icon: CalendarRange, hint: "Choose the month of the return" },
  { id: 3, label: "Marketplaces", icon: Store, hint: "Select every platform to combine" },
  { id: 4, label: "Rules Check", icon: ShieldCheck, hint: "Confirm the files each platform needs" },
  { id: 5, label: "Upload Reports", icon: UploadCloud, hint: "Attach the marketplace exports" },
  { id: 6, label: "Mapping", icon: Columns3, hint: "Match report columns to GSTR-1 fields" },
  { id: 7, label: "Pipeline", icon: Cpu, hint: "Normalize, merge and compute net sales" },
  { id: 8, label: "Error Center", icon: AlertTriangle, hint: "Resolve validation issues" },
  { id: 9, label: "Generate", icon: FileJson, hint: "Review totals and approve" },
  { id: 10, label: "Download", icon: Download, hint: "Grab your GSTR-1 JSON and Excel" },
];

interface Props {
  profiles: GstinProfile[];
  platforms: PlatformInfo[];
}

export interface MultiConvertState {
  gstinNumber: string;
  returnPeriod: string;
  selectedPlatformIds: string[];
  uploadedFiles: MultiUploadFileInput[];
  rows: NormalizedInvoiceRow[];
  statement: NetSalesStatement | null;
  gstr1Json: string;
  /** Set by the step-9 credit gate; free-trial generations are watermarked. */
  watermark: boolean;
}

const EMPTY_STATE: MultiConvertState = {
  gstinNumber: "",
  returnPeriod: "",
  selectedPlatformIds: [],
  uploadedFiles: [],
  rows: [],
  statement: null,
  gstr1Json: "",
  watermark: false,
};

/**
 * Return periods are MMYYYY everywhere — step 2, formatPeriod and the GSTR-1
 * `fp` field all read the first two characters as the month. Seeding YYYYMM
 * here rendered as "undefined 2608" and would have carried a malformed period
 * into the filing for anyone who never opened step 2.
 */
function currentReturnPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${month}${now.getFullYear()}`;
}

export function ConvertWorkbench({ profiles, platforms }: Props) {
  const [step, setStep] = useState(1);
  // Slide direction, so stepping back animates backwards instead of always forward.
  const [direction, setDirection] = useState(1);
  const stepRef = useRef(1);
  const [state, setState] = useState<MultiConvertState>(() => {
    const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
    const defaultMonth = currentReturnPeriod();
    return {
      ...EMPTY_STATE,
      gstinNumber: defaultProfile?.gstinNumber ?? "",
      returnPeriod: defaultMonth,
      selectedPlatformIds: [platforms[0]?.id ?? "amazon"],
    };
  });

  const pillRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // The rail is ~1200px wide, so on a laptop the active pill would otherwise sit
  // off-screen from step 5 onwards.
  useEffect(() => {
    pillRefs.current[step]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [step]);

  const goTo = useCallback((next: number) => {
    setDirection(next >= stepRef.current ? 1 : -1);
    stepRef.current = next;
    setStep(next);
  }, []);

  const updateState = useCallback((updates: Partial<MultiConvertState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  function reset() {
    const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
    const defaultMonth = currentReturnPeriod();
    setState({
      ...EMPTY_STATE,
      gstinNumber: defaultProfile?.gstinNumber ?? "",
      returnPeriod: defaultMonth,
      selectedPlatformIds: [platforms[0]?.id ?? "amazon"],
    });
    goTo(1);
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary-ink">
          <Building2 className="size-6" />
        </div>
        <p className="text-sm font-bold">No GSTIN profiles found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Please add a GSTIN profile first before starting a multi-marketplace conversion.
        </p>
        <a
          href="/profile"
          className="mt-5 inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2 text-xs font-bold text-primary-foreground shadow-accent transition hover:brightness-110"
        >
          Go to GST Profile
        </a>
      </div>
    );
  }

  const active = STEPS[step - 1] ?? STEPS[0]!;
  const percent = Math.round(((step - 1) / (STEPS.length - 1)) * 100);

  return (
    <div className="space-y-5">
      {/* Workbench header — progress meter plus a live summary of this run. */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid-lines [mask-image:linear-gradient(to_right,black,transparent_70%)] opacity-40"
        />

        <div className="relative flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl brand-gradient text-primary-foreground shadow-accent">
              <active.icon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wider text-primary-ink uppercase">
                Step {step} of {STEPS.length} · {percent}% complete
              </p>
              <h2 className="truncate text-lg font-bold">{active.label}</h2>
              <p className="truncate text-xs text-muted-foreground">{active.hint}</p>
            </div>
          </div>

          <dl className="flex flex-wrap items-center gap-2 text-[11px]">
            <SummaryChip label="GSTIN" value={state.gstinNumber || "—"} mono />
            <SummaryChip
              label="Period"
              value={state.returnPeriod ? formatPeriod(state.returnPeriod) : "Not selected"}
            />
            <SummaryChip
              label="Platforms"
              value={String(state.selectedPlatformIds.length)}
              highlight
            />
            <SummaryChip label="Files" value={String(state.uploadedFiles.length)} highlight />
          </dl>
        </div>

        {/* The progress bar doubles as the card's bottom border. */}
        <div className="relative h-1 w-full bg-muted">
          <motion.div
            className="h-full brand-gradient"
            initial={false}
            animate={{ width: `${Math.max(percent, 4)}%` }}
            transition={{ type: "spring", stiffness: 160, damping: 24 }}
          />
        </div>
      </div>

      {/* Step rail */}
      <div className="-mx-1 scrollbar-none flex items-center gap-1 overflow-x-auto px-1 pb-1">
        {STEPS.map((s, idx) => {
          const isDone = step > s.id;
          const isActive = step === s.id;
          const isLocked = s.id > step;

          return (
            <div key={s.id} className="flex flex-shrink-0 items-center">
              <button
                type="button"
                ref={(el) => {
                  pillRefs.current[s.id] = el;
                }}
                onClick={() => {
                  if (s.id < step) goTo(s.id);
                }}
                disabled={isLocked}
                aria-current={isActive ? "step" : undefined}
                title={isLocked ? `${s.label} — complete the earlier steps first` : s.hint}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all",
                  isDone && "cursor-pointer text-success hover:bg-success/10",
                  isActive && "brand-gradient text-primary-foreground shadow-sm",
                  isLocked && "cursor-not-allowed text-muted-foreground/50"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                    isDone && "bg-success/20 text-success",
                    isActive && "animate-pulse-ring bg-primary-foreground text-primary-ink",
                    isLocked && "bg-muted text-muted-foreground/60"
                  )}
                >
                  {isDone ? (
                    <Check className="size-3" />
                  ) : isLocked ? (
                    <Lock className="size-2.5" />
                  ) : (
                    s.id
                  )}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
              </button>

              {idx < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-0.5 h-0.5 w-4 flex-shrink-0 rounded-full transition-colors duration-300",
                    step > s.id ? "bg-success" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step body */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && (
              <Step1Gstin
                state={state}
                profiles={profiles}
                onChange={updateState}
                onNext={() => goTo(2)}
              />
            )}
            {step === 2 && (
              <Step2Period
                state={state}
                onChange={updateState}
                onNext={() => goTo(3)}
                onBack={() => goTo(1)}
              />
            )}
            {step === 3 && (
              <Step3Platforms
                state={state}
                onChange={updateState}
                onNext={() => goTo(4)}
                onBack={() => goTo(2)}
              />
            )}
            {step === 4 && (
              <Step4RulesCheck state={state} onNext={() => goTo(5)} onBack={() => goTo(3)} />
            )}
            {step === 5 && (
              <Step5Upload
                state={state}
                onChange={updateState}
                onNext={() => goTo(6)}
                onBack={() => goTo(4)}
              />
            )}
            {step === 6 && (
              <Step6Mapping
                state={state}
                onChange={updateState}
                onNext={() => goTo(7)}
                onBack={() => goTo(5)}
              />
            )}
            {step === 7 && (
              <Step7Processing
                state={state}
                onChange={updateState}
                onNext={() => goTo(8)}
                onBack={() => goTo(6)}
              />
            )}
            {step === 8 && (
              <Step8ErrorCenter
                state={state}
                onChange={updateState}
                onNext={() => goTo(9)}
                onBack={() => goTo(6)}
              />
            )}
            {step === 9 && (
              <Step9Generate
                state={state}
                onNext={(watermark) => {
                  updateState({ watermark });
                  goTo(10);
                }}
                onBack={() => goTo(8)}
              />
            )}
            {step === 10 && <Step10Download state={state} onReset={reset} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
        highlight ? "border-primary/25 bg-primary/10" : "border-border bg-muted/50"
      )}
    >
      <dt className="font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd
        className={cn(
          "max-w-[15ch] truncate font-bold",
          mono && "font-mono",
          highlight && "text-primary-ink"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
