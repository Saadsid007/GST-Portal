import { redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@/features/auth";
import { getWalletSummary } from "@/features/billing/services/entitlement.service";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Independent reads, so they must not queue behind each other on every
  // navigation. getServerSession is request-memoised, so isAdmin() reuses the
  // session resolved above rather than revalidating it.
  // The wallet is chrome, not content — if it fails the shell still renders.
  const [admin, wallet] = await Promise.all([
    isAdmin(),
    getWalletSummary(session.user.id).catch(() => null),
  ]);

  return (
    <AppShell user={session.user} isAdmin={admin} credits={wallet?.balance ?? null}>
      {children}
    </AppShell>
  );
}
