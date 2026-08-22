import { describe, it, expect } from "vitest";
import {
  renderVerificationEmailHtml,
  renderPasswordResetEmailHtml,
  renderPasswordChangedEmailHtml,
} from "@/features/email/templates/auth-emails.template";
import {
  renderWelcomeTrialEmailHtml,
  renderPaymentReceiptEmailHtml,
  renderCampaignBroadcastEmailHtml,
} from "@/features/email/templates/transaction-emails.template";

describe("Email Templates Engine", () => {
  it("renders email verification template with 6-digit OTP and verify URL", () => {
    const { subject, html, text } = renderVerificationEmailHtml({
      name: "Saad",
      otp: "982341",
      verifyUrl: "https://gstpilot.com/verify-email?email=test@example.com",
    });

    expect(subject).toContain("982341");
    expect(html).toContain("982341");
    expect(html).toContain("Hello Saad,");
    expect(html).toContain("https://gstpilot.com/verify-email?email=test@example.com");
    expect(html).toContain("gstpilot.official@gmail.com");
    expect(text).toContain("982341");
  });

  it("renders password reset template with secure reset button and OTP", () => {
    const { subject, html, text } = renderPasswordResetEmailHtml({
      name: "Akash",
      otp: "452109",
      resetUrl: "https://gstpilot.com/reset-password?email=akash@example.com",
    });

    expect(subject).toBe("Reset your GSTPilot account password");
    expect(html).toContain("452109");
    expect(html).toContain("Hello Akash,");
    expect(html).toContain("https://gstpilot.com/reset-password?email=akash@example.com");
    expect(text).toContain("452109");
  });

  it("renders password changed security notification", () => {
    const { subject, html } = renderPasswordChangedEmailHtml({
      name: "Saad",
      time: "22 Aug 2026, 10:30 AM",
    });

    expect(subject).toContain("Security Alert");
    expect(html).toContain("22 Aug 2026, 10:30 AM");
    expect(html).toContain("gstpilot.official@gmail.com");
  });

  it("renders welcome 30-day free trial email with 7 GSTIN slots", () => {
    const { subject, html, text } = renderWelcomeTrialEmailHtml({
      name: "Priya",
      trialDays: 30,
      gstinLimit: 7,
      dashboardUrl: "https://gstpilot.com/dashboard",
    });

    expect(subject).toContain("30-Day Free Trial");
    expect(html).toContain("7 Client GSTIN Capacity");
    expect(html).toContain("Unlimited GSTR-1 Generation");
    expect(text).toContain("7 GSTIN capacity");
  });

  it("renders itemized payment receipt email", () => {
    const { subject, html, text } = renderPaymentReceiptEmailHtml({
      name: "Priya",
      orderId: "order_12345",
      paymentId: "pay_98765",
      amountRupees: 129,
      planName: "Growth Plan",
      gstinSlots: 15,
      date: "22 Aug 2026",
      billingUrl: "https://gstpilot.com/billing",
    });

    expect(subject).toContain("₹129 for Growth Plan");
    expect(html).toContain("₹129");
    expect(html).toContain("Growth Plan");
    expect(html).toContain("15 GSTINs Included");
    expect(html).toContain("pay_98765");
    expect(text).toContain("₹129");
  });

  it("renders campaign broadcast announcement template", () => {
    const { html, text } = renderCampaignBroadcastEmailHtml({
      name: "Sellers",
      headline: "New Meesho Return Netting Feature Live",
      bodyText: "You can now process multi-month Meesho returns with 100% precision.\n\nCheck out the demo.",
      ctaText: "Explore Features",
      ctaUrl: "https://gstpilot.com/features",
    });

    expect(html).toContain("New Meesho Return Netting Feature Live");
    expect(html).toContain("Explore Features");
    expect(html).toContain("https://gstpilot.com/features");
    expect(text).toContain("New Meesho Return Netting Feature Live");
  });
});
