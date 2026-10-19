"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  AuthField,
  AuthShell,
  authButtonClass,
  authInputClass,
} from "@/features/auth/presentation/auth-shell";
import { EmailCodeStep } from "@/features/auth/presentation/email-code-step";
import { requestEmailVerificationAction } from "@/features/auth/actions/auth-verification.actions";

/**
 * Reached from the link in the code email, and by anyone signed in from
 * before verification was enforced — the dashboard sends them here first.
 */
function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [confirmed, setConfirmed] = useState(Boolean(params.get("email")));
  const [sending, setSending] = useState(false);

  async function afterVerified() {
    const { data } = await authClient.getSession();
    if (data?.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      toast.success("Email verified. Sign in to continue.");
      router.push(`/login?email=${encodeURIComponent(email.trim())}`);
    }
  }

  if (!confirmed) {
    return (
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setSending(true);
          const res = await requestEmailVerificationAction({ email: email.trim() });
          setSending(false);
          if (res.success) setConfirmed(true);
          else toast.error(res.error ?? "Could not send a code");
        }}
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight">Verify your email</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the address you signed up with and we will send a 6-digit code.
          </p>
        </div>
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
        <button type="submit" disabled={sending} className={authButtonClass}>
          {sending ? "Sending…" : "Send code"}
        </button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary-ink hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <EmailCodeStep
      email={email.trim()}
      justSent={false}
      onVerified={afterVerified}
      onBack={() => setConfirmed(false)}
    />
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-72" aria-hidden />}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}
