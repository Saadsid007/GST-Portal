"use client";

import { useState, useEffect, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MailCheck, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import {
  verifyEmailOtpAction,
  requestEmailVerificationAction,
} from "@/features/auth/actions/auth-verification.actions";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || otp.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit verification code");
      return;
    }

    startTransition(async () => {
      const res = await verifyEmailOtpAction({ email, otp });
      if (res.success) {
        setIsSuccess(true);
        toast.success("Email verified successfully!");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 2000);
      } else {
        toast.error(res.error || "Verification failed. Please check the code.");
      }
    });
  };

  const handleResend = () => {
    if (resendCooldown > 0 || !email.trim()) return;

    startTransition(async () => {
      const res = await requestEmailVerificationAction({ email });
      if (res.success) {
        toast.success("A fresh 6-digit verification code has been sent to your email.");
        setResendCooldown(60);
      } else {
        toast.error(res.error || "Failed to resend code.");
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
          {isSuccess ? (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="size-8" />
              </div>
              <h1 className="text-xl font-bold">Email Verified!</h1>
              <p className="text-xs text-muted-foreground">
                Your GSTPilot account is fully verified and active. Redirecting to your dashboard...
              </p>
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-xs font-bold text-white shadow hover:brightness-110"
                >
                  Go to Dashboard <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MailCheck className="size-6" />
                </div>
                <h1 className="text-xl font-bold pt-2">Verify Your Email</h1>
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit verification code sent to{" "}
                  <span className="font-semibold text-foreground">{email || "your email"}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                {!emailParam && (
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="otp"
                    className="text-xs font-bold tracking-wide text-muted-foreground uppercase text-center block"
                  >
                    6-Digit Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full rounded-2xl border-2 border-border bg-background py-3.5 text-center font-mono text-2xl font-bold tracking-[0.4em] transition focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || otp.length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Activate Account <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <span>Didn&apos;t receive the code?</span>
                <button
                  type="button"
                  disabled={isPending || resendCooldown > 0}
                  onClick={handleResend}
                  className="flex items-center gap-1.5 font-bold text-primary hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`size-3 ${isPending ? "animate-spin" : ""}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="hover:text-foreground hover:underline">
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
