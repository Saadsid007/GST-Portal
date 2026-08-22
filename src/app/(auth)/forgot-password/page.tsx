"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, KeyRound, ArrowRight, ArrowLeft } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { requestPasswordResetAction } from "@/features/auth/actions/auth-verification.actions";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    startTransition(async () => {
      const res = await requestPasswordResetAction({ email });
      if (res.success) {
        toast.success("If an account exists, a 6-digit reset code has been sent.");
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      } else {
        toast.error(res.error || "Failed to process request");
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Logo Header */}
        <div className="space-y-2 text-center">
          <Link
            href="/"
            className="group inline-flex items-center justify-center transition-transform hover:scale-105"
          >
            <AppLogo size="xl" priority />
          </Link>
          <p className="text-xs text-muted-foreground">Marketplace to GSTR-1 Excel & JSON Engine</p>
        </div>

        {/* Card */}
        <div className="space-y-6 rounded-3xl border border-border/80 bg-card p-8 shadow-2xl shadow-primary/5">
          <div className="space-y-1.5 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <KeyRound className="size-6" />
            </div>
            <h1 className="text-xl font-bold pt-2">Reset Password</h1>
            <p className="text-xs text-muted-foreground">
              Enter your account email to receive a secure 6-digit reset code.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending Code...
                </>
              ) : (
                <>
                  Send Reset Code <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="size-3" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
