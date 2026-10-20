/**
 * Verification and reset subjects carry the 6-digit code itself ("Your
 * GSTPilot Verification Code: 211746"). Logged as-is, anyone with log access
 * could sign in as the recipient, so digit runs of 4 or more are masked.
 */
export function redactSubjectForLog(subject: string): string {
  return subject.replace(/\d{4,}/g, (digits) => "•".repeat(digits.length));
}
