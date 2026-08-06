"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });

      if (res.error) {
        toast.error(res.error.message ?? "Invalid email or password");
      } else {
        toast.success("Welcome back!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

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
          <div>
            <h1 className="text-xl font-bold">Sign in to your account</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Access your saved GST profiles and conversion history
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
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                  htmlFor="password"
                >
                  Password
                </label>
              </div>
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
                  <Loader2 className="size-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  <ArrowRight className="size-4" /> Sign In
                </>
              )}
            </button>
          </form>

          <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="font-bold text-primary-ink hover:underline">
              Create a free account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
