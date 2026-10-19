import { after } from "next/server";
import { SITE } from "@/config/site";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { EmailService } from "@/features/email/services/email.service";
import {
  renderTeamReplyEmail,
  renderTicketForTeamEmail,
  renderTicketReceivedEmail,
  renderTicketResolvedEmail,
} from "@/features/email/templates/support-emails.template";

const log = createLogger({ module: "support-notifications" });

export interface TicketForMail {
  id: string;
  reference: string;
  subject: string;
  name: string;
  email: string;
  userId: string | null;
  category: string;
  priority: string;
}

function base(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

/** Only an account holder can open the ticket page; a contact-form sender gets mail only. */
function ticketUrl(ticket: TicketForMail): string | null {
  return ticket.userId ? `${base()}/support/${ticket.id}` : null;
}

function adminUrl(ticket: TicketForMail): string {
  return `${base()}/admin/support/${ticket.id}`;
}

/**
 * Sent after the response, never awaited by it: SMTP takes seconds, and a
 * mail server being down must not fail the reply that was already saved.
 */
function dispatch(label: string, send: () => Promise<{ success: boolean; error?: string }>) {
  after(async () => {
    const res = await send();
    if (!res.success) log.error({ label, error: res.error }, "Support email failed");
  });
}

export function notifyTicketCreated(ticket: TicketForMail, message: string): void {
  const toUser = renderTicketReceivedEmail({
    name: ticket.name,
    reference: ticket.reference,
    subject: ticket.subject,
    message,
    ticketUrl: ticketUrl(ticket),
  });
  dispatch("ticket-received", () =>
    EmailService.sendMail({ to: ticket.email, ...toUser, replyTo: SITE.supportEmail })
  );

  const toTeam = renderTicketForTeamEmail({
    reference: ticket.reference,
    name: ticket.name,
    email: ticket.email,
    category: ticket.category,
    priority: ticket.priority,
    subject: ticket.subject,
    message,
    adminUrl: adminUrl(ticket),
  });
  // Reply-To the customer, so answering from the inbox reaches them directly.
  dispatch("ticket-team", () =>
    EmailService.sendMail({ to: SITE.supportEmail, ...toTeam, replyTo: ticket.email })
  );
}

export function notifyUserReplied(ticket: TicketForMail, body: string): void {
  const mail = renderTicketForTeamEmail({
    reference: ticket.reference,
    name: ticket.name,
    email: ticket.email,
    category: ticket.category,
    priority: ticket.priority,
    subject: ticket.subject,
    message: body,
    adminUrl: adminUrl(ticket),
    isReply: true,
  });
  dispatch("user-reply", () =>
    EmailService.sendMail({ to: SITE.supportEmail, ...mail, replyTo: ticket.email })
  );
}

export function notifyTeamReplied(ticket: TicketForMail, body: string, authorName: string): void {
  const mail = renderTeamReplyEmail({
    name: ticket.name,
    reference: ticket.reference,
    subject: ticket.subject,
    reply: body,
    authorName,
    ticketUrl: ticketUrl(ticket),
  });
  dispatch("team-reply", () =>
    EmailService.sendMail({ to: ticket.email, ...mail, replyTo: SITE.supportEmail })
  );
}

export function notifyTicketResolved(ticket: TicketForMail, closed: boolean): void {
  const mail = renderTicketResolvedEmail({
    name: ticket.name,
    reference: ticket.reference,
    subject: ticket.subject,
    closed,
    ticketUrl: ticketUrl(ticket),
  });
  dispatch("ticket-resolved", () =>
    EmailService.sendMail({ to: ticket.email, ...mail, replyTo: SITE.supportEmail })
  );
}
