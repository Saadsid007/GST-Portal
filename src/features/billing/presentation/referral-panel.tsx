"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Loader2,
  Share2,
  Users,
  Sparkles,
  Send,
  MessageCircle,
  Mail,
} from "lucide-react";
import {
  applyReferralAction,
  generateShareTokenAction,
} from "@/features/billing/actions/referral.actions";
import type { ReferralSummary } from "@/features/billing/types/billing.types";
import { cn } from "@/lib/utils";

export function ReferralPanel({
  summary,
  refereeCredits,
}: {
  summary: ReferralSummary;
  /** What the invited person receives, from the billing config. */
  refereeCredits: number;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  async function copy(value: string, label = "Copied to clipboard") {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    toast.success(label);
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

  const shareText = `Hey, use my GSTPilot referral code ${summary.code} to get ₹${refereeCredits} discount credits on your first GST filing & multi-marketplace reconciliation plan!`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent("https://gstpilot.com")}&text=${encodeURIComponent(shareText)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(`₹${refereeCredits} GSTPilot Wallet Credits Invitation`)}&body=${encodeURIComponent(shareText)}`;

  return (
    <div className="space-y-6 rounded-3xl border border-blue-500/30 bg-gradient-to-br from-card via-card to-blue-500/[0.04] p-6 shadow-xs dark:from-card dark:via-card dark:to-blue-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400">
            <Users className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Your Referral Code</h3>
            <p className="text-2xs text-muted-foreground">Permanent VIP discount invite</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <Sparkles className="size-3" />
          {summary.totalRewarded} Rewarded · ₹{summary.creditsEarned} Earned
        </span>
      </div>

      {/* ── Permanent Code Box ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
            Exclusive Referral Code
          </p>
          <span className="text-[11px] font-semibold text-primary">Never expires</span>
        </div>

        <div className="relative flex items-center justify-between rounded-2xl border-2 border-dashed border-blue-500/40 bg-blue-500/[0.06] p-4 transition-all hover:border-blue-500/60 dark:bg-blue-950/30">
          <div className="min-w-0">
            <p className="text-2xs font-bold tracking-widest text-blue-600 uppercase dark:text-blue-400">
              VOUCHER CODE
            </p>
            <p className="font-mono text-2xl font-black tracking-wider text-foreground">
              {summary.code}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copy(summary.code, "Referral code copied!")}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:brightness-110"
            aria-label="Copy referral code"
          >
            {copied === summary.code ? (
              <>
                <Check className="size-4 text-white" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* 1-Click Social Sharing buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="mr-1 text-2xs font-bold text-muted-foreground uppercase">
            Share via:
          </span>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
          >
            <MessageCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>WhatsApp</span>
          </a>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300"
          >
            <Send className="size-3.5 text-sky-600 dark:text-sky-400" />
            <span>Telegram</span>
          </a>
          <a
            href={mailUrl}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-muted"
          >
            <Mail className="size-3.5 text-muted-foreground" />
            <span>Email</span>
          </a>
        </div>
      </div>

      {/* ── 24-Hour Share Link Section ── */}
      <div className="space-y-2.5 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
            Quick 24-Hour Sign-Up Link
          </p>
          <span className="text-[11px] text-muted-foreground">Auto-applies code upon visit</span>
        </div>

        {summary.shareToken ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 font-mono text-xs font-semibold text-foreground">
              {summary.shareToken}
            </code>
            <button
              type="button"
              onClick={() => void copy(summary.shareToken as string, "Share link copied!")}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold transition hover:bg-muted"
              aria-label="Copy share token"
            >
              {copied === summary.shareToken ? (
                <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="size-4 text-muted-foreground" />
              )}
              <span>{copied === summary.shareToken ? "Copied" : "Copy"}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleShareToken}
            disabled={pending || !summary.canGenerateToken}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-500/20 disabled:opacity-50 dark:text-blue-300"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Share2 className="size-3.5" />
            )}
            Generate 24-Hour Invite Link
          </button>
        )}
      </div>

      {/* ── Referred By / Have a friend's code ── */}
      {summary.appliedCode ? (
        <div className="rounded-2xl border border-border bg-muted/30 p-3.5">
          <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
            Referred By
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-foreground">
              {summary.appliedCode}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-2xs font-extrabold",
                summary.appliedStatus === "REWARDED"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              )}
            >
              {summary.appliedStatus === "REWARDED"
                ? "✓ Bonus Rewarded"
                : "⏳ Pending First Recharge"}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
            Have a Friend&apos;s Referral Code?
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="GSTP-XXXXXX"
              className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 font-mono text-sm tracking-wide uppercase transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleApply}
              disabled={pending || code.trim().length < 4}
              className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:brightness-110 disabled:opacity-50"
            >
              Apply Code
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Apply before making your first recharge to unlock ₹{refereeCredits} discount credits.
          </p>
        </div>
      )}
    </div>
  );
}
