"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  AuthField,
  AuthShell,
  authButtonClass,
  authInputClass,
} from "@/features/auth/presentation/auth-shell";
import { EmailCodeStep } from "@/features/auth/presentation/email-code-step";

/** Where a signed-in user may be sent back to: this site's own paths only. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"password" | "code">("password");

  async function signIn(): Promise<boolean> {
    const res = await authClient.signIn.email({ email: email.trim(), password });
    if (!res.error) {
      toast.success("Welcome back");
      router.push(safeNext(params.get("next")));
      router.refresh();
      return true;
    }
    // The password was right but the address was never confirmed. Better
    // Auth has just emailed a fresh code; take it here rather than sending
    // the person away to another page.
    if (res.error.code === "EMAIL_NOT_VERIFIED") {
      setStep("code");
      return false;
    }
    toast.error(res.error.message ?? "Invalid email or password");
    return false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn();
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <EmailCodeStep
        email={email.trim()}
        onVerified={async () => {
          await signIn();
        }}
        onBack={() => setStep("password")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back. Your GST profiles and returns are waiting.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField id="email" label="Email address">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            className={authInputClass}
          />
        </AuthField>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-semibold text-foreground">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary-ink hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
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
        </div>

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
        New to GSTPilot?{" "}
        <Link href="/register" className="font-semibold text-primary-ink hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-72" aria-hidden />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
