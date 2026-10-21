import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { notifyTicketCreated } from "@/features/support/services/support-notifications";
import {
  generateTicketReference,
  OPEN_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketSource,
  type TicketStatus,
} from "@/features/support/domain/support.constants";

const log = createLogger({ module: "support" });

export interface CreateTicketInput {
  source: TicketSource;
  category: TicketCategory;
  subject: string;
  message: string;
  name: string;
  email: string;
  userId?: string | null;
  referenceId?: string | null;
  priority?: TicketPriority;
}

/**
 * Creates a ticket with a unique human reference.
 *
 * The reference is random rather than sequential: a sequential id would leak
 * total ticket volume to anyone who submits a form. Collisions are retried
 * rather than assumed away — 32^6 is large but the unique index is the actual
 * guarantee, and a retry is cheaper than a 500 on a support form.
 */
export async function createTicket(input: CreateTicketInput) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = generateTicketReference();
    try {
      const ticket = await prisma.supportTicket.create({
        data: {
          reference,
          source: input.source,
          category: input.category,
          priority: input.priority ?? "NORMAL",
          subject: input.subject,
          message: input.message,
          name: input.name,
          email: input.email,
          userId: input.userId ?? null,
          referenceId: input.referenceId ?? null,
        },
      });
      log.info(
        { reference: ticket.reference, source: input.source, category: input.category },
        "Support ticket created"
      );
      notifyTicketCreated(ticket, input.message);
      return ticket;
    } catch (error) {
      const isCollision =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (!isCollision) throw error;
      log.warn({ reference }, "Ticket reference collision, retrying");
    }
  }
  throw new Error("Could not allocate a unique ticket reference");
}

export async function listTicketsForUser(userId: string) {
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { replies: true } },
    },
  });
}

/**
 * A single ticket for its owner. Scoped by userId in the query rather than
 * checked afterwards, so another user's reference simply returns nothing.
 * Internal admin notes are filtered out at the database level.
 */
export async function getTicketForUser(userId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: {
      replies: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export interface AdminTicketFilters {
  status?: TicketStatus;
  source?: TicketSource;
  category?: TicketCategory;
  priority?: TicketPriority;
  search?: string;
}

export async function listTicketsForAdmin(filters: AdminTicketFilters = {}) {
  const search = filters.search?.trim();
  return prisma.supportTicket.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: "insensitive" as const } },
              { subject: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
              { referenceId: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 150,
    include: { _count: { select: { replies: true } } },
  });
}

export async function getTicketForAdmin(ticketId: string) {
  return prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { replies: { orderBy: { createdAt: "asc" } } },
  });
}

/** Counts for the admin queue header. */
export async function getTicketCounts() {
  const [open, total] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { in: [...OPEN_STATUSES] } } }),
    prisma.supportTicket.count(),
  ]);
  return { open, total };
}

/** Dedicated metrics for the client feedback & bug reports admin module. */
export async function getFeedbackCounts() {
  const [total, open, bugs, conversions, features] = await Promise.all([
    prisma.supportTicket.count({ where: { source: "FEEDBACK" } }),
    prisma.supportTicket.count({
      where: { source: "FEEDBACK", status: { in: [...OPEN_STATUSES] } },
    }),
    prisma.supportTicket.count({
      where: {
        source: "FEEDBACK",
        OR: [{ category: "BUG" }, { priority: { in: ["HIGH", "URGENT"] } }],
      },
    }),
    prisma.supportTicket.count({
      where: { source: "FEEDBACK", category: "CONVERSION" },
    }),
    prisma.supportTicket.count({
      where: { source: "FEEDBACK", category: "FEATURE" },
    }),
  ]);

  return { total, open, bugs, conversions, features };
}
