import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { ConvertWorkbench } from "@/features/convert/presentation/convert-workbench";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";

export const metadata: Metadata = { title: "Convert — Marketplace to GSTR-1" };

export default async function ConvertPage() {
  const session = await requireSession();

  const [profiles, platforms] = await Promise.all([
    // Only active GSTINs can be filed for; archived ones were offered here too.
    prisma.gstinProfile.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    Promise.resolve(PLATFORMS_CONFIG),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Convert to GSTR-1</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Four steps: choose the GSTIN and month, upload your marketplace reports, review, download
          the portal-ready JSON and Excel.
        </p>
      </div>
      <ConvertWorkbench profiles={profiles} platforms={platforms} />
    </div>
  );
}
