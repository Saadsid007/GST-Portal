/**
 * Base Responsive HTML Email Template for GSTPilot
 * Engineered with bulletproof HTML table architecture for 100% flawless rendering
 * across Gmail (Web & App), Apple Mail, Outlook, and mobile screens.
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

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${headline}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #F1F5F9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td {
      border-collapse: collapse;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    .btn {
      display: inline-block;
      background-color: #0F172A;
      color: #FFFFFF !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 10px;
      text-align: center;
    }
    .otp-badge {
      display: inline-block;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #0F172A;
      background-color: #F8FAFC;
      border: 2px dashed #94A3B8;
      padding: 14px 20px;
      border-radius: 10px;
      text-align: center;
    }
    @media only screen and (max-width: 600px) {
      .main-card {
        width: 100% !important;
        border-radius: 0px !important;
        border-left: none !important;
        border-right: none !important;
      }
      .card-body {
        padding: 24px 18px !important;
      }
      .otp-badge {
        font-size: 24px !important;
        letter-spacing: 4px !important;
        padding: 10px 14px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  ${previewText ? `<div style="display: none; font-size: 1px; color: #F1F5F9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">${previewText}</div>` : ""}

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F1F5F9; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 12px 48px 12px;">
        
        <!-- Center Column (Max 580px) -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; width: 100%;">
          
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #0F172A;">
                      GST<span style="color: #2563EB;">Pilot</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #64748B; margin-top: 2px;">
                      E-Commerce GST Compliance Platform
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main White Card -->
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" class="main-card" style="background-color: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td class="card-body" style="padding: 36px 32px; text-align: left;">
                    
                    <!-- Headline -->
                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0F172A; line-height: 1.3;">
                      ${headline}
                    </h1>

                    <!-- Body Content -->
                    <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                      ${contentHtml}
                    </div>

                    <!-- Footer Note -->
                    ${
                      footerNote
                        ? `<div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #E2E8F0; font-size: 12px; line-height: 1.5; color: #64748B;">
                          ${footerNote}
                        </div>`
                        : ""
                    }

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Outer Footer Links & Branding -->
          <tr>
            <td align="center" style="padding-top: 28px; font-size: 12px; line-height: 1.6; color: #64748B;">
              <p style="margin: 0 0 6px 0; color: #64748B;">
                Sent with security by <strong>GSTPilot</strong> &bull; Need assistance? Contact <a href="mailto:${supportEmail}" style="color: #2563EB; text-decoration: none; font-weight: 600;">${supportEmail}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                &copy; ${currentYear} GSTPilot Technologies India. All rights reserved.
                ${
                  showUnsubscribe && unsubscribeUrl
                    ? ` &bull; <a href="${unsubscribeUrl}" style="color: #64748B; text-decoration: underline;">Unsubscribe</a>`
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
