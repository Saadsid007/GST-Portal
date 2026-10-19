/**
 * Indian mobile numbers, as a person types them at signup.
 *
 * Accepted: "98765 43210", "+91 98765-43210", "09876543210", "919876543210".
 * Stored as "+919876543210" so one number is never two. Indian mobiles are ten
 * digits starting 6–9 (TRAI numbering plan); landlines and short codes are not
 * a way to reach a seller about their return.
 *
 * Not verified yet: an OTP to the number comes later. Until then this is a
 * format check, so a typo is caught but a wrong-but-valid number is not.
 */
const MOBILE = /^[6-9]\d{9}$/;

export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return MOBILE.test(digits) ? `+91${digits}` : null;
}

/** "+919876543210" → "+91 98765 43210", for display. */
export function formatIndianMobile(stored: string | null | undefined): string {
  const normal = normalizeIndianMobile(stored);
  if (!normal) return stored ?? "";
  return `+91 ${normal.slice(3, 8)} ${normal.slice(8)}`;
}

export const PHONE_ERROR = "Enter a valid 10-digit Indian mobile number";
