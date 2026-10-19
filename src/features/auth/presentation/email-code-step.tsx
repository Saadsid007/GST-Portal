"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck, RefreshCw } from "lucide-react";
import {
  requestEmailVerificationAction,
  verifyEmailOtpAction,
} from "@/features/auth/actions/auth-verification.actions";
import { authButtonClass, authInputClass } from "@/features/auth/presentation/auth-shell";

interface EmailCodeStepProps {
  email: string;
  /** Called once the code is accepted; the caller signs the user in. */
  onVerified: () => Promise<void> | void;
  onBack: () => void;
  /** Set when the code was just sent by the step before this one. */
  justSent?: boolean;
}

const RESEND_SECONDS = 60;

/**
 * The emailed-code step, shown in place on the signup and login forms.
 *
 * In place rather than on /verify-email so the password the person just typed
 * is still in memory: once the code is accepted they are signed in, instead of
 * being sent to a separate page and asked to log in again.
 */
export function EmailCodeStep({ email, onVerified, onBack, justSent = true }: EmailCodeStepProps) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(justSent ? RESEND_SECONDS : 0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function verify(value: string) {
    if (value.length !== 6) return;
    startTransition(async () => {
      const res = await verifyEmailOtpAction({ email, otp: value });
      if (!res.success) {
        toast.error(res.error ?? "That code did not work. Check it and try again.");
        setCode("");
        inputRef.current?.focus();
        return;
      }
      toast.success("Email verified");
      await onVerified();
    });
  }

  function resend() {
    if (cooldown > 0) return;
    startTransition(async () => {
      const res = await requestEmailVerificationAction({ email });
      if (res.success) {
        toast.success("A new code is on its way");
        setCooldown(RESEND_SECONDS);
      } else {
        toast.error(res.error ?? "Could not send a new code");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MailCheck className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Check your email</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-semibold break-all text-foreground">{email}</span>. It expires in
            15 minutes.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify(code);
        }}
        className="space-y-4"
      >
        <label htmlFor="otp" className="sr-only">
          Verification code
        </label>
        <input
          ref={inputRef}
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(next);
            if (next.length === 6) verify(next);
          }}
          placeholder="••••••"
          className={`${authInputClass} py-3 text-center font-mono text-2xl tracking-[0.5em]`}
        />
        <button type="submit" disabled={isPending || code.length !== 6} className={authButtonClass}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Verify and continue
        </button>
      </form>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="inline-flex items-center gap-1 font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Change details
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={isPending || cooldown > 0}
          className="inline-flex items-center gap-1 font-semibold text-primary-ink transition hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          <RefreshCw className="size-3.5" />
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Not in your inbox? Check spam or promotions. Already registered with this email? Go back and
        sign in instead.
      </p>
    </div>
  );
}
