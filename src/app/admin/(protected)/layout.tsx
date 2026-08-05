import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getServerSession, isAdmin } from "@/features/auth";
import { AdminSignOutButton } from "@/features/auth/presentation/admin-sign-out-button";

export const metadata: Metadata = { title: "Admin · GSTPilot" };

/**
 * The admin area is its own shell rather than a page inside the dashboard, so an
 * admin signs in and out of it explicitly. Access is re-checked here on every
 * request and independently inside every admin server action.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/admin/login");
  if (!(await isAdmin())) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm leading-none font-bold">GSTPilot Admin</p>
              <p className="mt-0.5 hidden font-mono text-[10px] leading-none text-muted-foreground sm:block">
                {session.user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Back to app
            </Link>
            <AdminSignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
