"use client";

import { useState, useCallback } from "react";
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
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronRight } from "lucide-react";

const STEPS = [
  { id: 1, label: "GST Profile" },
  { id: 2, label: "Return Period" },
  { id: 3, label: "Marketplaces" },
  { id: 4, label: "Rules Check" },
  { id: 5, label: "Upload Reports" },
  { id: 6, label: "Mapping" },
  { id: 7, label: "Pipeline" },
  { id: 8, label: "Error Center" },
  { id: 9, label: "Generate" },
  { id: 10, label: "Download" },
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

export function ConvertWorkbench({ profiles, platforms }: Props) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<MultiConvertState>(() => {
    const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
    const defaultMonth = new Date().toISOString().slice(0, 7).replace("-", ""); // YYYYMM format
    return {
      ...EMPTY_STATE,
      gstinNumber: defaultProfile?.gstinNumber ?? "",
      returnPeriod: defaultMonth,
      selectedPlatformIds: [platforms[0]?.id ?? "amazon"],
    };
  });

  const updateState = useCallback((updates: Partial<MultiConvertState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  function reset() {
    const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
    const defaultMonth = new Date().toISOString().slice(0, 7).replace("-", "");
    setState({
      ...EMPTY_STATE,
      gstinNumber: defaultProfile?.gstinNumber ?? "",
      returnPeriod: defaultMonth,
      selectedPlatformIds: [platforms[0]?.id ?? "amazon"],
    });
    setStep(1);
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="text-sm font-bold">No GSTIN profiles found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Please add a GSTIN profile first before starting a multi-marketplace conversion.
        </p>
        <a
          href="/profile"
          className="mt-4 inline-block text-xs font-bold text-primary hover:underline"
        >
          → Go to GST Profile
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 10-Step Progress Stepper */}
      <div className="flex scrollbar-none items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, idx) => {
          const isDone = step > s.id;
          const isActive = step === s.id;
          return (
            <div key={s.id} className="flex flex-shrink-0 items-center">
              <button
                type="button"
                onClick={() => {
                  if (s.id < step) setStep(s.id);
                }}
                disabled={s.id > step}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all",
                  isDone
                    ? "cursor-pointer text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                    : isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "cursor-not-allowed text-muted-foreground/60"
                )}
              >
                <div
                  className={cn(
                    "flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                    isDone
                      ? "bg-emerald-500/20 text-emerald-600"
                      : isActive
                        ? "bg-primary-foreground text-primary shadow-sm"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <CheckCircle2 className="size-3" /> : s.id}
                </div>
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight
                  className={cn(
                    "mx-0.5 size-3 flex-shrink-0",
                    step > s.id ? "text-emerald-500" : "text-muted-foreground/30"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 10-Step Component Container */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {step === 1 && (
          <Step1Gstin
            state={state}
            profiles={profiles}
            onChange={updateState}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Period
            state={state}
            onChange={updateState}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Platforms
            state={state}
            onChange={updateState}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4RulesCheck state={state} onNext={() => setStep(5)} onBack={() => setStep(3)} />
        )}
        {step === 5 && (
          <Step5Upload
            state={state}
            onChange={updateState}
            onNext={() => setStep(6)}
            onBack={() => setStep(4)}
          />
        )}
        {step === 6 && (
          <Step6Mapping
            state={state}
            onChange={updateState}
            onNext={() => setStep(7)}
            onBack={() => setStep(5)}
          />
        )}
        {step === 7 && (
          <Step7Processing
            state={state}
            onChange={updateState}
            onNext={() => setStep(8)}
            onBack={() => setStep(6)}
          />
        )}
        {step === 8 && (
          <Step8ErrorCenter
            state={state}
            onChange={updateState}
            onNext={() => setStep(9)}
            onBack={() => setStep(6)}
          />
        )}
        {step === 9 && (
          <Step9Generate
            state={state}
            onNext={(watermark) => {
              updateState({ watermark });
              setStep(10);
            }}
            onBack={() => setStep(8)}
          />
        )}
        {step === 10 && <Step10Download state={state} onReset={reset} />}
      </div>
    </div>
  );
}
