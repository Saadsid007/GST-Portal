import { renderBaseEmailHtml } from "@/features/email/templates/base-email.template";

/**
 * Support conversation by email.
 *
 * Every ticket message used to stay inside the app: a person who wrote in
 * through the contact form — who may have no account to sign in to — never
 * heard back unless an admin wrote to them by hand. Each step of a ticket now
 * mails the other side, quoting the message, with the ticket reference in the
 * subject so the thread stays together in any inbox.
 */

type Rendered = { subject: string; html: string; text: string };

/** Ticket text is the sender's own words; it must never become markup. */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function quote(body: string): string {
  return `<div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin:16px 0;font-size:13px;line-height:1.7;color:#334155;white-space:pre-wrap;">${escape(body)}</div>`;
}

function button(url: string, label: string): string {
  return `<p style="text-align:center;margin:24px 0 8px 0;"><a href="${url}" class="btn">${label} &rarr;</a></p>`;
}

/** To the person who raised it: we have it, here is your reference. */
export function renderTicketReceivedEmail(params: {
  name: string;
  reference: string;
  subject: string;
  message: string;
  ticketUrl: string | null;
}): Rendered {
  const { name, reference, subject, message, ticketUrl } = params;
  const contentHtml = `
    <p style="margin-top:0;">Hi ${escape(name)},</p>
    <p>We have your request and will reply within one working day. Your reference is <strong>${reference}</strong>.</p>
    <p style="margin-bottom:0;"><strong>${escape(subject)}</strong></p>
    ${quote(message)}
    ${ticketUrl ? button(ticketUrl, "View your request") : ""}
    <p style="font-size:12px;color:#64748B;">You can reply to this email to add anything — it reaches our support team.</p>
  `;
  return {
    subject: `[${reference}] We received your request: ${subject}`,
    html: renderBaseEmailHtml({
      previewText: `Reference ${reference} — we will reply within one working day.`,
      headline: "We got your message",
      contentHtml,
    }),
    text: `Hi ${name},\n\nWe have your request (${reference}) and will reply within one working day.\n\n${subject}\n\n${message}\n\n${ticketUrl ? `View it: ${ticketUrl}\n\n` : ""}Reply to this email to add anything.`,
  };
}

/** To the support inbox: a new ticket, with who sent it and how to answer. */
export function renderTicketForTeamEmail(params: {
  reference: string;
  name: string;
  email: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  adminUrl: string;
  isReply?: boolean;
}): Rendered {
  const { reference, name, email, category, priority, subject, message, adminUrl, isReply } =
    params;
  const contentHtml = `
    <p style="margin-top:0;"><strong>${escape(name)}</strong> &lt;${escape(email)}&gt; ${
      isReply ? "replied on" : "opened"
    } <strong>${reference}</strong>.</p>
    <p style="font-size:12px;color:#64748B;">Category: ${escape(category)} · Priority: ${escape(priority)}</p>
    <p style="margin-bottom:0;"><strong>${escape(subject)}</strong></p>
    ${quote(message)}
    ${button(adminUrl, "Open in the support inbox")}
    <p style="font-size:12px;color:#64748B;">Reply from the inbox so the answer is recorded on the ticket and emailed to them.</p>
  `;
  return {
    subject: `[${reference}] ${isReply ? "Reply" : "New"}${priority === "HIGH" || priority === "URGENT" ? ` (${priority})` : ""}: ${subject}`,
    html: renderBaseEmailHtml({
      previewText: `${name}: ${message.slice(0, 90)}`,
      headline: isReply ? "Customer replied" : "New support request",
      contentHtml,
    }),
    text: `${name} <${email}> ${isReply ? "replied on" : "opened"} ${reference} (${category}, ${priority}).\n\n${subject}\n\n${message}\n\nOpen: ${adminUrl}`,
  };
}

/** To the customer: the team's answer. */
export function renderTeamReplyEmail(params: {
  name: string;
  reference: string;
  subject: string;
  reply: string;
  authorName: string;
  ticketUrl: string | null;
}): Rendered {
  const { name, reference, subject, reply, authorName, ticketUrl } = params;
  const contentHtml = `
    <p style="margin-top:0;">Hi ${escape(name)},</p>
    <p>${escape(authorName)} from the GSTPilot team replied to your request <strong>${reference}</strong> — <em>${escape(subject)}</em>:</p>
    ${quote(reply)}
    ${ticketUrl ? button(ticketUrl, "Reply in GSTPilot") : ""}
    <p style="font-size:12px;color:#64748B;">Or simply reply to this email.</p>
  `;
  return {
    subject: `Re: [${reference}] ${subject}`,
    html: renderBaseEmailHtml({
      previewText: reply.slice(0, 120),
      headline: "We replied to your request",
      contentHtml,
    }),
    text: `Hi ${name},\n\n${authorName} from GSTPilot replied to ${reference} (${subject}):\n\n${reply}\n\n${ticketUrl ? `Reply in GSTPilot: ${ticketUrl}\n\n` : ""}Or reply to this email.`,
  };
}

/** To the customer: the ticket is marked resolved or closed. */
export function renderTicketResolvedEmail(params: {
  name: string;
  reference: string;
  subject: string;
  closed: boolean;
  ticketUrl: string | null;
}): Rendered {
  const { name, reference, subject, closed, ticketUrl } = params;
  const contentHtml = `
    <p style="margin-top:0;">Hi ${escape(name)},</p>
    <p>Your request <strong>${reference}</strong> — <em>${escape(subject)}</em> — is now marked <strong>${closed ? "closed" : "resolved"}</strong>.</p>
    <p>${closed ? "If you need anything else, raise a new request any time." : "If something is still not right, reply to this email and we will reopen it."}</p>
    ${ticketUrl ? button(ticketUrl, "View the request") : ""}
  `;
  return {
    subject: `[${reference}] ${closed ? "Closed" : "Resolved"}: ${subject}`,
    html: renderBaseEmailHtml({
      previewText: `${reference} is ${closed ? "closed" : "resolved"}.`,
      headline: closed ? "Request closed" : "Request resolved",
      contentHtml,
    }),
    text: `Hi ${name},\n\nYour request ${reference} (${subject}) is now ${closed ? "closed" : "resolved"}.\n\n${ticketUrl ? `View it: ${ticketUrl}` : ""}`,
  };
}
