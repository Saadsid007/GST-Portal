import type { Metadata } from "next";
import { PageHero, ContentPanel } from "@/app/(marketing)/_components/page-hero";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "Learn how GSTPilot protects your GSTIN profile data, sales files, and personal information.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="How we handle your account details, GSTIN profiles and the sales files you upload."
      />
      <ContentPanel lastUpdated="July 2025">
        <p>
          At GSTPilot, we take data privacy and encryption seriously. We store only the minimum data
          required to deliver GSTR-1 file conversion services.
        </p>

        <h2 id="information-we-collect">1. Information We Collect</h2>
        <p>
          We collect your account email, name, GSTIN profile numbers, and uploaded conversion
          metadata. Uploaded Excel files are processed in secure isolated sessions.
        </p>

        <h2 id="data-security">2. Data Security</h2>
        <p>
          All data transmitted between your browser and GSTPilot servers is encrypted using 256-bit
          SSL/TLS encryption.
        </p>
      </ContentPanel>
    </>
  );
}
