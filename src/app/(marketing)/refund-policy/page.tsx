import type { Metadata } from "next";
import { PageHero, ContentPanel } from "@/app/(marketing)/_components/page-hero";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "30-day money back guarantee and refund policy.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Refund Policy"
        description="Where you stand if GSTPilot is not right for you."
      />
      <ContentPanel>
        <p>We offer a hassle-free 30-day money-back guarantee for all paid subscription plans.</p>
      </ContentPanel>
    </>
  );
}
