import type { Metadata } from "next";
import Link from "next/link";
import { Users, ArrowRight, ShieldCheck, CreditCard, Sliders, TrendingUp } from "lucide-react";
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

  const [
    userCount,
    adminCount,
    conversionCount,
    activeSubsCount,
    trialSubsCount,
    capacityAgg,
    paymentsAgg,
    recentUsers,
    recentPayments,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: "ADMIN", deletedAt: null } }),
    prisma.conversionHistory.count(),
    prisma.subscription.count({ where: { status: "ACTIVE", user: { deletedAt: null } } }),
    prisma.subscription.count({ where: { status: "TRIALING", user: { deletedAt: null } } }),
    prisma.gSTINCapacity.aggregate({ _sum: { effectiveCapacity: true } }),
    prisma.payment.aggregate({
      where: { status: { in: ["SUCCESS", "PAID"] } },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { status: { in: ["SUCCESS", "PAID"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        amount: true,
        paymentType: true,
        planSlug: true,
        createdAt: true,
        providerPaymentId: true,
      },
    }),
  ]);

  const totalRevenue = paymentsAgg._sum.amount ?? 0;
  const totalSlots = capacityAgg._sum.effectiveCapacity ?? 0;

  const stats = [
    {
      label: "Total users",
      value: userCount.toLocaleString("en-IN"),
      hint: `${adminCount} administrator${adminCount === 1 ? "" : "s"}`,
      icon: Users,
      href: "/admin/subscriptions",
      bg: "border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card hover:border-blue-500/50 hover:shadow-md hover:shadow-blue-500/5 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90",
      iconBg:
        "bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/25 dark:text-blue-400",
    },
    {
      label: "Active Subscriptions",
      value: activeSubsCount.toLocaleString("en-IN"),
      hint: `${trialSubsCount} on 30-day free trial`,
      icon: CreditCard,
      href: "/admin/subscriptions",
      bg: "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/5 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-card/90",
      iconBg:
        "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400",
    },
    {
      label: "GSTIN Slots Capacity",
      value: totalSlots.toLocaleString("en-IN"),
      hint: "Platform-wide client capacity",
      icon: Sliders,
      href: "/admin/subscriptions",
      bg: "border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] via-violet-500/[0.04] to-card hover:border-purple-500/50 hover:shadow-md hover:shadow-purple-500/5 dark:from-purple-950/60 dark:via-violet-950/30 dark:to-card/90",
      iconBg:
        "bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:bg-purple-500/25 dark:text-purple-400",
    },
    {
      label: "Total Revenue",
      value: formatCurrency(totalRevenue),
      hint: `${conversionCount.toLocaleString("en-IN")} returns generated`,
      icon: TrendingUp,
      href: "/admin/subscriptions",
      bg: "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.04] to-card hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/5 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-card/90",
      iconBg:
        "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400",
    },
  ];

  const adminModules = NAV_GROUPS.find((g) => g.id === "administration")?.items ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Admin overview"
        description="Platform health, subscription capacity, recent payments, and system configuration in one place."
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
            <Card
              variant="solid"
              interactive
              className={`h-full rounded-2xl border p-5 shadow-sm transition-all ${s.bg}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  {s.label}
                </span>
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}
                >
                  <s.icon className="size-4" aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground tabular-nums sm:text-3xl">
                {s.value}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{s.hint}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Module launcher */}
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
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Newest accounts</h2>
            <Link
              href="/admin/users"
              className="text-xs font-semibold text-primary-ink hover:underline"
            >
              View all
            </Link>
          </div>
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
                        <p className="text-[13.5px] font-semibold">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === "ADMIN" ? "primary" : "neutral"}>{u.role}</Badge>
                      </TableCell>
                      <TableCell align="right" className="text-xs text-muted-foreground">
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
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">
              Recent payments &amp; subscriptions
            </h2>
            <Link
              href="/admin/subscriptions"
              className="text-xs font-semibold text-primary-ink hover:underline"
            >
              Manage
            </Link>
          </div>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item / Type</TableHead>
                  <TableHead align="right">Amount</TableHead>
                  <TableHead align="right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.length === 0 ? (
                  <TableEmptyRow colSpan={3}>No payments yet.</TableEmptyRow>
                ) : (
                  recentPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-[13.5px] font-medium capitalize">
                        {p.planSlug ? p.planSlug.replace("_", " ") : p.paymentType}
                      </TableCell>
                      <TableCell
                        align="right"
                        className="text-[14px] font-bold text-emerald-600 tabular-nums dark:text-emerald-400"
                      >
                        ₹{p.amount}
                      </TableCell>
                      <TableCell align="right" className="text-xs text-muted-foreground">
                        {p.createdAt.toLocaleDateString("en-IN")}
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
        <ShieldCheck className="mt-0.5 size-4 flex-shrink-0 text-primary-ink" aria-hidden />
        <p className="text-xs text-muted-foreground">
          Every plan change, capacity grant, and subscription override is recorded to the compliance
          audit log with admin actor details.
        </p>
      </Card>
    </div>
  );
}
