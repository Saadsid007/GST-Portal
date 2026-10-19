"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle2, RefreshCw } from "lucide-react";
import {
  requestPasswordResetAction,
  verifyAndResetPasswordAction,
} from "@/features/auth/actions/auth-verification.actions";
import { PASSWORD_MIN_LENGTH } from "@/config/constants";
import {
  AuthField,
  AuthShell,
  authButtonClass,
  authInputClass,
} from "@/features/auth/presentation/auth-shell";

const RESEND_SECONDS = 60;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(searchParams.get("email") ? RESEND_SECONDS : 0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || otp.length !== 6) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("The two passwords do not match");
      return;
    }

    startTransition(async () => {
      const res = await verifyAndResetPasswordAction({
        email: email.trim(),
        otp,
        newPassword: password,
      });
      if (res.success) {
        setIsSuccess(true);
        toast.success("Password updated");
        setTimeout(() => router.push(`/login?email=${encodeURIComponent(email.trim())}`), 1500);
      } else {
        toast.error(res.error || "That code did not work. Check it and try again.");
      }
    });
  };

  const resend = () => {
    if (cooldown > 0 || !email.trim()) return;
    startTransition(async () => {
      const res = await requestPasswordResetAction({ email: email.trim() });
      if (res.success) {
        toast.success("A new code is on its way");
        setCooldown(RESEND_SECONDS);
      } else {
        toast.error(res.error ?? "Could not send a new code");
      }
    });
  };

  if (isSuccess) {
    return (
      <div className="space-y-4 py-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success-ink">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="text-xl font-bold">Password updated</h1>
        <p className="text-sm text-muted-foreground">Taking you to sign in…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code we emailed you and choose a new password.
        </p>
      </div>

      <form onSubmit={handleReset} className="space-y-4">
        <AuthField id="email" label="Email address">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            className={authInputClass}
          />
        </AuthField>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="otp" className="text-xs font-semibold text-foreground">
              Reset code
            </label>
            <button
              type="button"
              onClick={resend}
              disabled={isPending || cooldown > 0 || !email.trim()}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              <RefreshCw className="size-3" />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className={`${authInputClass} text-center font-mono text-lg tracking-[0.4em]`}
          />
        </div>

        <AuthField id="password" label="New password">
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
              className={`${authInputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </AuthField>

        <AuthField id="confirmPassword" label="Confirm new password">
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
            className={authInputClass}
          />
        </AuthField>

        <button type="submit" disabled={isPending} className={authButtonClass}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isPending ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-primary-ink hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
