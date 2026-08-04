"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Eye, EyeOff, ArrowRight, Gift } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { applyReferralAction } from "@/features/billing/actions/referral.actions";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authClient.signUp.email({ name, email, password });
      if (res.error) {
        toast.error(res.error.message || "Registration failed");
      } else {
        toast.success("Account created! Welcome to GSTPilot.");
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
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="group inline-flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
              <FileSpreadsheet className="size-5" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">GSTPilot</span>
          </Link>
          <p className="text-xs text-muted-foreground">
            Start Converting Marketplace Reports to GSTR-1
          </p>
        </div>

        <div className="space-y-6 rounded-3xl border border-border/80 bg-card p-8 shadow-2xl shadow-primary/5">
          <div>
            <h1 className="text-xl font-bold">Create your free account</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Start filing error-free e-commerce GSTR-1 returns today
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                htmlFor="name"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Saad Khan"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-10 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase"
                htmlFor="referralCode"
              >
                <Gift className="size-3.5" /> Referral Code{" "}
                <span className="font-medium tracking-normal normal-case">(optional)</span>
              </label>
              <input
                id="referralCode"
                type="text"
                autoComplete="off"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="GSTP-XXXXXX"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm tracking-wide transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Have a code from a friend? Both of you earn wallet credits after your first
                recharge.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Creating account...
                </>
              ) : (
                <>
                  <ArrowRight className="size-4" /> Create Account
                </>
              )}
            </button>
          </form>

          <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
