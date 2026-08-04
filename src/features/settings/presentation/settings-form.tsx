"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, User, Shield, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface Props {
  user: { id: string; name: string; email: string; createdAt: Date };
}

export function SettingsForm({ user }: Props) {
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    setLoadingName(true);
    try {
      await authClient.updateUser({ name });
      toast.success("Name updated");
    } catch {
      toast.error("Failed to update name");
    } finally {
      setLoadingName(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
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
      }
    } catch {
      toast.error("Failed to update password");
    } finally {
      setLoadingPassword(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Account Info */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Account Information</h2>
        </div>

        <form onSubmit={handleNameSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Member Since
            </label>
            <p className="text-sm text-muted-foreground">
              {new Date(user.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loadingName}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loadingName && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-2">
          <Shield className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              New Password
            </label>
            <input
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loadingPassword || !currentPassword || !newPassword}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loadingPassword && <Loader2 className="size-4 animate-spin" />}
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2">
          <Trash2 className="size-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Deleting your account will permanently remove all your data, conversion history, and GST
          profiles. This cannot be undone.
        </p>
        <button
          onClick={() => toast.error("Please contact support to delete your account")}
          className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/10"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
