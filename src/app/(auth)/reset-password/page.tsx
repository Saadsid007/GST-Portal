"use client";

import { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { verifyAndResetPasswordAction } from "@/features/auth/actions/auth-verification.actions";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || otp.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit verification code");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const res = await verifyAndResetPasswordAction({
        email,
        otp,
        newPassword: password,
      });

      if (res.success) {
        setIsSuccess(true);
        toast.success("Password reset successfully!");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        toast.error(res.error || "Password reset failed. Please check the code.");
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
              <h1 className="text-xl font-bold">Password Reset!</h1>
              <p className="text-xs text-muted-foreground">
                Your password has been securely updated. Redirecting to sign in...
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-xs font-bold text-white shadow hover:brightness-110"
                >
                  Sign In Now <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Lock className="size-6" />
                </div>
                <h1 className="text-xl font-bold pt-2">Set New Password</h1>
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to your email and your new password.
                </p>
              </div>

              <form onSubmit={handleReset} className="space-y-4">
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

                <div className="space-y-1.5">
                  <label
                    htmlFor="otp"
                    className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                  >
                    6-Digit Verification Code
                  </label>
                  <div className="relative">
                    <input
                      id="otp"
                      type="text"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm tracking-widest transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                    />
                    <KeyRound className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="new-password"
                    className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-10 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirm-password"
                    className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || otp.length !== 6 || password.length < 8}
                  className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Updating Password...
                    </>
                  ) : (
                    <>
                      Reset Password <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
