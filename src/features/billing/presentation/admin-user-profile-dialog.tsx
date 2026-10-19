"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  Mail,
  Minus,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { cn, formatCurrency, formatDate, formatRelative } from "@/lib/utils";
import { formatIndianMobile } from "@/features/auth/domain/phone";
import {
  adminDeleteUserAction,
  adminRestoreUserAction,
} from "@/features/auth/actions/admin-users.actions";
import {
  adminAdjustGstinCapacityAction,
  adminChangeUserPlanAction,
  adminResetTrialAction,
} from "@/features/billing/actions/admin-subscription.actions";
import {
  adminAdjustValidityAction,
  adminGetUserProfileAction,
  type AdminUserProfile,
} from "@/features/billing/actions/admin-user-profile.actions";
import { getAllPlans, type PlanSlug } from "@/features/billing/config/pricing.config";

interface Props {
  userId: string | null;
  onClose: () => void;
  /** Called after anything on the account changed, so the list can refresh. */
  onChanged: () => void;
}

const STATUS_BADGE: Record<string, "success" | "info" | "warning" | "destructive" | "neutral"> = {
  ACTIVE: "success",
  TRIALING: "info",
  PAST_DUE: "warning",
  EXPIRED: "destructive",
  CANCELLED: "neutral",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-subtle px-3 py-2.5">
      <p className="text-2xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none";
const ghostButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent disabled:opacity-50";
const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50";

/**
 * One account, everything about it, and every change an admin can make.
 *
 * Opened from the users list. Who the person is and how to reach them, which
 * plan they are on and until when, what they use — and the controls to move
 * their validity either way, change plan or capacity, or delete the account.
 */
export function AdminUserProfileDialog({ userId, onClose, onChanged }: Props) {
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [pending, startAction] = useTransition();

  const [days, setDays] = useState(30);
  const [planSlug, setPlanSlug] = useState<PlanSlug>("growth");
  const [planDays, setPlanDays] = useState(30);
  const [capacityDelta, setCapacityDelta] = useState(5);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");

  const load = useCallback(
    (id: string) => {
      startLoading(async () => {
        const res = await adminGetUserProfileAction(id);
        if (res.success) {
          setProfile(res.data);
          setLoadError(null);
          if (res.data.subscription) setPlanSlug(res.data.subscription.planSlug as PlanSlug);
        } else {
          setLoadError(res.error);
        }
      });
    },
    [startLoading]
  );

  // Mounted afresh for each user (the list keys it by id), so the form state
  // never carries one account's half-typed values into the next.
  useEffect(() => {
    if (userId) load(userId);
  }, [userId, load]);

  // Read once: a clock read during render is impure, and the preview below
  // only needs today's date.
  const [now] = useState(() => Date.now());

  function run(
    work: () => Promise<{ success: boolean; error?: string }>,
    done: string,
    after?: () => void
  ) {
    if (!userId) return;
    startAction(async () => {
      const res = await work();
      if (res.success) {
        toast.success(done);
        setNote("");
        onChanged();
        if (after) after();
        else load(userId);
      } else {
        toast.error(res.error ?? "That did not work");
      }
    });
  }

  const sub = profile?.subscription;
  const deleted = Boolean(profile?.deletedAt);

  return (
    <Modal
      open={userId !== null}
      onClose={onClose}
      size="2xl"
      icon={<UserRound className="size-4 text-primary-ink" />}
      title={profile ? profile.name : "User profile"}
      description={profile ? profile.email : undefined}
    >
      {!profile ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {loadError ? (
            <span className="text-destructive-ink">{loadError}</span>
          ) : loading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : null}
        </div>
      ) : (
        <div className="space-y-6 p-5">
          {deleted && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Deleted on {formatDate(profile.deletedAt)}. The person cannot sign in; their data is
              kept. Signing up again with this email makes a new account.
            </div>
          )}

          <Section title="Contact & account">
            <div className="grid gap-2 sm:grid-cols-3">
              <Fact label="Email">
                <span className="flex items-center gap-1.5 break-all">
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                  <a href={`mailto:${profile.email}`} className="hover:underline">
                    {profile.email}
                  </a>
                </span>
                <Badge variant={profile.emailVerified ? "success" : "warning"} className="mt-1">
                  {profile.emailVerified ? "Verified" : "Not verified"}
                </Badge>
              </Fact>
              <Fact label="Mobile">
                {profile.phone ? (
                  <a
                    href={`tel:${profile.phone}`}
                    className="flex items-center gap-1.5 hover:underline"
                  >
                    <Phone className="size-3.5 text-muted-foreground" />
                    {formatIndianMobile(profile.phone)}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not given</span>
                )}
              </Fact>
              <Fact label="Last active">
                <span
                  title={
                    profile.lastActiveAt
                      ? new Date(profile.lastActiveAt).toLocaleString("en-IN")
                      : undefined
                  }
                >
                  {formatRelative(profile.lastActiveAt)}
                </span>
              </Fact>
              <Fact label="Joined">{formatDate(profile.createdAt)}</Fact>
              <Fact label="Role">{profile.role === "ADMIN" ? "Admin" : "User"}</Fact>
              <Fact label="Returns generated">
                {profile.conversions}
                {profile.lastConversionAt && (
                  <span className="ml-1 text-2xs font-normal text-muted-foreground">
                    · last {formatRelative(profile.lastConversionAt)}
                  </span>
                )}
              </Fact>
            </div>
          </Section>

          <Section title="Plan & validity">
            <div className="grid gap-2 sm:grid-cols-4">
              <Fact label="Plan">{sub?.planName ?? "No plan yet"}</Fact>
              <Fact label="Status">
                {sub ? (
                  <Badge variant={STATUS_BADGE[sub.status] ?? "neutral"}>{sub.status}</Badge>
                ) : (
                  "—"
                )}
              </Fact>
              <Fact label="Valid till">{sub ? formatDate(sub.endDate) : "—"}</Fact>
              <Fact label="Days left">
                <span className={cn(sub && sub.daysRemaining <= 3 && "text-warning-ink")}>
                  {sub ? sub.daysRemaining : "—"}
                </span>
              </Fact>
            </div>

            {sub && !deleted && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <CalendarClock className="size-3.5 text-primary-ink" /> Change validity
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={ghostButton}
                    onClick={() => setDays((d) => d - 1)}
                    aria-label="One day fewer"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    type="number"
                    value={days}
                    onChange={(e) => setDays(Number.parseInt(e.target.value, 10) || 0)}
                    className={cn(inputClass, "w-24 text-center font-semibold")}
                    aria-label="Days to add or remove"
                  />
                  <button
                    type="button"
                    className={ghostButton}
                    onClick={() => setDays((d) => d + 1)}
                    aria-label="One day more"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  {[-30, -7, 7, 30, 90, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-2xs font-semibold transition",
                        days === d
                          ? "border-primary bg-primary/10 text-primary-ink"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
                <p className="text-2xs text-muted-foreground">
                  {days === 0
                    ? "Enter a number of days."
                    : days > 0
                      ? `Adds ${days} days — valid till ${formatDate(
                          new Date(Math.max(new Date(sub.endDate).getTime(), now) + days * 86400000)
                        )}.`
                      : new Date(sub.endDate).getTime() + days * 86400000 <= now
                        ? "Removes more days than are left — the plan expires now."
                        : `Removes ${-days} days — valid till ${formatDate(
                            new Date(new Date(sub.endDate).getTime() + days * 86400000)
                          )}.`}
                </p>
                <div className="flex gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason (kept in the audit log)"
                    className={inputClass}
                    maxLength={300}
                  />
                  <button
                    type="button"
                    disabled={pending || days === 0}
                    className={cn(primaryButton, "shrink-0")}
                    onClick={() =>
                      run(
                        () => adminAdjustValidityAction({ userId: profile.userId, days, note }),
                        days > 0 ? `Added ${days} days` : `Removed ${-days} days`
                      )
                    }
                  >
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Apply
                  </button>
                </div>
              </div>
            )}

            {!deleted && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold">Change plan</p>
                  <select
                    value={planSlug}
                    onChange={(e) => setPlanSlug(e.target.value as PlanSlug)}
                    className={inputClass}
                  >
                    {getAllPlans().map((plan) => (
                      <option key={plan.slug} value={plan.slug}>
                        {plan.name} — {plan.includedGSTINs} GSTINs, ₹{plan.monthlyPrice}
                        {plan.comingSoon ? " (not public)" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={planDays}
                      onChange={(e) => setPlanDays(Number.parseInt(e.target.value, 10) || 30)}
                      className={cn(inputClass, "w-24")}
                      aria-label="Plan length in days"
                    />
                    <span className="text-2xs text-muted-foreground">days from today</span>
                    <button
                      type="button"
                      disabled={pending}
                      className={cn(primaryButton, "ml-auto")}
                      onClick={() =>
                        run(
                          () =>
                            adminChangeUserPlanAction({
                              userId: profile.userId,
                              planSlug,
                              durationDays: planDays,
                              note,
                            }),
                          "Plan changed"
                        )
                      }
                    >
                      Apply plan
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    className={cn(ghostButton, "w-full")}
                    onClick={() => {
                      if (!confirm(`Reset ${profile.name} to a fresh 30-day free trial?`)) return;
                      run(() => adminResetTrialAction({ userId: profile.userId }), "Trial reset");
                    }}
                  >
                    <RotateCcw className="size-3.5" /> Reset to a fresh 30-day trial
                  </button>
                </div>

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold">GSTIN capacity</p>
                  <p className="text-sm">
                    <span className="font-semibold">{profile.capacity.active}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      of {profile.capacity.total} in use ({profile.capacity.included} plan +{" "}
                      {profile.capacity.additional} extra)
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={capacityDelta}
                      onChange={(e) => setCapacityDelta(Number.parseInt(e.target.value, 10) || 0)}
                      className={cn(inputClass, "w-24 text-center")}
                      aria-label="Extra GSTINs to add or remove"
                    />
                    <span className="text-2xs text-muted-foreground">extra (− to remove)</span>
                    <button
                      type="button"
                      disabled={pending || capacityDelta === 0}
                      className={cn(primaryButton, "ml-auto")}
                      onClick={() =>
                        run(
                          () =>
                            adminAdjustGstinCapacityAction({
                              userId: profile.userId,
                              additionalGstins: capacityDelta,
                              note,
                            }),
                          "Capacity updated"
                        )
                      }
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Section title="Usage">
            <div className="grid gap-2 sm:grid-cols-3">
              <Fact label="Wallet balance">
                {profile.wallet ? formatCurrency(profile.wallet.balance) : "—"}
                {profile.wallet?.isFrozen && (
                  <Badge variant="destructive" className="ml-1.5">
                    Frozen
                  </Badge>
                )}
              </Fact>
              <Fact label="Total paid">{formatCurrency(profile.totalPaid)}</Fact>
              <Fact label="GSTINs">{profile.gstins.length}</Fact>
            </div>
            {profile.gstins.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border text-xs">
                {profile.gstins.map((g) => (
                  <li
                    key={g.gstinNumber}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="font-mono">{g.gstinNumber}</span>
                      <span className="ml-2 truncate text-muted-foreground">{g.name}</span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {g.isDefault && <Badge variant="primary">Default</Badge>}
                      <Badge variant={g.status === "ACTIVE" ? "success" : "neutral"}>
                        {g.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {profile.payments.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border text-xs">
                {profile.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {formatDate(p.createdAt)}
                      <span className="ml-2 text-muted-foreground">
                        {p.paymentType.toLowerCase().replace(/_/g, " ")}
                        {p.planSlug ? ` · ${p.planSlug}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{formatCurrency(p.amount)}</span>
                      <Badge
                        variant={
                          p.status === "SUCCESS" || p.status === "PAID" ? "success" : "neutral"
                        }
                      >
                        {p.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {profile.tickets.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border text-xs">
                {profile.tickets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <Link
                      href={`/admin/support/${t.id}`}
                      className="min-w-0 truncate hover:underline"
                    >
                      <span className="font-mono text-muted-foreground">{t.reference}</span>{" "}
                      {t.subject}
                    </Link>
                    <Badge>{t.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {profile.audit.length > 0 && (
            <Section title="Admin history">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {profile.audit.map((a, i) => (
                  <li key={i}>
                    <span className="text-foreground">
                      {a.action
                        .replace(/^ADMIN_/, "")
                        .replace(/_/g, " ")
                        .toLowerCase()}
                    </span>{" "}
                    · {formatRelative(a.createdAt)}
                    {a.note ? ` — ${a.note}` : ""}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {profile.role !== "ADMIN" && (
            <Section title="Danger zone">
              {deleted ? (
                <button
                  type="button"
                  disabled={pending}
                  className={ghostButton}
                  onClick={() =>
                    run(() => adminRestoreUserAction(profile.userId), "Account restored", onClose)
                  }
                >
                  <RotateCcw className="size-3.5" /> Restore this account
                </button>
              ) : (
                <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Signs them out everywhere and they can no longer sign in. Their payments, GSTINs
                    and returns are kept. They are not told; signing up again with the same email
                    starts a new, empty account. Type <span className="font-mono">DELETE</span> to
                    confirm.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={confirmDelete}
                      onChange={(e) => setConfirmDelete(e.target.value)}
                      placeholder="DELETE"
                      className={cn(inputClass, "font-mono")}
                      aria-label="Type DELETE to confirm"
                    />
                    <button
                      type="button"
                      disabled={pending || confirmDelete !== "DELETE"}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
                      onClick={() =>
                        run(() => adminDeleteUserAction(profile.userId), "Account deleted", onClose)
                      }
                    >
                      <Trash2 className="size-3.5" /> Delete account
                    </button>
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}
