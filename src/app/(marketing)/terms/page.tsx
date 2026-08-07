import type { Metadata } from "next";
import { PageHero, ContentPanel } from "@/app/(marketing)/_components/page-hero";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service",
  description: "Terms and conditions governing the use of the GSTPilot platform.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        description="The terms you agree to when you use GSTPilot."
      />
      <ContentPanel lastUpdated="July 2025">
        <p>By using GSTPilot, you agree to comply with and be bound by these Terms of Service.</p>

        <h2 id="use-of-services">1. Use of Services</h2>
        <p>
          GSTPilot provides automated file conversion for marketplace tax reports. Users are
          responsible for verifying generated GSTR-1 JSON files before final submission to the
          Government GST Portal.
        </p>
      </ContentPanel>
    </>
  );
}
