"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Sparkles, Ticket } from "lucide-react";
import {
  createCreditCodeAction,
  getAdminBillingConfigAction,
  saveReferralRewardsAction,
  setCreditCodeActiveAction,
  type AdminBillingConfig,
} from "@/features/billing/actions/admin.actions";
import type { ReferralRewards } from "@/features/billing/types/billing.types";

const INPUT =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition";
const BTN =
  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition";

/**
 * Every billing config section lives behind one server read, so admin screens
 * declare which slices they want rather than each fetching separately.
 */
// Generation cost, recharge packs, bonus slabs, the seasonal recharge bonus and
// the per-generation trial were the credit-per-return model. Returns are
// unlimited on every plan now, nothing in the product read those values, and
// editing them changed nothing a customer could see — so they are gone.
export type AdminBillingSectionKey = "rewards" | "creditCodes";

/**
 * `initialConfig` is fetched by the server component that renders this, so the
 * screen paints with real values instead of flashing a skeleton while a client
 * effect fetches. Saves re-read from the server and swap in through state.
 */
export function AdminBillingSections({
  sections,
  initialConfig,
}: {
  sections: readonly AdminBillingSectionKey[];
  initialConfig: AdminBillingConfig;
}) {
  const [config, setConfig] = useState<AdminBillingConfig>(initialConfig);

  const reload = useCallback(async () => {
    const result = await getAdminBillingConfigAction();
    if (result.success) setConfig(result.data);
    else toast.error("Could not refresh the billing configuration");
  }, []);

  const has = (key: AdminBillingSectionKey) => sections.includes(key);

  return (
    <div className="space-y-6">
      {has("rewards") && <RewardsSection rewards={config.rewards} onSaved={reload} />}
      {has("creditCodes") && (
        <CreditCodesSection
          codes={config.creditCodes}
          suggested={config.suggestedCode}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          {icon} {title}
        </h2>
        {hint && <p className="pt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function RewardsSection({
  rewards,
  onSaved,
}: {
  rewards: ReferralRewards;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(rewards);
  const [pending, startTransition] = useTransition();

  return (
    <Card
      title="Referral Rewards"
      icon={<Sparkles className="size-4 text-warning" />}
      hint="Paid to both parties only after the referred user's first successful recharge."
    >
      <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Referrer credits
          <input
            type="number"
            value={value.referrerCredits}
            onChange={(e) => setValue({ ...value, referrerCredits: Number(e.target.value) })}
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Referee credits
          <input
            type="number"
            value={value.refereeCredits}
            onChange={(e) => setValue({ ...value, refereeCredits: Number(e.target.value) })}
            className={INPUT}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveReferralRewardsAction(value);
            if (result.success) {
              toast.success("Referral rewards updated");
              await onSaved();
            } else toast.error(result.error);
          })
        }
        className={BTN}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{" "}
        Save rewards
      </button>
    </Card>
  );
}

function CreditCodesSection({
  codes,
  suggested,
  onSaved,
}: {
  codes: AdminBillingConfig["creditCodes"];
  suggested: string;
  onSaved: () => Promise<void>;
}) {
  const [code, setCode] = useState(suggested);
  const [credits, setCredits] = useState("500");
  const [maxRedemptions, setMaxRedemptions] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Card
      title="Credit Codes"
      icon={<Ticket className="size-4 text-success" />}
      hint="Hand-issued gift credits. The face value is granted exactly — no bonus slab applies — and redeeming a code never unlocks a referral reward."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Code
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={`${INPUT} font-mono`}
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Credits
          <input
            type="number"
            min={1}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Valid for users
          <input
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Expires (optional)
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="dev testing — Rahul"
            className={INPUT}
          />
        </label>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createCreditCodeAction({
              code,
              credits: Number(credits),
              maxRedemptions: Number(maxRedemptions),
              expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
              note: note || undefined,
            });
            if (result.success) {
              toast.success(`Code ${code} created`);
              setNote("");
              await onSaved();
            } else toast.error(result.error);
          })
        }
        className={BTN}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}{" "}
        Create code
      </button>

      {codes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left font-bold">Code</th>
                <th className="px-4 py-2.5 text-right font-bold">Credits</th>
                <th className="px-4 py-2.5 text-right font-bold">Redeemed</th>
                <th className="px-4 py-2.5 text-left font-bold">Expires</th>
                <th className="px-4 py-2.5 text-left font-bold">Note</th>
                <th className="px-4 py-2.5 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono font-bold">{row.code}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.credits}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {row.redemptionCount}/{row.maxRedemptions}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.expiresAt ? row.expiresAt.slice(0, 10) : "Never"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.note ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await setCreditCodeActiveAction(row.id, !row.isActive);
                          await onSaved();
                        })
                      }
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition ${
                        row.isActive
                          ? "bg-success/10 text-success hover:bg-success/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {row.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
