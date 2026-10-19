"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Gift } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { applyReferralAction } from "@/features/billing/actions/referral.actions";
import { PASSWORD_MIN_LENGTH } from "@/config/constants";
import { normalizeIndianMobile, PHONE_ERROR } from "@/features/auth/domain/phone";
import {
  AuthField,
  AuthShell,
  authButtonClass,
  authInputClass,
} from "@/features/auth/presentation/auth-shell";
import { EmailCodeStep } from "@/features/auth/presentation/email-code-step";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"details" | "code">("details");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalPhone = normalizeIndianMobile(phone);
    if (!normalPhone) {
      setPhoneError(PHONE_ERROR);
      return;
    }
    setLoading(true);
    try {
      const res = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: normalPhone,
      });
      if (res.error) {
        toast.error(res.error.message || "Could not create the account");
        return;
      }
      // No session yet: the account opens once the emailed code is entered.
      setStep("code");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function finishSignup() {
    const res = await authClient.signIn.email({ email: email.trim(), password });
    if (res.error) {
      toast.error("Email verified. Please sign in to continue.");
      router.push(`/login?email=${encodeURIComponent(email.trim())}`);
      return;
    }
    // A bad code must never cost the user their account, so this runs after
    // signup has already succeeded and only ever produces a toast.
    const code = referralCode.trim();
    if (code) {
      const applied = await applyReferralAction(code);
      if (applied.success) {
        toast.success("Referral code applied. Your reward unlocks on your first recharge.");
      } else {
        toast.warning(`${applied.error} You can add a code later from Billing.`);
      }
    }
    toast.success("Welcome to GSTPilot");
    router.push("/dashboard");
    router.refresh();
  }

  if (step === "code") {
    return (
      <AuthShell>
        <EmailCodeStep
          email={email.trim()}
          onVerified={finishSignup}
          onBack={() => setStep("details")}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">30-day free trial. No card required.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField id="name" label="Full name">
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={authInputClass}
            />
          </AuthField>

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

          <AuthField
            id="phone"
            label="Mobile number"
            hint={
              phoneError ? (
                <span className="text-destructive-ink">{phoneError}</span>
              ) : (
                "For account and filing alerts. We never share it."
              )
            }
          >
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                +91
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                value={phone}
                aria-invalid={phoneError ? true : undefined}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/[^\d\s+-]/g, "").slice(0, 16));
                  if (phoneError) setPhoneError(null);
                }}
                onBlur={() => {
                  if (phone && !normalizeIndianMobile(phone)) setPhoneError(PHONE_ERROR);
                }}
                placeholder="98765 43210"
                className={`${authInputClass} rounded-l-none ${phoneError ? "border-destructive" : ""}`}
              />
            </div>
          </AuthField>

          <AuthField id="password" label="Password">
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

          {showReferral ? (
            <AuthField
              id="referralCode"
              label="Referral code"
              hint="You and your friend both earn wallet credits after your first recharge."
            >
              <input
                id="referralCode"
                type="text"
                autoComplete="off"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="GSTP-XXXXXX"
                className={`${authInputClass} font-mono tracking-wide`}
              />
            </AuthField>
          ) : (
            <button
              type="button"
              onClick={() => setShowReferral(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-ink hover:underline"
            >
              <Gift className="size-3.5" /> Have a referral code?
            </button>
          )}

          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing you agree to the{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
