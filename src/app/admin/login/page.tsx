"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { isCurrentUserAdminAction } from "@/features/auth/actions/admin-users.actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authClient.signIn.email({ email, password });
      if (res.error) {
        toast.error(res.error.message || "Login failed");
        return;
      }

      // Credentials were valid, but this console is admin-only. A non-admin is told
      // nothing about why — and is sent to the app they do have access to.
      if (!(await isCurrentUserAdminAction())) {
        toast.error("That account does not have admin access.");
        router.push("/dashboard");
        return;
      }

      toast.success("Welcome to the admin console.");
      router.push("/admin");
      router.refresh();
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
          <div className="inline-flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <ShieldCheck className="size-5" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">GSTPilot Admin</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Pricing, wallets, credit codes and campaigns
          </p>
        </div>

        <div className="space-y-6 rounded-3xl border border-border/80 bg-card p-8 shadow-2xl shadow-primary/5">
          <div>
            <h1 className="text-xl font-bold">Admin sign in</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              This console is restricted to accounts with the admin role.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="admin@example.com"
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  <ArrowRight className="size-4" /> Sign In
                </>
              )}
            </button>
          </form>

          <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
            Not an admin?{" "}
            <Link href="/login" className="font-bold text-primary-ink hover:underline">
              Sign in to the app
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
