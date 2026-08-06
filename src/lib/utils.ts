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
