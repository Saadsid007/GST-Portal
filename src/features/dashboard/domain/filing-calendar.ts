/**
 * The monthly GSTR-1 return a seller is working on today, and when it is due.
 *
 * GSTR-1 for a month is due on the 11th of the following month. Until the
 * 11th, last month's return is still the open one; after it, this month's.
 * Dates are taken in India time, so a late-night visit does not jump a month.
 */
export interface FilingWindow {
  /** MMYYYY, the format returns are stored in. */
  period: string;
  /** e.g. "October 2026" */
  periodLabel: string;
  /** e.g. "11 Nov 2026" */
  dueLabel: string;
  daysLeft: number;
}

const DUE_DAY = 11;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function indiaDate(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

export function currentFilingWindow(now = new Date()): FilingWindow {
  const today = indiaDate(now);
  // Month index of the open return: last month until the 11th, then this one.
  const offset = today.day <= DUE_DAY ? -1 : 0;
  const open = new Date(Date.UTC(today.year, today.month + offset, 1));
  const due = new Date(Date.UTC(open.getUTCFullYear(), open.getUTCMonth() + 1, DUE_DAY));
  const todayUtc = Date.UTC(today.year, today.month, today.day);

  const month = open.getUTCMonth();
  const year = open.getUTCFullYear();
  return {
    period: `${String(month + 1).padStart(2, "0")}${year}`,
    periodLabel: `${MONTHS[month]} ${year}`,
    dueLabel: `${DUE_DAY} ${MONTHS[due.getUTCMonth()]!.slice(0, 3)} ${due.getUTCFullYear()}`,
    daysLeft: Math.round((due.getTime() - todayUtc) / 86_400_000),
  };
}
