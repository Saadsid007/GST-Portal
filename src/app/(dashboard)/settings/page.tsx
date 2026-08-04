import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import { SettingsForm } from "@/features/settings/presentation/settings-form";
import prisma from "@/lib/prisma";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage your account preferences</p>
      </div>
      <SettingsForm user={user} />
    </div>
  );
}
