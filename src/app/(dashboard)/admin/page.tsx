import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  Wallet,
  FileSpreadsheet,
  Coins,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { requireAdmin } from "@/features/auth";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import {
  Badge,
  Card,
  PageHeader,
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyRow,
} from "@/components/ui";
import { NAV_GROUPS } from "@/config/navigation";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  await requireAdmin();

  // One round-trip for the whole overview rather than eight sequential reads.
  const [userCount, adminCount, conversionCount, walletAgg, recentUsers, recentTx] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.conversionHistory.count(),
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      prisma.walletTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, type: true, creditAmount: true, createdAt: true, walletId: true },
      }),
    ]);

  const outstandingCredits = walletAgg._sum.balance ?? 0;

  const stats = [
    {
      label: "Total users",
      value: userCount.toLocaleString("en-IN"),
      hint: `${adminCount} administrator${adminCount === 1 ? "" : "s"}`,
      icon: Users,
      href: "/admin/users",
    },
    {
      label: "Returns generated",
      value: conversionCount.toLocaleString("en-IN"),
      hint: "Across every GSTIN",
      icon: FileSpreadsheet,
      href: "/history",
    },
    {
      label: "Credits outstanding",
      value: outstandingCredits.toLocaleString("en-IN"),
      hint: `≈ ${formatCurrency(outstandingCredits)} of unspent balance`,
      icon: Coins,
      href: "/admin/wallets",
    },
    {
      label: "Ledger entries",
      value: recentTx.length > 0 ? "Active" : "Quiet",
      hint: "Most recent wallet movements below",
      icon: TrendingUp,
      href: "/admin/wallets",
    },
  ];

  const adminModules = NAV_GROUPS.find((g) => g.id === "administration")?.items ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Admin overview"
        description="Platform health, recent activity and every configuration module in one place."
        actions={
          <Badge variant="primary" size="md">
            <ShieldCheck className="size-3" aria-hidden />
            Administrator access
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card variant="solid" interactive className="h-full p-5">
              <div className="flex items-center gap-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                <s.icon className="size-4 text-primary-ink" aria-hidden />
                {s.label}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Module launcher — mirrors the sidebar for anyone who lands here first. */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Configuration modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminModules
            .filter((m) => m.href !== "/admin")
            .map((m) => (
              <Link key={m.href} href={m.href}>
                <Card variant="solid" interactive className="flex h-full items-start gap-3 p-4">
                  <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink ring-1 ring-primary/20">
                    <m.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      {m.label}
                      <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {m.description}
                    </span>
                  </span>
                </Card>
              </Link>
            ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Newest accounts</h2>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead align="right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUsers.length === 0 ? (
                  <TableEmptyRow colSpan={3}>No accounts yet.</TableEmptyRow>
                ) : (
                  recentUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="text-xs font-semibold">{u.name}</p>
                        <p className="text-2xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === "ADMIN" ? "primary" : "neutral"}>{u.role}</Badge>
                      </TableCell>
                      <TableCell align="right" className="text-2xs text-muted-foreground">
                        {u.createdAt.toLocaleDateString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableWrapper>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Recent wallet activity</h2>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead align="right">Credits</TableHead>
                  <TableHead align="right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTx.length === 0 ? (
                  <TableEmptyRow colSpan={3}>No wallet movements yet.</TableEmptyRow>
                ) : (
                  recentTx.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs font-medium">{t.type}</TableCell>
                      <TableCell
                        align="right"
                        className={`text-xs font-semibold tabular-nums ${
                          t.creditAmount >= 0 ? "text-success-ink" : "text-destructive-ink"
                        }`}
                      >
                        {t.creditAmount >= 0 ? "+" : ""}
                        {t.creditAmount}
                      </TableCell>
                      <TableCell align="right" className="text-2xs text-muted-foreground">
                        {t.createdAt.toLocaleDateString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableWrapper>
        </section>
      </div>

      <Card variant="subtle" className="flex items-start gap-3 p-4">
        <Wallet className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">
          Every change made in these modules is written to the audit log with the acting
          administrator, and each admin action re-checks your role server-side.
        </p>
      </Card>
    </div>
  );
}
