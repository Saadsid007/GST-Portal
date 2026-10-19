import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPeriod(period: string): string {
  if (period.length !== 6) return period;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = parseInt(period.slice(0, 2), 10) - 1;
  const year = period.slice(2);
  // Falls back to the raw value rather than rendering "undefined 2608" when a
  // caller hands over something that is not MMYYYY.
  return months[month] ? `${months[month]} ${year}` : period;
}

/** "19 Oct 2026" — the one date format admin and billing screens use. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "5 min ago", "3 days ago"; falls back to the date past a month. */
export function formatRelative(value: Date | string | null | undefined, now = new Date()): string {
  if (!value) return "Never";
  const then = new Date(value);
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(then);
}
