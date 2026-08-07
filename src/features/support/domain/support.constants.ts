/**
 * Shared vocabulary for the support inbox. The Prisma columns are plain strings
 * so these unions are the only place the allowed values are defined — schemas,
 * admin filters and badge colours all derive from here.
 */

export const TICKET_SOURCES = ["CONTACT", "SUPPORT"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_USER",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  "PAYMENT",
  "CONVERSION",
  "ACCOUNT",
  "BILLING",
  "SALES",
  "OTHER",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** Statuses that still need someone to act. Drives the admin badge count. */
export const OPEN_STATUSES: readonly TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_USER"];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_USER: "Waiting on you",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const STATUS_TONE: Record<
  TicketStatus,
  "warning" | "info" | "primary" | "success" | "neutral"
> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  WAITING_ON_USER: "primary",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

/**
 * What the user picks from, phrased as the problem they have rather than the
 * bucket we file it in. "Charged but credits missing" is a real support ticket;
 * "Billing" is not something anyone searches for at 11pm.
 */
export const USER_CATEGORY_OPTIONS: {
  value: TicketCategory;
  label: string;
  hint: string;
}[] = [
  {
    value: "PAYMENT",
    label: "Payment failed or money deducted",
    hint: "Charged but credits did not arrive, failed UPI, duplicate debit.",
  },
  {
    value: "BILLING",
    label: "Wallet, credits or refund",
    hint: "Balance looks wrong, bonus not applied, refund request.",
  },
  {
    value: "CONVERSION",
    label: "A conversion or file problem",
    hint: "Upload failed, wrong totals, mapping or validation errors.",
  },
  {
    value: "ACCOUNT",
    label: "Account or sign-in",
    hint: "Cannot sign in, change email, delete account.",
  },
  { value: "OTHER", label: "Something else", hint: "Anything not covered above." },
];

/** Categories offered on the public contact form. */
export const CONTACT_CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: "SALES", label: "Sales & CA firm plans" },
  { value: "CONVERSION", label: "Product or conversion question" },
  { value: "BILLING", label: "Pricing & billing" },
  { value: "OTHER", label: "Something else" },
];

/**
 * Short, human-quotable reference. Ambiguous characters (0/O, 1/I) are excluded
 * because people read these out over the phone and type them back into a form.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateTicketReference(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return `GP-${out}`;
}
