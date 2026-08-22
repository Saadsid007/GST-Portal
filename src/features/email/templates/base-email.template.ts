/**
 * Base Responsive HTML Email Template for GSTPilot
 * Engineered for maximum deliverability and compatibility with Gmail, Apple Mail, Outlook & Mobile.
 */

import { SITE } from "@/config/site";

export interface BaseEmailProps {
  previewText?: string;
  headline: string;
  contentHtml: string;
  footerNote?: string;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

export function renderBaseEmailHtml({
  previewText,
  headline,
  contentHtml,
  footerNote,
  showUnsubscribe,
  unsubscribeUrl,
}: BaseEmailProps): string {
  const currentYear = new Date().getFullYear();
  const supportEmail = SITE.supportEmail || "gstpilot.official@gmail.com";

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #0B1120;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
    }
    table, td {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      color: #FFFFFF !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 28px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
    }
    .otp-badge {
      display: inline-block;
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0F172A;
      background-color: #F1F5F9;
      border: 2px dashed #94A3B8;
      padding: 16px 24px;
      border-radius: 12px;
      margin: 16px 0;
      text-align: center;
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 16px !important;
      }
      .content-box {
        padding: 24px 20px !important;
      }
      .otp-badge {
        font-size: 26px !important;
        letter-spacing: 6px !important;
        padding: 12px 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0B1120;">
  ${previewText ? `<div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">${previewText}</div>` : ""}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B1120; min-height: 100vh; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px; margin: 0 auto;">
          
          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #FFFFFF;">
                      GST<span style="color: #38BDF8;">Pilot</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8; margin-top: 4px;">
                      E-Commerce GST Compliance Platform
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="content-box" style="background-color: #FFFFFF; border-radius: 24px; padding: 40px 36px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);">
                
                <!-- Headline -->
                <tr>
                  <td style="padding-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0F172A; line-height: 1.3;">
                      ${headline}
                    </h1>
                  </td>
                </tr>

                <!-- Body HTML -->
                <tr>
                  <td style="font-size: 14px; line-height: 1.6; color: #334155;">
                    ${contentHtml}
                  </td>
                </tr>

                <!-- Optional Divider & Footer Note -->
                ${
                  footerNote
                    ? `
                <tr>
                  <td style="padding-top: 24px; border-top: 1px solid #E2E8F0; margin-top: 24px; font-size: 12px; line-height: 1.5; color: #64748B;">
                    ${footerNote}
                  </td>
                </tr>`
                    : ""
                }
              </table>
            </td>
          </tr>

          <!-- Email Footer -->
          <tr>
            <td align="center" style="padding-top: 32px; padding-bottom: 24px; font-size: 12px; line-height: 1.6; color: #64748B;">
              <p style="margin: 0 0 8px 0; color: #94A3B8;">
                This email was sent securely by <strong>GSTPilot</strong>.
              </p>
              <p style="margin: 0 0 8px 0;">
                Need help? Reply to this email or contact <a href="mailto:${supportEmail}" style="color: #38BDF8; text-decoration: none; font-weight: 600;">${supportEmail}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748B;">
                &copy; ${currentYear} GSTPilot Technologies India. All rights reserved.
                ${
                  showUnsubscribe && unsubscribeUrl
                    ? ` &bull; <a href="${unsubscribeUrl}" style="color: #94A3B8; text-decoration: underline;">Unsubscribe</a>`
                    : ""
                }
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
