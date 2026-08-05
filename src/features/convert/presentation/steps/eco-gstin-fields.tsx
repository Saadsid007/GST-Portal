"use client";

import { useEffect, useState } from "react";
import { Check, Info, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

import {
  loadEcoOperatorsAction,
  saveEcoOperatorAction,
} from "@/features/convert/actions/eco-operator.actions";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import { cn } from "@/lib/utils";

interface Props {
  gstinNumber: string;
  selectedPlatformIds: string[];
}

/**
 * Optional operator-GSTIN entry for each selected marketplace.
 *
 * Most exports omit it, so this is the only way Table 14 can be filled for those platforms. The
 * values are stored against the seller's GSTIN rather than held in wizard state — an operator
 * GSTIN is stable across months, and re-typing it every conversion is the reason it stays blank.
 */
export function EcoGstinFields({ gstinNumber, selectedPlatformIds }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!gstinNumber) return;

    loadEcoOperatorsAction(gstinNumber)
      .then((res) => {
        if (!mounted) return;
        setValues(res.data);
        setSavedValues(res.data);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [gstinNumber]);

  const loading = Boolean(gstinNumber) && !loaded;

  async function persist(platformId: string) {
    const next = values[platformId] ?? "";
    if (next === (savedValues[platformId] ?? "")) return;

    setSavingId(platformId);
    const res = await saveEcoOperatorAction({ gstinNumber, platformId, ecoGstin: next });
    setSavingId(null);

    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setValues((prev) => ({ ...prev, [platformId]: res.data.ecoGstin }));
    setSavedValues((prev) => ({ ...prev, [platformId]: res.data.ecoGstin }));
  }

  const platforms = PLATFORMS_CONFIG.filter((p) => selectedPlatformIds.includes(p.id));
  if (platforms.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex items-start gap-2.5">
        <Receipt className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-bold">E-Commerce Operator (ECO) GSTIN</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Required only if you want to generate GSTR-1 Table 14. If your report already contains
            the operator GSTIN, GSTPilot detects it during processing and saves it automatically —
            leave these blank and check back after the first run. Otherwise enter it once and it
            will be reused for every future return. B2B and B2CS reporting works either way.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {platforms.map((plat) => {
          const isSaved = Boolean(savedValues[plat.id]) && values[plat.id] === savedValues[plat.id];

          return (
            <label key={plat.id} className="space-y-1">
              <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {plat.name}
                <span
                  title={`This is NOT your own GSTIN. Enter the GSTIN under which ${plat.name} is registered as the e-commerce operator in your state.`}
                  className="cursor-help"
                >
                  <Info className="size-3" />
                </span>
              </span>
              <div className="relative">
                <input
                  value={values[plat.id] ?? ""}
                  disabled={loading || !gstinNumber}
                  placeholder={loading ? "Loading…" : "e.g. 27AAICA3918J1CX"}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [plat.id]: e.target.value.toUpperCase() }))
                  }
                  onBlur={() => persist(plat.id)}
                  className={cn(
                    "w-full rounded-xl border border-border bg-background px-3 py-2 pr-8 font-mono text-xs uppercase focus:ring-2 focus:ring-primary/50 focus:outline-none disabled:opacity-50",
                    isSaved && "border-success/50"
                  )}
                />
                {savingId === plat.id ? (
                  <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : isSaved ? (
                  <Check className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-success" />
                ) : null}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
