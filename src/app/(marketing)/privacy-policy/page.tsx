import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | GSTPilot",
  description:
    "Learn how GSTPilot protects your GSTIN profile data, sales files, and personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <h1 className="text-3xl font-extrabold">Privacy Policy</h1>
      <div className="space-y-4 rounded-3xl border border-border bg-card p-8 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        <p>Last updated: July 2025</p>
        <p>
          At GSTPilot, we take data privacy and encryption seriously. We store only the minimum data
          required to deliver GSTR-1 file conversion services.
        </p>
        <h2 className="pt-2 text-base font-bold text-foreground">1. Information We Collect</h2>
        <p>
          We collect your account email, name, GSTIN profile numbers, and uploaded conversion
          metadata. Uploaded Excel files are processed in secure isolated sessions.
        </p>
        <h2 className="pt-2 text-base font-bold text-foreground">2. Data Security</h2>
        <p>
          All data transmitted between your browser and GSTPilot servers is encrypted using 256-bit
          SSL/TLS encryption.
        </p>
      </div>
    </div>
  );
}
