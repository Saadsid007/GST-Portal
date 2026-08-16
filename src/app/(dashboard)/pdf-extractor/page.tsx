import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { PdfExtractorView } from "@/features/pdf-extractor/presentation/pdf-extractor-view";

export const metadata: Metadata = {
  title: "PDF Invoice Extractor — GSTPilot",
  description: "Extract and classify B2B, B2C, and HSN data from multiple PDF invoices in bulk",
};

export default async function PdfExtractorPage() {
  const session = await requireSession();

  const defaultProfile = await prisma.gstinProfile.findFirst({
    where: { userId: session.user.id, isDefault: true },
  });

  return (
    <div className="space-y-6">
      <PdfExtractorView initialGstin={defaultProfile?.gstinNumber || ""} />
    </div>
  );
}
