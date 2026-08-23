/**
 * Production-Grade Transactional Email Service for GSTPilot
 * Supports Gmail SMTP (gstpilot.official@gmail.com), custom SMTP, Resend, and dev console fallback.
 *
 * SECURITY GUARANTEE:
 * - All OTP generation, hashing, and token validation occur strictly server-side.
 * - OTPs are hashed using SHA-256 before storing in the database.
 * - OTPs and sensitive tokens are NEVER leaked to client sessions or API responses.
 */

import nodemailer from "nodemailer";
import crypto from "crypto";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import prisma from "@/lib/prisma";
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

const emailLogger = createLogger({ module: "email-service" });

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Overrides the default reply address for this message. */
  replyTo?: string;
  /** Set on bulk mail so Gmail/Yahoo one-click unsubscribe headers are emitted. */
  unsubscribeUrl?: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Get or initialize the nodemailer transporter.
   */
  private static getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    // Check if SMTP configuration is provided
    const host =
      env.SMTP_HOST || (env.SMTP_USER?.includes("gmail.com") ? "smtp.gmail.com" : undefined);
    const user = env.SMTP_USER || (env.SMTP_PASS ? "gstpilot.official@gmail.com" : undefined);
    const pass = env.SMTP_PASS;
    const port = env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 465;
    const secure = env.SMTP_SECURE === "true" || port === 465;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        // Bounded failure: without these a silently-dropped SMTP session (common
        // on hotspot/CGNAT networks) parks every awaiting request indefinitely.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      });
      emailLogger.info({ host, user, port }, "Nodemailer SMTP transporter initialized");
      return this.transporter;
    }

    return null;
  }

  /**
   * Dispatch an email message with fallback to styled developer console logging.
   */
  public static async sendMail(
    options: SendMailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { to, subject, html, text } = options;
    const from = env.EMAIL_FROM || "GSTPilot <gstpilot.official@gmail.com>";

    const headers: Record<string, string> = {};
    if (options.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${options.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Visible-Click";
      headers["List-Id"] = "GSTPilot Announcements <announcements.gstpilot>";
    }

    try {
      // Preferred path when configured: a transactional provider (Resend) over
      // its API — dedicated infrastructure with per-domain SPF/DKIM signing,
      // which is what keeps mail out of spam. Gmail SMTP relay cannot offer
      // that for a custom From domain.
      if (env.RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM || "GSTPilot <onboarding@resend.dev>",
            to: [to],
            subject,
            html,
            text: text || subject,
            reply_to: options.replyTo,
            headers,
          }),
        });

        const data = (await res.json().catch(() => null)) as {
          id?: string;
          message?: string;
        } | null;
        if (!res.ok || !data?.id) {
          const errorMsg = data?.message || `Resend responded ${res.status}`;
          emailLogger.error({ to, subject, error: errorMsg }, "Resend dispatch failed");
          return { success: false, error: errorMsg };
        }

        emailLogger.info(
          { to, subject, messageId: data.id },
          "Email dispatched successfully via Resend"
        );
        return { success: true, messageId: data.id };
      }

      const transporter = this.getTransporter();

      if (transporter) {
        const info = await transporter.sendMail({
          from,
          to,
          subject,
          html,
          text: text || subject,
          ...(options.replyTo ? { replyTo: options.replyTo } : {}),
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        });

        emailLogger.info(
          { to, subject, messageId: info.messageId },
          "Email dispatched successfully via SMTP"
        );
        return { success: true, messageId: info.messageId };
      }

      // Safe Development Fallback: Log email details cleanly without crashing
      emailLogger.info(
        {
          to,
          subject,
          note: "SMTP credentials not provided in .env (Set SMTP_PASS to send live emails). Email logged in dev mode.",
        },
        "📧 [DEV EMAIL DISPATCH]"
      );

      return { success: true, messageId: `dev-${Date.now()}` };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send email";
      emailLogger.error({ to, subject, error: errorMsg }, "Failed to send email");
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generate a cryptographically secure 6-digit OTP code and hashed database entry.
   */
  public static async generateOtp(
    identifier: string,
    purpose: string,
    expiryMinutes = 15
  ): Promise<string> {
    // Cryptographically secure 6-digit numeric OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto
      .createHash("sha256")
      .update(`${rawOtp}:${purpose}:${identifier}`)
      .digest("hex");
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const fullIdentifier = `${purpose}:${identifier.toLowerCase().trim()}`;

    // Upsert or store in verification table
    await prisma.verification.deleteMany({
      where: { identifier: fullIdentifier },
    });

    await prisma.verification.create({
      data: {
        id: crypto.randomUUID(),
        identifier: fullIdentifier,
        value: hashedOtp,
        expiresAt,
      },
    });

    return rawOtp;
  }

  /**
   * Verify an OTP code strictly server-side against SHA-256 hash.
   */
  public static async verifyOtp(
    identifier: string,
    purpose: string,
    submittedOtp: string
  ): Promise<boolean> {
    if (!submittedOtp || submittedOtp.trim().length !== 6) return false;

    const fullIdentifier = `${purpose}:${identifier.toLowerCase().trim()}`;
    const record = await prisma.verification.findFirst({
      where: {
        identifier: fullIdentifier,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) return false;

    const expectedHash = crypto
      .createHash("sha256")
      .update(`${submittedOtp.trim()}:${purpose}:${identifier}`)
      .digest("hex");

    if (crypto.timingSafeEqual(Buffer.from(record.value), Buffer.from(expectedHash))) {
      // Consume OTP immediately so it cannot be re-used
      await prisma.verification.delete({ where: { id: record.id } });
      return true;
    }

    return false;
  }

  /**
   * Send Email Verification OTP + Link to user.
   */
  public static async sendVerificationEmail(params: {
    to: string;
    name?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { to, name } = params;
    const otp = await this.generateOtp(to, "EMAIL_VERIFICATION", 15);
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    const verifyUrl = `${baseUrl}/verify-email?email=${encodeURIComponent(to)}`;

    const { subject, html, text } = renderVerificationEmailHtml({
      name,
      otp,
      verifyUrl,
      expiryMinutes: 15,
    });

    return this.sendMail({ to, subject, html, text });
  }

  /**
   * Send Password Reset OTP + Link to user.
   */
  public static async sendPasswordResetEmail(params: {
    to: string;
    name?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { to, name } = params;
    const otp = await this.generateOtp(to, "PASSWORD_RESET", 15);
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    const resetUrl = `${baseUrl}/reset-password?email=${encodeURIComponent(to)}`;

    const { subject, html, text } = renderPasswordResetEmailHtml({
      name,
      otp,
      resetUrl,
      expiryMinutes: 15,
    });

    return this.sendMail({ to, subject, html, text });
  }

  /**
   * Send security confirmation when password is changed.
   */
  public static async sendPasswordChangedNotification(params: {
    to: string;
    name?: string;
  }): Promise<{ success: boolean }> {
    const { to, name } = params;
    const time = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const { subject, html, text } = renderPasswordChangedEmailHtml({ name, time });
    await this.sendMail({ to, subject, html, text });
    return { success: true };
  }

  /**
   * Send Welcome & 30-Day Free Trial confirmation email.
   */
  public static async sendWelcomeTrialEmail(params: {
    to: string;
    name?: string;
  }): Promise<{ success: boolean }> {
    const { to, name } = params;
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    const dashboardUrl = `${baseUrl}/dashboard`;

    const { subject, html, text } = renderWelcomeTrialEmailHtml({
      name,
      trialDays: 30,
      gstinLimit: 7,
      dashboardUrl,
    });

    await this.sendMail({ to, subject, html, text });
    return { success: true };
  }

  /**
   * Send Payment & Invoice Receipt email.
   */
  public static async sendPaymentReceiptEmail(params: {
    to: string;
    name?: string;
    orderId: string;
    paymentId: string;
    amountRupees: number;
    planName: string;
    gstinSlots?: number;
  }): Promise<{ success: boolean }> {
    const { to, name, orderId, paymentId, amountRupees, planName, gstinSlots } = params;
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    const billingUrl = `${baseUrl}/billing`;
    const date = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const { subject, html, text } = renderPaymentReceiptEmailHtml({
      name,
      orderId,
      paymentId,
      amountRupees,
      planName,
      gstinSlots,
      date,
      billingUrl,
    });

    await this.sendMail({ to, subject, html, text });
    return { success: true };
  }

  /**
   * Send Admin Marketing / Announcement Broadcast to a subscriber.
   */
  public static async sendCampaignBroadcastEmail(params: {
    to: string;
    name?: string;
    subject: string;
    headline: string;
    bodyText: string;
    ctaText?: string;
    ctaUrl?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { to, name, subject, headline, bodyText, ctaText, ctaUrl } = params;
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(to)}`;

    const { html, text } = renderCampaignBroadcastEmailHtml({
      name,
      headline,
      bodyText,
      ctaText,
      ctaUrl,
      unsubscribeUrl,
    });

    return this.sendMail({ to, subject, html, text, unsubscribeUrl });
  }
}
