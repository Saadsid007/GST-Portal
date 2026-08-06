"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Mail, Save, Shield, Trash2, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Badge, Button, Card, Field, Input } from "@/components/ui";

interface Props {
  user: { id: string; name: string; email: string; createdAt: Date };
}

/** Password floor, mirrored from better-auth's own minimum. */
const MIN_PASSWORD = 8;

export function SettingsForm({ user }: Props) {
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const nameChanged = name.trim() !== user.name && name.trim().length > 0;

  // Surfaced inline rather than on submit — a mismatch the user can already see
  // should not need a round-trip to report.
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
      toast.success("Name updated");
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
        toast.success("Password updated");
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

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        {/* Profile */}
        <Card variant="solid">
          <SectionHead
            icon={User}
            title="Profile"
            description="How your name appears across GSTPilot."
          />
          <form onSubmit={handleNameSave} className="space-y-4 p-5 pt-0">
            <Field label="Full name" htmlFor="settings-name" required>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </Field>

            <Field
              label="Email"
              htmlFor="settings-email"
              hint="Your email is your sign-in identity and cannot be changed here. Contact support if it needs to move."
            >
              <Input
                id="settings-email"
                type="email"
                value={user.email}
                disabled
                prefixNode={<Mail />}
                autoComplete="email"
              />
            </Field>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Member since <span className="font-medium text-foreground">{memberSince}</span>
              </p>
              <Button type="submit" size="sm" loading={loadingName} disabled={!nameChanged}>
                <Save />
                Save changes
              </Button>
            </div>
          </form>
        </Card>

        {/* Password */}
        <Card variant="solid">
          <SectionHead
            icon={Shield}
            title="Password"
            description={`At least ${MIN_PASSWORD} characters. You stay signed in on your other devices.`}
          />
          <form onSubmit={handlePasswordChange} className="space-y-4 p-5 pt-0">
            <Field label="Current password" htmlFor="settings-current" required>
              <Input
                id="settings-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
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
                  suffixNode={
                    canSubmitPassword ? <Check className="text-success-ink" /> : undefined
                  }
                />
              </Field>
            </div>

            <div className="flex justify-end border-t border-border pt-4">
              <Button
                type="submit"
                size="sm"
                loading={loadingPassword}
                disabled={!canSubmitPassword}
              >
                <Shield />
                Update password
              </Button>
            </div>
          </form>
        </Card>

        {/* Danger zone */}
        <Card variant="solid" className="border-destructive/30">
          <SectionHead
            icon={Trash2}
            tone="destructive"
            title="Delete account"
            description="Permanently removes your data, conversion history and GST profiles."
          />
          <div className="flex flex-col gap-3 p-5 pt-0 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 flex-shrink-0 text-destructive-ink" />
              This cannot be undone. Download anything you still need first.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 border-destructive/40 text-destructive-ink hover:bg-destructive/10"
              onClick={() => toast.error("Please contact support to delete your account")}
            >
              Delete account
            </Button>
          </div>
        </Card>
      </div>

      {/* Aside: account at a glance */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <Card variant="subtle" className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary-ink ring-1 ring-primary/25">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-2xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{memberSince}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sign-in</dt>
              <dd className="font-medium">Email &amp; password</dd>
            </div>
          </dl>
        </Card>

        <Card variant="subtle" className="p-5">
          <Badge variant="success" dot>
            Account secure
          </Badge>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Use a password you don&rsquo;t reuse elsewhere. We never email you asking for it.
          </p>
        </Card>
      </aside>
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
    <div className="flex items-start gap-3 p-5">
      <span
        className={
          tone === "destructive"
            ? "flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive-ink ring-1 ring-destructive/20"
            : "flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink ring-1 ring-primary/20"
        }
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
