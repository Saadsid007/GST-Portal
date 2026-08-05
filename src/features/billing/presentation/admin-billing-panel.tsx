"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Percent, Plus, Save, Sparkles, Ticket, Trash2, Zap } from "lucide-react";
import {
  createCreditCodeAction,
  getAdminBillingConfigAction,
  saveBonusSlabsAction,
  saveCampaignAction,
  saveFreeTrialAction,
  saveGenerationCostAction,
  saveRechargePacksAction,
  saveReferralRewardsAction,
  setCreditCodeActiveAction,
  type AdminBillingConfig,
} from "@/features/billing/actions/admin.actions";
import type {
  BonusSlab,
  Campaign,
  FreeTrialLimits,
  RechargePack,
  ReferralRewards,
} from "@/features/billing/types/billing.types";
import { AdminWalletTools } from "@/features/billing/presentation/admin-wallet-tools";

const INPUT =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition";
const BTN =
  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition";

export function AdminBillingPanel() {
  const [config, setConfig] = useState<AdminBillingConfig | null>(null);

  useEffect(() => {
    void getAdminBillingConfigAction().then((result) => {
      if (result.success) setConfig(result.data);
    });
  }, []);

  async function reload() {
    const result = await getAdminBillingConfigAction();
    if (result.success) setConfig(result.data);
  }

  if (!config) {
    return <p className="text-xs text-muted-foreground">Loading billing configuration…</p>;
  }

  return (
    <div className="space-y-6">
      <GenerationCostSection cost={config.generationCost} onSaved={reload} />
      <BonusSlabsSection slabs={config.slabs} onSaved={reload} />
      <RechargePacksSection packs={config.packs} onSaved={reload} />
      <RewardsSection rewards={config.rewards} onSaved={reload} />
      <TrialSection trial={config.trial} onSaved={reload} />
      <CampaignSection campaign={config.campaign} onSaved={reload} />
      <CreditCodesSection
        codes={config.creditCodes}
        suggested={config.suggestedCode}
        onSaved={reload}
      />
      <AdminWalletTools />
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

function GenerationCostSection({ cost, onSaved }: { cost: number; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(String(cost));
  const [pending, startTransition] = useTransition();

  return (
    <Card
      title="Generation Cost"
      icon={<Zap className="size-4 text-amber-500" />}
      hint="Credits deducted for one GSTR-1 return. 1 credit = ₹1."
    >
      <div className="flex max-w-xs items-end gap-2">
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={INPUT}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveGenerationCostAction(Number(value));
              if (result.success) {
                toast.success("Generation cost updated");
                await onSaved();
              } else toast.error(result.error);
            })
          }
          className={BTN}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{" "}
          Save
        </button>
      </div>
    </Card>
  );
}

function BonusSlabsSection({
  slabs,
  onSaved,
}: {
  slabs: BonusSlab[];
  onSaved: () => Promise<void>;
}) {
  const [rows, setRows] = useState<BonusSlab[]>(slabs);
  const [pending, startTransition] = useTransition();

  function patch(index: number, patchValue: Partial<BonusSlab>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patchValue } : row)));
  }

  return (
    <Card
      title="Wallet Bonus Slabs"
      icon={<Percent className="size-4 text-emerald-500" />}
      hint="Ranges must be contiguous with no gaps, and the top slab must be open-ended. Validated on save."
    >
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
            <input
              type="number"
              value={row.minAmount}
              onChange={(e) => patch(index, { minAmount: Number(e.target.value) })}
              placeholder="Min ₹"
              className={INPUT}
            />
            <input
              type="number"
              value={row.maxAmount ?? ""}
              onChange={(e) =>
                patch(index, { maxAmount: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="Max ₹ (blank = no limit)"
              className={INPUT}
            />
            <input
              type="number"
              step="0.1"
              value={row.bonusPercent}
              onChange={(e) => patch(index, { bonusPercent: Number(e.target.value) })}
              placeholder="Bonus %"
              className={INPUT}
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              className="rounded-lg border border-border p-2 transition hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove slab"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              { minAmount: (current.at(-1)?.maxAmount ?? 0) + 1, maxAmount: null, bonusPercent: 0 },
            ])
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold transition hover:bg-muted"
        >
          <Plus className="size-3.5" /> Add slab
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveBonusSlabsAction(rows);
              if (result.success) {
                toast.success("Bonus slabs updated — live immediately, no deploy needed");
                await onSaved();
              } else toast.error(result.error);
            })
          }
          className={BTN}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{" "}
          Save slabs
        </button>
      </div>
    </Card>
  );
}

function RechargePacksSection({
  packs,
  onSaved,
}: {
  packs: RechargePack[];
  onSaved: () => Promise<void>;
}) {
  const [rows, setRows] = useState<RechargePack[]>(packs);
  const [pending, startTransition] = useTransition();

  function patch(index: number, patchValue: Partial<RechargePack>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patchValue } : row)));
  }

  return (
    <Card
      title="Recharge Packs"
      icon={<Ticket className="size-4 text-violet-500" />}
      hint="Only one pack should be starred Most Popular. Custom amounts below the first bonus slab earn nothing, by design."
    >
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
            <input
              type="text"
              value={row.label}
              onChange={(e) => patch(index, { label: e.target.value })}
              placeholder="Label"
              className={INPUT}
            />
            <input
              type="number"
              value={row.amount}
              onChange={(e) => patch(index, { amount: Number(e.target.value) })}
              placeholder="₹"
              className={INPUT}
            />
            <label className="flex items-center gap-1.5 px-2 text-xs font-semibold whitespace-nowrap">
              <input
                type="checkbox"
                checked={row.popular}
                onChange={(e) =>
                  setRows((current) =>
                    current.map((item, i) => ({
                      ...item,
                      popular: i === index && e.target.checked,
                    }))
                  )
                }
              />
              Popular
            </label>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              className="rounded-lg border border-border p-2 transition hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove pack"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              { id: `pack-${current.length + 1}`, label: "New Pack", amount: 99, popular: false },
            ])
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold transition hover:bg-muted"
        >
          <Plus className="size-3.5" /> Add pack
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveRechargePacksAction(rows);
              if (result.success) {
                toast.success("Recharge packs updated");
                await onSaved();
              } else toast.error(result.error);
            })
          }
          className={BTN}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{" "}
          Save packs
        </button>
      </div>
    </Card>
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
      icon={<Sparkles className="size-4 text-amber-500" />}
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

function TrialSection({
  trial,
  onSaved,
}: {
  trial: FreeTrialLimits;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(trial);
  const [pending, startTransition] = useTransition();

  return (
    <Card
      title="Free Trial"
      icon={<Ticket className="size-4 text-blue-500" />}
      hint="Applies to accounts that have never recharged."
    >
      <div className="grid max-w-2xl grid-cols-1 items-end gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Max GSTINs
          <input
            type="number"
            value={value.maxGstins}
            onChange={(e) => setValue({ ...value, maxGstins: Number(e.target.value) })}
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Free generations
          <input
            type="number"
            value={value.maxGenerations}
            onChange={(e) => setValue({ ...value, maxGenerations: Number(e.target.value) })}
            className={INPUT}
          />
        </label>
        <label className="flex items-center gap-2 py-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={value.watermark}
            onChange={(e) => setValue({ ...value, watermark: e.target.checked })}
          />
          Watermark trial output
        </label>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveFreeTrialAction(value);
            if (result.success) {
              toast.success("Free trial limits updated");
              await onSaved();
            } else toast.error(result.error);
          })
        }
        className={BTN}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{" "}
        Save trial
      </button>
    </Card>
  );
}

const EMPTY_CAMPAIGN: Campaign = {
  id: "campaign",
  name: "",
  isActive: false,
  bonusMultiplier: 1,
  extraBonusPercent: 0,
  startsAt: null,
  endsAt: null,
};

function CampaignSection({
  campaign,
  onSaved,
}: {
  campaign: Campaign | null;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState<Campaign>(campaign ?? EMPTY_CAMPAIGN);
  const [pending, startTransition] = useTransition();

  return (
    <Card
      title="Seasonal Campaign"
      icon={<Sparkles className="size-4 text-pink-500" />}
      hint="Diwali, filing season, FY end, cashback — configuration only, never a code change. The multiplier scales the slab bonus (1.5 turns 10% into 15%); the extra percent is added on top."
    >
      <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Campaign name
          <input
            type="text"
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
            placeholder="Diwali Dhamaka"
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Bonus multiplier
          <input
            type="number"
            step="0.1"
            value={value.bonusMultiplier}
            onChange={(e) => setValue({ ...value, bonusMultiplier: Number(e.target.value) })}
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
          Extra bonus %
          <input
            type="number"
            step="0.1"
            value={value.extraBonusPercent}
            onChange={(e) => setValue({ ...value, extraBonusPercent: Number(e.target.value) })}
            className={INPUT}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
            Starts
            <input
              type="date"
              value={value.startsAt?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className={INPUT}
            />
          </label>
          <label className="space-y-1 text-xs font-bold text-muted-foreground uppercase">
            Ends
            <input
              type="date"
              value={value.endsAt?.slice(0, 10) ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className={INPUT}
            />
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(e) => setValue({ ...value, isActive: e.target.checked })}
        />
        Campaign is live
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveCampaignAction({ ...value, id: value.name || "campaign" });
              if (result.success) {
                toast.success("Campaign saved");
                await onSaved();
              } else toast.error(result.error);
            })
          }
          className={BTN}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{" "}
          Save campaign
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveCampaignAction(null);
              if (result.success) {
                toast.success("Campaign cleared");
                setValue(EMPTY_CAMPAIGN);
                await onSaved();
              } else toast.error(result.error);
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold transition hover:bg-muted"
        >
          Clear campaign
        </button>
      </div>
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
      icon={<Ticket className="size-4 text-emerald-500" />}
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
                          ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
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
