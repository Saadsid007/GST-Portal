"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquarePlus,
  X,
  Bug,
  FileSpreadsheet,
  Sparkles,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Globe,
  ArrowRight,
} from "lucide-react";
import { submitFeedbackAction } from "@/features/support/actions/support.actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Props {
  user?: { name: string; email: string };
}

type FeedbackCategory = "BUG" | "CONVERSION" | "FEATURE" | "FEEDBACK";
type FeedbackPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

const CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  sub: string;
  icon: typeof Bug;
  color: string;
  activeRing: string;
  bgGradient: string;
}[] = [
  {
    id: "BUG",
    label: "Something is Broken",
    sub: "Crash, UI glitch, or failing action",
    icon: Bug,
    color: "text-rose-600 dark:text-rose-400",
    activeRing: "border-rose-500/50 ring-2 ring-rose-500/30",
    bgGradient: "from-rose-500/[0.12] via-pink-500/[0.04] to-card",
  },
  {
    id: "CONVERSION",
    label: "Marketplace File Issue",
    sub: "Amazon, Flipkart, or Meesho errors",
    icon: FileSpreadsheet,
    color: "text-amber-600 dark:text-amber-400",
    activeRing: "border-amber-500/50 ring-2 ring-amber-500/30",
    bgGradient: "from-amber-500/[0.12] via-orange-500/[0.04] to-card",
  },
  {
    id: "FEATURE",
    label: "Feature Request / Change",
    sub: "Suggest a tool, parser, or enhancement",
    icon: Sparkles,
    color: "text-purple-600 dark:text-purple-400",
    activeRing: "border-purple-500/50 ring-2 ring-purple-500/30",
    bgGradient: "from-purple-500/[0.12] via-violet-500/[0.04] to-card",
  },
  {
    id: "FEEDBACK",
    label: "General Feedback",
    sub: "Share your experience or compliment",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    activeRing: "border-blue-500/50 ring-2 ring-blue-500/30",
    bgGradient: "from-blue-500/[0.12] via-indigo-500/[0.04] to-card",
  },
];

export function FeedbackWidget({ user }: Props) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("BUG");
  const [priority, setPriority] = useState<FeedbackPriority>("NORMAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function resetForm() {
    setCategory("BUG");
    setPriority("NORMAL");
    setSubject("");
    setMessage("");
    setReferenceId("");
    setSubmittedReference(null);
  }

  function handleClose() {
    setIsOpen(false);
    setTimeout(resetForm, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 8) {
      toast.error("Please provide a short summary and detailed description");
      return;
    }

    setSubmitting(true);
    const res = await submitFeedbackAction({
      category,
      priority,
      subject: subject.trim(),
      message: message.trim(),
      pageUrl: pathname,
      referenceId: referenceId.trim() || undefined,
    });
    setSubmitting(false);

    if (res.success && res.data) {
      toast.success("Feedback submitted! Our engineering team has been notified.");
      setSubmittedReference(res.data.reference);
    } else {
      toast.error(res.error ?? "Failed to submit feedback");
    }
  }

  function copyRef(val: string) {
    navigator.clipboard.writeText(val);
    setCopiedRef(true);
    toast.success("Reference copied");
    setTimeout(() => setCopiedRef(false), 2000);
  }

  return (
    <>
      {/* ── Sticky Floating Trigger Button ── */}
      <div className="fixed right-6 bottom-6 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 py-2.5 pr-4 pl-3.5 text-xs font-bold text-white shadow-xl ring-2 shadow-blue-500/30 ring-white/25 transition-all hover:scale-105 hover:shadow-blue-500/50 hover:brightness-110 active:scale-95 dark:ring-white/15"
          aria-label="Open customer feedback dialog"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white shadow-xs" />
          </span>
          <MessageSquarePlus className="size-4 transition-transform group-hover:rotate-12" />
          <span className="tracking-wide">Feedback &amp; Issues</span>
        </button>
      </div>

      {/* ── Modal Backdrop & Dialog ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-md transition-opacity"
            onClick={handleClose}
          />

          {/* Modal Container */}
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-blue-500/30 bg-card p-6 shadow-2xl ring-1 ring-border sm:p-7 dark:border-blue-500/35 dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-5 right-5 rounded-xl border border-border bg-muted/40 p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            {submittedReference ? (
              /* Success View */
              <div className="space-y-4 py-6 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400">
                  <CheckCircle2 className="size-8" />
                </div>
                <h3 className="text-xl font-black text-foreground">Thank You for Your Feedback!</h3>
                <p className="mx-auto max-w-md text-xs leading-relaxed text-muted-foreground">
                  Our engineering and support team reviews every issue report, marketplace error,
                  and feature request. We have created a tracked record for you:
                </p>

                <div className="mx-auto inline-flex items-center gap-2.5 rounded-2xl border border-blue-500/30 bg-blue-500/[0.08] px-4 py-2.5 font-mono text-sm font-bold text-foreground">
                  <span>Reference:</span>
                  <span className="text-primary-ink">{submittedReference}</span>
                  <button
                    type="button"
                    onClick={() => copyRef(submittedReference)}
                    className="rounded p-1 transition hover:bg-blue-500/20"
                    title="Copy reference"
                  >
                    {copiedRef ? (
                      <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap justify-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-xl border border-border px-5 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted"
                  >
                    Close
                  </button>
                  <Link
                    href={`/support`}
                    onClick={handleClose}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:brightness-110"
                  >
                    <span>View in Support Center</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              /* Form View */
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400">
                      <MessageSquarePlus className="size-4" />
                    </span>
                    <h3 className="text-lg font-bold text-foreground">
                      Client Feedback &amp; Issue Report
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Something failing, a file conversion anomaly, or have an idea to improve
                    GSTPilot? Let us know directly.
                  </p>
                </div>

                {/* Current Page Context Badge */}
                <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] px-3 py-1.5 text-xs">
                  <Globe className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="text-muted-foreground">Detected Page:</span>
                  <span className="truncate font-mono font-bold text-foreground">{pathname}</span>
                </div>

                {/* 1. Category Selection Cards */}
                <div className="space-y-2">
                  <label className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
                    What is this regarding?
                  </label>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border p-3 text-left transition-all",
                            isSelected
                              ? cn("bg-gradient-to-br shadow-sm", cat.bgGradient, cat.activeRing)
                              : "border-border bg-card/60 hover:border-border/80 hover:bg-muted/30"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-xl bg-card shadow-2xs ring-1 ring-border/80",
                              cat.color
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground">{cat.label}</p>
                            <p className="text-[11px] leading-tight text-muted-foreground">
                              {cat.sub}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Urgency / Severity Level */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
                      Urgency Level
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      {priority === "URGENT" || priority === "HIGH"
                        ? "Priority escalation queue"
                        : "Standard review queue"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        { id: "LOW", label: "Low", desc: "Trivial / Idea" },
                        { id: "NORMAL", label: "Normal", desc: "Standard" },
                        { id: "HIGH", label: "High", desc: "Important" },
                        { id: "URGENT", label: "Urgent", desc: "Filing Blocked" },
                      ] as const
                    ).map((p) => {
                      const isSel = priority === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPriority(p.id)}
                          className={cn(
                            "rounded-xl border px-1 py-2 text-center transition-all",
                            isSel
                              ? p.id === "URGENT" || p.id === "HIGH"
                                ? "border-rose-500/50 bg-rose-500/15 font-bold text-rose-700 ring-1 ring-rose-500/30 dark:text-rose-300"
                                : "border-primary/50 bg-primary/10 font-bold text-primary-ink ring-1 ring-primary/30"
                              : "border-border bg-card text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <p className="text-xs">{p.label}</p>
                          <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                            {p.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Subject Summary */}
                <div className="space-y-1.5">
                  <label htmlFor="fb-subject" className="text-xs font-bold text-foreground">
                    Brief Summary <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="fb-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={
                      category === "BUG"
                        ? "e.g. Button freezes or shows Error RET11401 on upload"
                        : category === "CONVERSION"
                          ? "e.g. Amazon B2B column mapping missing state POS"
                          : category === "FEATURE"
                            ? "e.g. Add support for Nykaa or JioMart sales reports"
                            : "e.g. Navigation is very fast, suggestion on ledger view"
                    }
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>

                {/* 4. Detailed Message */}
                <div className="space-y-1.5">
                  <label htmlFor="fb-message" className="text-xs font-bold text-foreground">
                    Details &amp; Steps to Reproduce <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="fb-message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe what happened, what you expected, or any specific error codes you saw…"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs leading-relaxed font-medium transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>

                {/* 5. Optional Reference / Error Code */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="fb-ref"
                    className="flex items-center justify-between text-xs font-semibold text-muted-foreground"
                  >
                    <span>Optional: Error code, Order ID, or File Name</span>
                    <span className="text-[10px]">Optional</span>
                  </label>
                  <input
                    id="fb-ref"
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="e.g. Error 500, Amazon_MTR_Oct_2026.xlsx, pay_12345"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-1.5 font-mono text-xs transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between border-t border-border/80 pt-4">
                  <p className="text-[11px] text-muted-foreground">
                    Signed in as{" "}
                    <span className="font-semibold text-foreground">{user?.email}</span>
                  </p>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-xl border border-border px-4 py-2 text-xs font-bold transition hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:brightness-110 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      <span>Submit Feedback</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
