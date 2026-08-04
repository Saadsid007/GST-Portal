import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { GstinProfileManager } from "@/features/profile/presentation/gstin-profile-manager";

export const metadata: Metadata = { title: "GST Profile" };

export default async function ProfilePage() {
  const session = await requireSession();
  const profiles = await prisma.gstinProfile.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GST Profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your GSTIN registrations for GSTR-1 generation
        </p>
      </div>
      <GstinProfileManager initialProfiles={profiles} />
    </div>
  );
}
