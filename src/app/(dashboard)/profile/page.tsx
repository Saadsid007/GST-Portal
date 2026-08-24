import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { GstinProfileManager } from "@/features/profile/presentation/gstin-profile-manager";
import { getGstinCapacity } from "@/features/billing/services/capacity.service";
import { GstinStatus } from "@/features/billing/domain/gstin-capacity";

export const metadata: Metadata = { title: "GST Profiles" };

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
      <div>
        <h1 className="text-2xl font-bold">GST Profiles</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your GSTIN registrations for GSTR-1 generation
        </p>
      </div>
      <GstinProfileManager initialActive={active} initialArchived={archived} capacity={capacity} />
    </div>
  );
}
