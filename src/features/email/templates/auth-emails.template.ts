/**
 * Authentication Email Templates (Verification, Password Reset, Security Alerts)
 * Designed with high security, clean OTP presentation, and anti-phishing advisories.
 */

import { renderBaseEmailHtml } from "./base-email.template";

export function renderVerificationEmailHtml(params: {
  name?: string;
  otp: string;
  verifyUrl: string;
  expiryMinutes?: number;
}): { subject: string; html: string; text: string } {
  const { name, otp, verifyUrl, expiryMinutes = 15 } = params;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const subject = `Your GSTPilot Verification Code: ${otp}`;

  const contentHtml = `
    <p style="margin-top: 0;">${greeting}</p>
    <p>
      Thank you for registering on <strong>GSTPilot</strong>. To verify your email address and activate your account, please enter the 6-digit verification code below:
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <div class="otp-badge">${otp}</div>
      <p style="font-size: 12px; color: #64748B; margin-top: 6px;">
        This code is valid for <strong>${expiryMinutes} minutes</strong>. Do not share this code with anyone.
      </p>
    </div>

    <p style="text-align: center; margin: 28px 0 16px 0;">
      <a href="${verifyUrl}" class="btn">
        Verify Email Address &rarr;
      </a>
    </p>

    <p style="font-size: 12px; color: #64748B; margin-top: 24px;">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${verifyUrl}" style="color: #2563EB; word-break: break-all;">${verifyUrl}</a>
    </p>
  `;

  const footerNote = `
    <strong>Security Notice:</strong> If you did not create a GSTPilot account, you can safely ignore this email. No changes will be made without verifying this code.
  `;

  const html = renderBaseEmailHtml({
    previewText: `Your verification code is ${otp}. Complete your registration on GSTPilot.`,
    headline: "Verify Your Email Address",
    contentHtml,
    footerNote,
  });

  const text = `${greeting}\n\nYour GSTPilot verification code is: ${otp}\n\nValid for ${expiryMinutes} minutes.\n\nOr verify directly at: ${verifyUrl}\n\nIf you did not request this, please ignore this email.`;

  return { subject, html, text };
}

export function renderPasswordResetEmailHtml(params: {
  name?: string;
  otp: string;
  resetUrl: string;
  expiryMinutes?: number;
}): { subject: string; html: string; text: string } {
  const { name, otp, resetUrl, expiryMinutes = 15 } = params;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const subject = "Reset your GSTPilot account password";

  const contentHtml = `
    <p style="margin-top: 0;">${greeting}</p>
    <p>
      We received a request to reset the password for your GSTPilot account. You can reset your password using the secure button below or by entering your verification code:
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <div class="otp-badge">${otp}</div>
      <p style="font-size: 12px; color: #64748B; margin-top: 6px;">
        This code expires in <strong>${expiryMinutes} minutes</strong>.
      </p>
    </div>

    <p style="text-align: center; margin: 28px 0 16px 0;">
      <a href="${resetUrl}" class="btn">
        Set New Password &rarr;
      </a>
    </p>

    <p style="font-size: 12px; color: #64748B; margin-top: 24px;">
      Direct link:<br>
      <a href="${resetUrl}" style="color: #2563EB; word-break: break-all;">${resetUrl}</a>
    </p>
  `;

  const footerNote = `
    <strong>Security Warning:</strong> If you did not request a password reset, please change your password immediately or contact our support team at gstpilot.official@gmail.com.
  `;

  const html = renderBaseEmailHtml({
    previewText: "Password reset request for your GSTPilot account.",
    headline: "Password Reset Request",
    contentHtml,
    footerNote,
  });

  const text = `${greeting}\n\nReset your password with verification code: ${otp}\n\nOr click: ${resetUrl}\n\nExpires in ${expiryMinutes} minutes.\n\nIf you did not request this, please secure your account.`;

  return { subject, html, text };
}

export function renderPasswordChangedEmailHtml(params: {
  name?: string;
  time: string;
}): { subject: string; html: string; text: string } {
  const { name, time } = params;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const subject = "Security Alert: Your GSTPilot password was changed";

  const contentHtml = `
    <p style="margin-top: 0;">${greeting}</p>
    <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 14px 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0; font-weight: 700; color: #065F46;">
        Your GSTPilot password was successfully updated on ${time}.
      </p>
    </div>
    <p>
      You can now log in to your GSTPilot dashboard using your new credentials.
    </p>
    <p style="font-size: 13px; color: #475569;">
      If you performed this action, no further steps are needed.
    </p>
  `;

  const footerNote = `
    <strong>Unauthorized action?</strong> If you did NOT change your password, someone may have compromised your account. Please contact us immediately at <strong>gstpilot.official@gmail.com</strong>.
  `;

  const html = renderBaseEmailHtml({
    previewText: "Your GSTPilot account password was successfully updated.",
    headline: "Password Changed Successfully",
    contentHtml,
    footerNote,
  });

  const text = `${greeting}\n\nYour GSTPilot account password was updated on ${time}.\n\nIf you did not make this change, please contact support immediately at gstpilot.official@gmail.com.`;

  return { subject, html, text };
}
