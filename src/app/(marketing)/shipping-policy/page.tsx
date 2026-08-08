import type { Metadata } from "next";
import { LEGAL_DOCUMENTS } from "@/lib/seo/legal-data";
import { LegalPage, legalMetadata } from "@/app/(marketing)/_components/legal-page";

const doc = LEGAL_DOCUMENTS["shipping-policy"]!;

export const metadata: Metadata = legalMetadata(doc);

export default function ShippingPolicyPage() {
  return <LegalPage doc={doc} />;
}
