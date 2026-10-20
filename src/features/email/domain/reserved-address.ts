/**
 * Domains reserved by RFC 2606 / RFC 6761 that can never receive mail.
 *
 * QA accounts sign up as qa.gstpilot+…@example.com, and soft-deleted users
 * are parked at deleted.<id>@deleted.invalid. Sending to them only produces
 * bounces, and a copy of every message lands in the sending Gmail mailbox.
 */
const RESERVED_DOMAINS = ["example.com", "example.net", "example.org"] as const;
const RESERVED_TLDS = [".invalid", ".test", ".example", ".localhost"] as const;

export function isUndeliverableAddress(address: string): boolean {
  const domain = address.trim().toLowerCase().split("@").pop() ?? "";
  if (!domain) return true;
  return (
    RESERVED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)) ||
    RESERVED_TLDS.some((tld) => domain.endsWith(tld)) ||
    domain === "localhost"
  );
}
