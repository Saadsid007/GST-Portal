import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import { SettingsForm } from "@/features/settings/presentation/settings-form";
import { PageHeader } from "@/components/ui";
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
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, password and account controls."
      />
      <SettingsForm user={user} />
    </div>
  );
}
