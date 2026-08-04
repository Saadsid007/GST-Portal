import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { ConvertWorkbench } from "@/features/convert/presentation/convert-workbench";
import { getAllPlatforms } from "@/features/convert/parsers";

export const metadata: Metadata = { title: "Convert — Marketplace to GSTR-1" };

export default async function ConvertPage() {
  const session = await requireSession();

  const [profiles, platforms] = await Promise.all([
    prisma.gstinProfile.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    Promise.resolve(getAllPlatforms()),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Convert to GSTR-1</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upload your marketplace Excel file and download GSTN-ready GSTR-1 JSON &amp; Excel
        </p>
      </div>
      <ConvertWorkbench profiles={profiles} platforms={platforms} />
    </div>
  );
}
