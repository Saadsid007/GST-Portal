"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search, Snowflake, Users } from "lucide-react";
import {
  adminCreditAction,
  freezeWalletAction,
  searchWalletsAction,
  setPlanAction,
  type AdminWalletRow,
} from "@/features/billing/actions/admin.actions";
import { CA_PLAN_IDS } from "@/features/billing/constants/billing.constants";
import type { CaPlanId } from "@/features/billing/types/billing.types";

const INPUT =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition";

export function AdminWalletTools() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminWalletRow[]>([]);
  const [selected, setSelected] = useState<AdminWalletRow | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      const result = await searchWalletsAction(query);
      if (result.success) {
        setRows(result.data);
        setSelected(null);
      } else toast.error(result.error);
    });
  }

  async function refresh(userId: string) {
    const result = await searchWalletsAction(query);
    if (!result.success) return;
    setRows(result.data);
    setSelected(result.data.find((row) => row.userId === userId) ?? null);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Users className="size-4 text-primary-ink" /> Wallets
        </h2>
        <p className="pt-0.5 text-[11px] text-muted-foreground">
          Manual credits land in the ledger like any other movement, so the balance stays
          reconcilable.
        </p>
      </div>

      <div className="flex max-w-md flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
          placeholder="Search by name or email (blank = newest 25)"
          className={INPUT}
        />
        <button
          type="button"
          onClick={search}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Search className="size-3.5" />
          )}{" "}
          Search
        </button>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left font-bold">User</th>
                <th className="px-4 py-2.5 text-left font-bold">Plan</th>
                <th className="px-4 py-2.5 text-right font-bold">Balance</th>
                <th className="px-4 py-2.5 text-right font-bold">Recharged</th>
                <th className="px-4 py-2.5 text-right font-bold">Used</th>
                <th className="px-4 py-2.5 text-right font-bold">Free</th>
                <th className="px-4 py-2.5 text-right font-bold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.userId}
                  className={`border-t border-border ${selected?.userId === row.userId ? "bg-primary/5" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-muted-foreground">{row.email}</p>
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{row.plan}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">{row.balance}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                    ₹{row.lifetimeRecharged}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                    {row.lifetimeUsed}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                    {row.freeGenerationsUsed}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.isFrozen && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary-ink uppercase">
                          <Snowflake className="size-3" /> Frozen
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(selected?.userId === row.userId ? null : row)}
                        className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold uppercase transition hover:bg-muted"
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <WalletActions row={selected} onDone={() => refresh(selected.userId)} />}
    </section>
  );
}

function WalletActions({ row, onDone }: { row: AdminWalletRow; onDone: () => Promise<void> }) {
  const [credits, setCredits] = useState("");
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<CaPlanId>(
    (CA_PLAN_IDS as readonly string[]).includes(row.plan) ? (row.plan as CaPlanId) : "FREE"
  );
  const [months, setMonths] = useState("1");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-xs font-bold">
        Managing <span className="font-mono">{row.email}</span>
      </p>

      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <label className="space-y-1 text-[10px] font-bold text-muted-foreground uppercase">
          Credits (negative claws back)
          <input
            type="number"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="500"
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-[10px] font-bold text-muted-foreground uppercase">
          Reason (audit trail)
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Goodwill credit for failed generation"
            className={INPUT}
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await adminCreditAction({
                userId: row.userId,
                credits: Number(credits),
                reason,
              });
              if (result.success) {
                toast.success("Wallet adjusted");
                setCredits("");
                setReason("");
                await onDone();
              } else toast.error(result.error);
            })
          }
          className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          Apply
        </button>
      </div>

      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1 text-[10px] font-bold text-muted-foreground uppercase">
          Plan
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as CaPlanId)}
            className={INPUT}
          >
            {CA_PLAN_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[10px] font-bold text-muted-foreground uppercase">
          Months valid (blank = never expires)
          <input
            type="number"
            min={1}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className={INPUT}
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setPlanAction({
                userId: row.userId,
                plan,
                monthsValid: months === "" ? null : Number(months),
              });
              if (result.success) {
                toast.success(`Plan set to ${plan}`);
                await onDone();
              } else toast.error(result.error);
            })
          }
          className="rounded-lg border border-border px-3.5 py-2 text-xs font-bold transition hover:bg-muted disabled:opacity-50"
        >
          Set plan
        </button>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await freezeWalletAction({
              userId: row.userId,
              isFrozen: !row.isFrozen,
              reason: reason || (row.isFrozen ? "Unfrozen by admin" : "Frozen by admin"),
            });
            if (result.success) {
              toast.success(row.isFrozen ? "Wallet unfrozen" : "Wallet frozen");
              await onDone();
            } else toast.error(result.error);
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-bold transition hover:bg-muted disabled:opacity-50"
      >
        <Snowflake className="size-3.5" /> {row.isFrozen ? "Unfreeze wallet" : "Freeze wallet"}
      </button>
    </div>
  );
}
