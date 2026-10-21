import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import { SettingsForm } from "@/features/settings/presentation/settings-form";
import { Badge, PageHeader } from "@/components/ui";
import prisma from "@/lib/prisma";
import { ShieldCheck, UserCheck } from "lucide-react";

export const metadata: Metadata = { title: "Settings & Security — GSTPilot" };

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
        eyebrow="Account & Workspace"
        title="Settings & Security"
        description="Manage your profile identity, authentication credentials, notifications, and compliance safeguards."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="success"
              size="md"
              className="bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-400"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              Account 100% Protected
            </Badge>
            <Badge variant="primary" size="md" className="hidden sm:inline-flex">
              <UserCheck className="size-3.5 text-primary-ink" aria-hidden />
              Primary Administrator
            </Badge>
          </div>
        }
      />
      <SettingsForm user={user} />
    </div>
  );
}
