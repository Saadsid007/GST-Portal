"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { requestPasswordResetAction } from "@/features/auth/actions/auth-verification.actions";
import {
  AuthField,
  AuthShell,
  authButtonClass,
  authInputClass,
} from "@/features/auth/presentation/auth-shell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    startTransition(async () => {
      const res = await requestPasswordResetAction({ email: email.trim() });
      if (res.success) {
        toast.success("If that email has an account, a reset code is on its way.");
        router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
      } else {
        toast.error(res.error || "Could not send a reset code");
      }
    });
  };

  return (
    <AuthShell>
      <div className="space-y-6">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 text-2xs font-extrabold text-blue-700 dark:text-blue-300">
            <span>Account Recovery</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Reset your password
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Enter your email and we will dispatch a secure 6-digit verification code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField id="email" label="Email address">
            <input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className={authInputClass}
            />
          </AuthField>
          <button type="submit" disabled={isPending || !email.trim()} className={authButtonClass}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? "Sending code…" : "Send reset code"}
          </button>
        </form>

        <p className="border-t border-border pt-4 text-center text-sm">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
