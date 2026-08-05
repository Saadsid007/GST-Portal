"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Loader2, Share2, Users } from "lucide-react";
import {
  applyReferralAction,
  generateShareTokenAction,
} from "@/features/billing/actions/referral.actions";
import type { ReferralSummary } from "@/features/billing/types/billing.types";

export function ReferralPanel({ summary }: { summary: ReferralSummary }) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  }

  function handleShareToken() {
    startTransition(async () => {
      const result = await generateShareTokenAction();
      if (result.success) {
        toast.success("Share link created. It expires in 24 hours.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleApply() {
    startTransition(async () => {
      const result = await applyReferralAction(code);
      if (result.success) {
        toast.success("Code applied. Your reward unlocks on your first recharge.");
        setCode("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Users className="size-4 text-primary-ink" /> Refer & Earn
        </h2>
        <span className="text-xs text-muted-foreground">
          {summary.totalRewarded}/{summary.totalReferred} rewarded · {summary.creditsEarned} credits
          earned
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Your permanent code
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 font-mono text-sm font-bold tracking-wider">
            {summary.code}
          </code>
          <button
            type="button"
            onClick={() => void copy(summary.code)}
            className="rounded-xl border border-border p-2.5 transition hover:bg-muted"
            aria-label="Copy referral code"
          >
            {copied === summary.code ? (
              <Check className="size-4 text-success" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Your friend earns credits and so do you — paid out after their first successful recharge.
        </p>
      </div>

      <div className="space-y-1.5 border-t border-border pt-1">
        <p className="pt-4 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          24-hour share link
        </p>
        {summary.shareToken ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 font-mono text-sm tracking-wide">
              {summary.shareToken}
            </code>
            <button
              type="button"
              onClick={() => void copy(summary.shareToken as string)}
              className="rounded-xl border border-border p-2.5 transition hover:bg-muted"
              aria-label="Copy share token"
            >
              {copied === summary.shareToken ? (
                <Check className="size-4 text-success" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleShareToken}
            disabled={pending || !summary.canGenerateToken}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Share2 className="size-3.5" />
            )}
            Generate share link
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">
          One single-use link every 24 hours, for new users only.
        </p>
      </div>

      {summary.appliedCode ? (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Referred by
          </p>
          <p className="pt-1 text-sm font-semibold">
            {summary.appliedCode}{" "}
            <span
              className={`text-xs font-bold ${
                summary.appliedStatus === "REWARDED" ? "text-success" : "text-warning"
              }`}
            >
              · {summary.appliedStatus}
            </span>
          </p>
          {summary.appliedStatus === "PENDING" && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              Your reward is released on your first successful recharge.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5 border-t border-border pt-4">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Have a friend&apos;s code?
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="GSTP-XXXXXX"
              className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm tracking-wide transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleApply}
              disabled={pending || code.trim().length < 4}
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A code can only be applied before your first recharge.
          </p>
        </div>
      )}
    </div>
  );
}
