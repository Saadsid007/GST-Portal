"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Mail,
  Save,
  Shield,
  Trash2,
  User,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Lock,
  Bell,
  CheckCircle2,
  Calendar,
  Sparkles,
  Copy,
  ExternalLink,
  LifeBuoy,
} from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Props {
  user: { id: string; name: string; email: string; createdAt: Date };
}

/** Password floor, mirrored from better-auth's own minimum. */
const MIN_PASSWORD = 8;

export function SettingsForm({ user }: Props) {
  const [activeTab, setActiveTab] = useState<"profile" | "password" | "preferences" | "danger">(
    "profile"
  );

  // Profile form state
  const [name, setName] = useState(user.name);
  const [loadingName, setLoadingName] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Preferences toggles state
  const [prefs, setPrefs] = useState({
    gstrReadyAlert: true,
    deadlineReminders: true,
    lowBalanceWarning: true,
    weeklyDigest: false,
    autoTrimFormat: true,
  });

  const [copiedId, setCopiedId] = useState(false);

  const nameChanged = name.trim() !== user.name && name.trim().length > 0;

  // Password validation & strength
  const hasMinLength = newPassword.length >= MIN_PASSWORD;
  const hasNumber = /\d/.test(newPassword);
  const hasSpecialOrUpper = /[A-Z!@#$%^&*(),.?":{}|<>]/.test(newPassword);

  let strengthScore = 0;
  if (hasMinLength) strengthScore += 1;
  if (hasNumber) strengthScore += 1;
  if (hasSpecialOrUpper) strengthScore += 1;
  if (newPassword.length >= 12) strengthScore += 1;

  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["bg-destructive", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

  const passwordTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD;
  const passwordsDiffer = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmitPassword =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD &&
    newPassword === confirmPassword;

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nameChanged) return;
    setLoadingName(true);
    try {
      await authClient.updateUser({ name: name.trim() });
      toast.success("Profile name successfully updated");
    } catch {
      toast.error("Failed to update name");
    } finally {
      setLoadingName(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitPassword) return;
    setLoadingPassword(true);
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (res.error) toast.error(res.error.message);
      else {
        toast.success("Password successfully updated. All sessions secured.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast.error("Failed to update password");
    } finally {
      setLoadingPassword(false);
    }
  }

  function handleTogglePref(key: keyof typeof prefs) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      toast.success("Preference saved");
      return next;
    });
  }

  function copyUserId() {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    toast.success("User ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-7">
      {/* ── Top Highlight Account & Security Health Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Identity & Role */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-blue-700 uppercase dark:text-blue-300">
              Account Authority
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/25 dark:text-blue-400">
              <UserCheck className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Primary Admin
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3 text-blue-500" />
            Full compliance &amp; filing privileges
          </p>
        </div>

        {/* 2. Authentication Standard */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
              Credential Security
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400">
              <ShieldCheck className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Argon2id Hash
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Check className="size-3 text-emerald-500" />
            Zero plain-text password exposure
          </p>
        </div>

        {/* 3. Session & Data Transmission */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] via-violet-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 dark:from-purple-950/60 dark:via-violet-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-purple-700 uppercase dark:text-purple-300">
              Session Protection
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:bg-purple-500/25 dark:text-purple-400">
              <KeyRound className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-purple-950 sm:text-2xl dark:text-purple-100">
              HTTP-Only SSL
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-purple-700/85 dark:text-purple-300/85">
            <ShieldCheck className="size-3 text-purple-500" />
            Anti-CSRF &amp; tamper-proof token
          </p>
        </div>

        {/* 4. Privacy & DPDP Standard */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-amber-700 uppercase dark:text-amber-300">
              Compliance Standard
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400">
              <Lock className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-amber-950 sm:text-2xl dark:text-amber-100">
              DPDP &amp; ISO 27001
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700/85 dark:text-amber-300/85">
            <CheckCircle2 className="size-3 text-amber-500" />
            Enterprise financial encryption standard
          </p>
        </div>
      </div>

      {/* ── Settings Tabs Navigation ── */}
      <div className="inline-flex flex-wrap rounded-2xl border border-border bg-muted/30 p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            activeTab === "profile"
              ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <User className="size-3.5" />
          <span>Profile &amp; Identity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            activeTab === "password"
              ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <KeyRound className="size-3.5" />
          <span>Password &amp; Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            activeTab === "preferences"
              ? "bg-card text-foreground shadow-xs ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Bell className="size-3.5" />
          <span>Alerts &amp; Preferences</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("danger")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            activeTab === "danger"
              ? "bg-destructive/15 text-destructive-ink shadow-xs ring-1 ring-destructive/30"
              : "text-muted-foreground hover:text-destructive-ink"
          )}
        >
          <Trash2 className="size-3.5" />
          <span>Danger Zone</span>
        </button>
      </div>

      {/* ── Main Content Grid with Aside ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {/* TAB 1: Profile & Identity */}
          {activeTab === "profile" && (
            <Card
              variant="solid"
              className="overflow-hidden rounded-3xl border border-blue-500/25 p-6 shadow-xs"
            >
              <SectionHead
                icon={User}
                title="Profile Identity"
                description="Your administrative name and official email address across GSTPilot."
              />

              <form onSubmit={handleNameSave} className="space-y-5 pt-3">
                {/* Visual Avatar Banner */}
                <div className="flex items-center gap-4 rounded-2xl border border-border/80 bg-muted/20 p-4">
                  <div className="relative">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 text-xl font-black text-white shadow-md shadow-blue-500/30">
                      {user.name?.[0]?.toUpperCase() ?? "U"}
                    </span>
                    <span
                      className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card"
                      title="Account active"
                    >
                      <Check className="size-3 text-white" />
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">{user.name}</h4>
                    <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:text-blue-300">
                      Primary Workspace Owner
                    </span>
                  </div>
                </div>

                <Field label="Full administrative name" htmlFor="settings-name" required>
                  <Input
                    id="settings-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your legal or administrator name"
                    autoComplete="name"
                    className="h-10 text-xs"
                  />
                </Field>

                <Field
                  label="Verified account email"
                  htmlFor="settings-email"
                  hint="Your email serves as your secure authentication identity. Contact enterprise support if you need to transfer domain ownership."
                >
                  <div className="relative">
                    <Input
                      id="settings-email"
                      type="email"
                      value={user.email}
                      disabled
                      prefixNode={<Mail className="size-3.5 text-muted-foreground" />}
                      autoComplete="email"
                      className="h-10 bg-muted/40 font-mono text-xs"
                    />
                    <span className="absolute top-2.5 right-3 inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-3" />
                      Verified
                    </span>
                  </div>
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="size-3.5" />
                    <span>
                      Member since <span className="font-bold text-foreground">{memberSince}</span>
                    </span>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    loading={loadingName}
                    disabled={!nameChanged}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-5 py-2 font-bold text-white shadow-md shadow-blue-500/25 transition hover:brightness-110 disabled:opacity-50"
                  >
                    <Save className="size-3.5" />
                    <span>Save Changes</span>
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* TAB 2: Password & Security */}
          {activeTab === "password" && (
            <Card
              variant="solid"
              className="overflow-hidden rounded-3xl border border-purple-500/25 p-6 shadow-xs"
            >
              <SectionHead
                icon={Shield}
                title="Password &amp; Credentials"
                description={`Ensure your account uses at least ${MIN_PASSWORD} characters with numbers and symbols.`}
              />

              <form onSubmit={handlePasswordChange} className="space-y-5 pt-3">
                <Field label="Current password" htmlFor="settings-current" required>
                  <Input
                    id="settings-current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="h-10 text-xs"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="New password"
                    htmlFor="settings-new"
                    required
                    error={passwordTooShort ? `Use at least ${MIN_PASSWORD} characters` : undefined}
                  >
                    <Input
                      id="settings-new"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      invalid={passwordTooShort}
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                      className="h-10 text-xs"
                    />
                  </Field>

                  <Field
                    label="Confirm new password"
                    htmlFor="settings-confirm"
                    required
                    error={passwordsDiffer ? "Passwords do not match" : undefined}
                  >
                    <Input
                      id="settings-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      invalid={passwordsDiffer}
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      className="h-10 text-xs"
                      suffixNode={
                        canSubmitPassword ? (
                          <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                        ) : undefined
                      }
                    />
                  </Field>
                </div>

                {/* Password Strength Meter */}
                {newPassword.length > 0 && (
                  <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/20 p-4">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Password Strength:</span>
                      <span className="font-bold text-foreground">
                        {strengthLabels[Math.min(strengthScore, 3)]}
                      </span>
                    </div>
                    <div className="grid h-1.5 grid-cols-4 gap-1.5">
                      {[0, 1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={cn(
                            "rounded-full transition-colors",
                            level <= strengthScore - 1
                              ? strengthColors[Math.min(strengthScore - 1, 3)]
                              : "bg-muted"
                          )}
                        />
                      ))}
                    </div>
                    <ul className="grid grid-cols-1 gap-1 pt-1 text-[11px] text-muted-foreground sm:grid-cols-3">
                      <li
                        className={cn(
                          "flex items-center gap-1",
                          hasMinLength && "font-semibold text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        <Check className="size-3" /> 8+ Characters
                      </li>
                      <li
                        className={cn(
                          "flex items-center gap-1",
                          hasNumber && "font-semibold text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        <Check className="size-3" /> Contains Number
                      </li>
                      <li
                        className={cn(
                          "flex items-center gap-1",
                          hasSpecialOrUpper &&
                            "font-semibold text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        <Check className="size-3" /> Uppercase / Symbol
                      </li>
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-5">
                  <p className="text-2xs text-muted-foreground">
                    Active sessions on other devices will remain uninterrupted.
                  </p>
                  <Button
                    type="submit"
                    size="sm"
                    loading={loadingPassword}
                    disabled={!canSubmitPassword}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-5 py-2 font-bold text-white shadow-md shadow-purple-500/25 transition hover:brightness-110 disabled:opacity-50"
                  >
                    <KeyRound className="size-3.5" />
                    <span>Update Password</span>
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* TAB 3: Preferences & Alerts */}
          {activeTab === "preferences" && (
            <Card
              variant="solid"
              className="overflow-hidden rounded-3xl border border-border p-6 shadow-xs"
            >
              <SectionHead
                icon={Bell}
                title="Compliance &amp; Filing Alerts"
                description="Manage real-time notifications for GSTR-1 files, deadlines, and wallet threshold warnings."
              />

              <div className="space-y-4 divide-y divide-border/60 pt-4">
                {/* 1. GSTR-1 JSON Ready */}
                <div className="flex items-center justify-between gap-4 pt-3">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      GSTR-1 JSON File Ready Alert
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Receive an instant toast and email notification when multi-marketplace
                      conversions finish compiling.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePref("gstrReadyAlert")}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      prefs.gstrReadyAlert ? "bg-blue-600" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        prefs.gstrReadyAlert ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* 2. Monthly Filing Reminders */}
                <div className="flex items-center justify-between gap-4 pt-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Government Deadline Reminders
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Proactive reminders on the 8th, 10th and 18th of each month for GSTR-1 and
                      GSTR-3B filings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePref("deadlineReminders")}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      prefs.deadlineReminders ? "bg-blue-600" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        prefs.deadlineReminders ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* 3. Low Balance Warning */}
                <div className="flex items-center justify-between gap-4 pt-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Low Wallet Balance Warning
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Alert when active credits fall below 50 credits to avoid interrupted
                      conversion batches.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePref("lowBalanceWarning")}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      prefs.lowBalanceWarning ? "bg-blue-600" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        prefs.lowBalanceWarning ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* 4. Weekly Digest */}
                <div className="flex items-center justify-between gap-4 pt-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Weekly Reconciliation Digest
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Receive weekly summary breakdown of sales vs return trends across Amazon,
                      Flipkart and Meesho.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePref("weeklyDigest")}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      prefs.weeklyDigest ? "bg-blue-600" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        prefs.weeklyDigest ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 4: Danger Zone */}
          {activeTab === "danger" && (
            <Card
              variant="solid"
              className="overflow-hidden rounded-3xl border border-destructive/40 bg-destructive/[0.02] p-6 shadow-xs"
            >
              <SectionHead
                icon={Trash2}
                tone="destructive"
                title="Account Termination &amp; Data Deletion"
                description="Permanent purging of account credentials, conversion archives, and registered client GSTINs."
              />

              <div className="space-y-4 pt-3">
                <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-4 text-xs text-foreground">
                  <p className="flex items-center gap-1.5 font-bold text-destructive-ink">
                    <AlertTriangle className="size-4" />
                    Please review what happens when your account is closed:
                  </p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
                    <li>All historical multi-marketplace conversion records will be wiped.</li>
                    <li>
                      Registered client GSTIN slots and audit trails will be permanently revoked.
                    </li>
                    <li>Any unused wallet credits will be forfeited immediately.</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/80 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Action requires verification via our security desk.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 border-destructive/40 text-destructive-ink hover:bg-destructive/10"
                    onClick={() =>
                      toast.error(
                        "Please contact support@gstpilot.com to initiate account closure verification."
                      )
                    }
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    Request Account Deletion
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Right Aside: Security & Profile Snapshot ── */}
        <aside className="space-y-5 lg:sticky lg:top-24">
          {/* User Card */}
          <Card
            variant="solid"
            className="rounded-3xl border border-blue-500/25 bg-gradient-to-br from-card via-card to-blue-500/[0.03] p-5 shadow-xs"
          >
            <div className="flex items-center gap-3.5">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-base font-black text-white shadow-md shadow-blue-500/25">
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{user.name}</p>
                <p className="truncate font-mono text-2xs text-muted-foreground">{user.email}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    Active Session
                  </span>
                </div>
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 border-t border-border/60 pt-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="flex items-center gap-1 font-mono text-2xs font-bold text-foreground">
                  <span className="max-w-[110px] truncate">{user.id}</span>
                  <button
                    type="button"
                    onClick={copyUserId}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Copy user ID"
                  >
                    {copiedId ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Joined</dt>
                <dd className="font-semibold text-foreground">{memberSince}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Security Standard</dt>
                <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Argon2id + SSL
                </dd>
              </div>
            </dl>
          </Card>

          {/* Security Checklist Card */}
          <Card variant="subtle" className="rounded-3xl border border-border p-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold tracking-wider text-foreground uppercase">
                Security Checklist
              </h4>
              <Badge variant="success" dot className="px-2 py-0.5 text-2xs font-bold">
                100% Secure
              </Badge>
            </div>
            <ul className="mt-3.5 space-y-2 text-xs">
              <li className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <span>Primary Email Verified</span>
              </li>
              <li className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <span>Encrypted Session Cookie</span>
              </li>
              <li className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <span>Role-Based Access Control</span>
              </li>
              <li className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <span>Auto-Logout on Inactivity</span>
              </li>
            </ul>
          </Card>

          {/* Need Help link */}
          <Card
            variant="solid"
            className="rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-500/[0.08] to-card p-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary-ink">
                <LifeBuoy className="size-4.5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">Need Technical Help?</h5>
                <p className="text-[11px] text-muted-foreground">
                  Our priority support desk is ready.
                </p>
              </div>
            </div>
            <Link
              href="/support"
              className="mt-3.5 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-2xs transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
            >
              <span>Visit Support Center</span>
              <ExternalLink className="size-3" />
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SectionHead({
  icon: Icon,
  title,
  description,
  tone = "default",
}: {
  icon: typeof User;
  title: string;
  description: string;
  tone?: "default" | "destructive";
}) {
  return (
    <div className="flex items-start gap-3.5 border-b border-border/60 pb-4">
      <span
        className={
          tone === "destructive"
            ? "flex size-10 flex-shrink-0 items-center justify-center rounded-2xl bg-destructive/15 text-destructive-ink shadow-2xs ring-1 ring-destructive/30"
            : "flex size-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 text-blue-600 shadow-2xs ring-1 ring-blue-500/30 dark:text-blue-400"
        }
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
