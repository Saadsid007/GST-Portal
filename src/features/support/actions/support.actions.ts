"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession, requireAdmin, requireSession } from "@/features/auth";
import { createLogger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/features/support/domain/support.constants";
import { createTicket } from "@/features/support/services/support.service";

const log = createLogger({ module: "support" });

export interface ActionResult<T = null> {
  success: boolean;
  error?: string;
  data?: T;
}

const baseFields = {
  subject: z.string().trim().min(4, "Add a short subject").max(150),
  message: z.string().trim().min(15, "Tell us a little more so we can help").max(4000),
  category: z.enum(TICKET_CATEGORIES),
};

const contactSchema = z.object({
  ...baseFields,
  name: z.string().trim().min(2, "Your name is required").max(100),
  email: z.email("Enter a valid email address").max(200),
  /** Honeypot: a real person never fills a hidden field. */
  company: z.string().max(0).optional(),
});

const supportSchema = z.object({
  ...baseFields,
  referenceId: z.string().trim().max(120).optional().or(z.literal("")),
});

export type ContactInput = z.input<typeof contactSchema>;
export type SupportInput = z.input<typeof supportSchema>;

/**
 * Public contact form. Unauthenticated by design, so it carries a honeypot and
 * hard length caps. If a session happens to exist the ticket is linked to it,
 * which means a signed-in visitor can still track it from the panel.
 */
export async function submitContactAction(
  input: ContactInput
): Promise<ActionResult<{ reference: string }>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }
  if (parsed.data.company) {
    // Silently accept so a bot cannot tell it was rejected.
    log.warn("Contact honeypot triggered");
    return { success: true, data: { reference: "GP-000000" } };
  }

  const session = await getServerSession();

  try {
    const ticket = await createTicket({
      source: "CONTACT",
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
      name: parsed.data.name,
      email: parsed.data.email,
      userId: session?.user.id ?? null,
    });
    return { success: true, data: { reference: ticket.reference } };
  } catch (error) {
    log.error({ err: error }, "Could not create contact ticket");
    return { success: false, error: "Could not send your message. Please try again." };
  }
}

/** In-app support request from a signed-in user. */
export async function submitSupportRequestAction(
  input: SupportInput
): Promise<ActionResult<{ reference: string }>> {
  const session = await requireSession();
  const parsed = supportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form" };
  }

  try {
    const ticket = await createTicket({
      source: "SUPPORT",
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
      name: session.user.name,
      email: session.user.email,
      userId: session.user.id,
      referenceId: parsed.data.referenceId || null,
      // Money problems get bumped: someone who paid and got nothing should not
      // sit behind a feature question.
      priority: parsed.data.category === "PAYMENT" ? "HIGH" : "NORMAL",
    });
    revalidatePath("/support");
    return { success: true, data: { reference: ticket.reference } };
  } catch (error) {
    log.error({ err: error }, "Could not create support ticket");
    return { success: false, error: "Could not raise your request. Please try again." };
  }
}

const replySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(2, "Write a reply").max(4000),
});

/** User replying on their own ticket. */
export async function replyToTicketAction(
  input: z.input<typeof replySchema>
): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid reply" };
  }

  // Ownership is part of the query, so someone else's ticket id finds nothing.
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: parsed.data.ticketId, userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!ticket) return { success: false, error: "Ticket not found" };
  if (ticket.status === "CLOSED") {
    return { success: false, error: "This ticket is closed. Raise a new request instead." };
  }

  await prisma.$transaction([
    prisma.supportTicketReply.create({
      data: {
        ticketId: ticket.id,
        body: parsed.data.body,
        isFromAdmin: false,
        authorName: session.user.name,
      },
    }),
    // A user reply moves it back into the queue — otherwise answering a
    // "waiting on you" ticket leaves it looking handled.
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: ticket.status === "WAITING_ON_USER" ? "IN_PROGRESS" : ticket.status },
    }),
  ]);

  revalidatePath(`/support/${ticket.id}`);
  return { success: true };
}

/* ── Admin ──────────────────────────────────────────────────────────────── */

const adminReplySchema = replySchema.extend({ isInternal: z.boolean().default(false) });

export async function adminReplyAction(
  input: z.input<typeof adminReplySchema>
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adminReplySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid reply" };
  }

  await prisma.$transaction([
    prisma.supportTicketReply.create({
      data: {
        ticketId: parsed.data.ticketId,
        body: parsed.data.body,
        isFromAdmin: true,
        isInternal: parsed.data.isInternal,
        authorName: session.user.name,
      },
    }),
    // An internal note is not an answer, so it must not change what the user
    // sees the ticket state as.
    ...(parsed.data.isInternal
      ? []
      : [
          prisma.supportTicket.update({
            where: { id: parsed.data.ticketId },
            data: { status: "WAITING_ON_USER" },
          }),
        ]),
  ]);

  revalidatePath("/admin/support");
  return { success: true };
}

const updateSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
});

export async function updateTicketAction(
  input: z.input<typeof updateSchema>
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid update" };

  const { ticketId, status, priority } = parsed.data;
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(status === "RESOLVED" || status === "CLOSED" ? { resolvedAt: new Date() } : {}),
      ...(status ? { assignedToId: session.user.id } : {}),
    },
  });

  log.info({ ticketId, status, priority, by: session.user.id }, "Ticket updated");
  revalidatePath("/admin/support");
  return { success: true };
}
