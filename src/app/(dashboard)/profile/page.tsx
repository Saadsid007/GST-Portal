import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { GstinProfileManager } from "@/features/profile/presentation/gstin-profile-manager";
import { getGstinCapacity } from "@/features/billing/services/capacity.service";
import { GstinStatus } from "@/features/billing/domain/gstin-capacity";
import { PageHeader, Badge } from "@/components/ui";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "GST Profiles — GSTPilot" };

export default async function ProfilePage() {
  const session = await requireSession();
  const [profiles, capacity] = await Promise.all([
    prisma.gstinProfile.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    getGstinCapacity(session.user.id),
  ]);

  const active = profiles.filter((p) => p.status === GstinStatus.ACTIVE);
  const archived = profiles.filter((p) => p.status === GstinStatus.ARCHIVED);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organization & Clients"
        title="GST Registrations"
        description="Authoritative client registry for multi-marketplace GSTR-1 generation and compliance tracking."
        actions={
          <Badge variant="primary" size="md">
            <ShieldCheck className="size-3" aria-hidden />
            {capacity.used} of {capacity.totalCapacity} Slots Active
          </Badge>
        }
      />
      <GstinProfileManager initialActive={active} initialArchived={archived} capacity={capacity} />
    </div>
  );
}
