"use server";

import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { getWalletSummary } from "@/features/billing/services/entitlement.service";
import { getOrCreateWallet } from "@/features/billing/services/wallet.service";
import { ledgerQuerySchema } from "@/features/billing/schemas/billing.schemas";
import type {
  ActionResult,
  LedgerEntry,
  TransactionType,
  WalletSummary,
} from "@/features/billing/types/billing.types";

export async function getWalletSummaryAction(): Promise<ActionResult<WalletSummary>> {
  const session = await requireSession();
  return { success: true, data: await getWalletSummary(session.user.id) };
}

/** Narrows every row before it crosses the client boundary. */
export async function getLedgerAction(
  type: TransactionType | null = null,
  limit = 100
): Promise<ActionResult<LedgerEntry[]>> {
  const session = await requireSession();
  const parsed = ledgerQuerySchema.safeParse({ type, limit });
  if (!parsed.success) {
    return { success: false, error: "Invalid filter" };
  }

  const wallet = await getOrCreateWallet(session.user.id);
  const rows = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
  });

  return {
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      type: row.type as TransactionType,
      creditAmount: row.creditAmount,
      balanceBefore: row.balanceBefore,
      balanceAfter: row.balanceAfter,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Built server-side so the export always reflects the full ledger, not whatever
 * subset the table happened to have paged in.
 */
export async function exportLedgerCsvAction(): Promise<ActionResult<string>> {
  const session = await requireSession();
  const wallet = await getOrCreateWallet(session.user.id);
  const rows = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "asc" },
  });

  const header = ["Date", "Type", "Description", "Credits", "Balance Before", "Balance After"];

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.type,
        row.description,
        row.creditAmount,
        row.balanceBefore,
        row.balanceAfter,
      ]
        .map(csvCell)
        .join(",")
    ),
  ];

  return { success: true, data: lines.join("\n") };
}
