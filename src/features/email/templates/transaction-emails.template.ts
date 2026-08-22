/**
 * Transactional & Marketing Email Templates for GSTPilot
 * Includes Free Trial Welcome, Payment Receipts, Expiry Alerts, and Broadcasts.
 */

import { renderBaseEmailHtml } from "./base-email.template";

export function renderWelcomeTrialEmailHtml(params: {
  name?: string;
  trialDays?: number;
  gstinLimit?: number;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const { name, trialDays = 30, gstinLimit = 7, dashboardUrl } = params;
  const greeting = name ? `Welcome ${name}!` : "Welcome to GSTPilot!";
  const subject = `Welcome to GSTPilot — Your ${trialDays}-Day Free Trial is Active!`;

  const contentHtml = `
    <p style="margin-top: 0;">${greeting}</p>
    <p>
      Thank you for joining <strong>GSTPilot</strong> — the fastest AI-powered compliance engine to convert e-commerce sales reports into 100% government-compliant GSTR-1 Excel & JSON.
    </p>

    <!-- Trial Benefits Box -->
    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 800; color: #0F172A;">
        🚀 Your Free Trial Includes:
      </h2>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8; color: #334155;">
        <li><strong>${trialDays} Days Full Access</strong> — ₹0 charges, no credit card required.</li>
        <li><strong>${gstinLimit} Client GSTIN Capacity</strong> — Add up to ${gstinLimit} client profiles.</li>
        <li><strong>Unlimited GSTR-1 Generation</strong> — Unwatermarked JSON & Excel files.</li>
        <li><strong>All Major Marketplaces</strong> — Amazon (MTR v3), Flipkart, Meesho, Myntra & JioMart.</li>
        <li><strong>Automatic TCS Reconciliation</strong> — Section 52 state-wise reconciliation.</li>
      </ul>
    </div>

    <p style="text-align: center; margin: 28px 0 16px 0;">
      <a href="${dashboardUrl}" class="btn">
        Open Your Dashboard &rarr;
      </a>
    </p>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #F1F5F9;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #0F172A;">💡 Quick 3-Step Start:</h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.7; color: #475569;">
        <li>Go to <strong>GST Profiles</strong> and add your client's GSTIN.</li>
        <li>Upload your marketplace sales reports in <strong>Convert</strong>.</li>
        <li>Click <strong>Generate GSTR-1</strong> to instantly download ready-to-upload JSON & Excel.</li>
      </ol>
    </div>
  `;

  const footerNote = `
    Have questions or need help onboarding your team? Reach out to us directly at <strong>gstpilot.official@gmail.com</strong>.
  `;

  const html = renderBaseEmailHtml({
    previewText: `Your ${trialDays}-Day Free Trial with ${gstinLimit} GSTIN capacity is ready to use!`,
    headline: "Welcome to GSTPilot 🚀",
    contentHtml,
    footerNote,
  });

  const text = `${greeting}\n\nYour ${trialDays}-Day Free Trial on GSTPilot is now active!\n\nIncluded:\n- ${gstinLimit} GSTIN capacity\n- Unlimited GSTR-1 generation\n- Amazon, Flipkart, Meesho, Myntra & JioMart parsers\n\nOpen your dashboard: ${dashboardUrl}\n\nSupport: gstpilot.official@gmail.com`;

  return { subject, html, text };
}

export function renderPaymentReceiptEmailHtml(params: {
  name?: string;
  orderId: string;
  paymentId: string;
  amountRupees: number;
  planName: string;
  gstinSlots?: number;
  date: string;
  billingUrl: string;
}): { subject: string; html: string; text: string } {
  const {
    name,
    orderId,
    paymentId,
    amountRupees,
    planName,
    gstinSlots,
    date,
    billingUrl,
  } = params;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const subject = `Payment Receipt: ₹${amountRupees} for ${planName} - GSTPilot`;

  const contentHtml = `
    <p style="margin-top: 0;">${greeting}</p>
    <p>
      Thank you for your payment. Your subscription to <strong>${planName}</strong> is active and your account capacity has been updated.
    </p>

    <!-- Receipt Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E2E8F0; border-radius: 12px; margin: 20px 0; overflow: hidden; font-size: 13px;">
      <tr style="background-color: #F8FAFC;">
        <td style="padding: 12px 16px; font-weight: 700; color: #475569; border-bottom: 1px solid #E2E8F0;">Description</td>
        <td style="padding: 12px 16px; font-weight: 700; color: #475569; text-align: right; border-bottom: 1px solid #E2E8F0;">Details</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #0F172A; font-weight: 600; border-bottom: 1px solid #F1F5F9;">Plan / Item</td>
        <td style="padding: 12px 16px; color: #0F172A; text-align: right; border-bottom: 1px solid #F1F5F9;">${planName}</td>
      </tr>
      ${
        gstinSlots
          ? `<tr>
        <td style="padding: 12px 16px; color: #0F172A; border-bottom: 1px solid #F1F5F9;">GSTIN Capacity</td>
        <td style="padding: 12px 16px; color: #0F172A; text-align: right; border-bottom: 1px solid #F1F5F9;">${gstinSlots} GSTINs Included</td>
      </tr>`
          : ""
      }
      <tr>
        <td style="padding: 12px 16px; color: #64748B; border-bottom: 1px solid #F1F5F9;">Payment ID</td>
        <td style="padding: 12px 16px; color: #64748B; font-family: monospace; text-align: right; border-bottom: 1px solid #F1F5F9;">${paymentId}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #64748B; border-bottom: 1px solid #F1F5F9;">Order Reference</td>
        <td style="padding: 12px 16px; color: #64748B; font-family: monospace; text-align: right; border-bottom: 1px solid #F1F5F9;">${orderId}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #64748B; border-bottom: 1px solid #F1F5F9;">Date & Time</td>
        <td style="padding: 12px 16px; color: #64748B; text-align: right; border-bottom: 1px solid #F1F5F9;">${date}</td>
      </tr>
      <tr style="background-color: #F8FAFC;">
        <td style="padding: 14px 16px; font-weight: 800; font-size: 15px; color: #0F172A;">Total Paid</td>
        <td style="padding: 14px 16px; font-weight: 800; font-size: 16px; color: #16A34A; text-align: right;">₹${amountRupees}</td>
      </tr>
    </table>

    <p style="text-align: center; margin: 24px 0 12px 0;">
      <a href="${billingUrl}" class="btn">
        Manage Subscription & Invoices &rarr;
      </a>
    </p>
  `;

  const footerNote = `
    This serves as an official electronic confirmation of your payment. For tax invoices or billing inquiries, email <strong>gstpilot.official@gmail.com</strong>.
  `;

  const html = renderBaseEmailHtml({
    previewText: `Payment confirmed: ₹${amountRupees} for ${planName}.`,
    headline: "Payment Received — Thank You!",
    contentHtml,
    footerNote,
  });

  const text = `${greeting}\n\nPayment confirmed: ₹${amountRupees} for ${planName}.\nPayment ID: ${paymentId}\nOrder: ${orderId}\nDate: ${date}\n\nManage your billing: ${billingUrl}\n\nThank you for choosing GSTPilot!`;

  return { subject, html, text };
}

export function renderCampaignBroadcastEmailHtml(params: {
  name?: string;
  headline: string;
  bodyText: string;
  ctaText?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const { name, headline, bodyText, ctaText, ctaUrl, unsubscribeUrl } = params;
  const greeting = name ? `Hello ${name},` : "Hello,";

  // Convert plain text newlines to formatted paragraphs
  const formattedBody = bodyText
    .split("\n\n")
    .map((p) => `<p style="margin-bottom: 14px;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const contentHtml = `
    <p style="margin-top: 0;">${greeting}</p>
    ${formattedBody}

    ${
      ctaText && ctaUrl
        ? `<p style="text-align: center; margin: 28px 0 16px 0;">
          <a href="${ctaUrl}" class="btn">
            ${ctaText} &rarr;
          </a>
        </p>`
        : ""
    }
  `;

  const html = renderBaseEmailHtml({
    previewText: headline,
    headline,
    contentHtml,
    showUnsubscribe: true,
    unsubscribeUrl,
  });

  const text = `${greeting}\n\n${headline}\n\n${bodyText}\n\n${ctaUrl ? `${ctaText}: ${ctaUrl}` : ""}`;

  return { html, text };
}
