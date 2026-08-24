# Billing, Wallet, Credits & Referrals

The single metering layer for every paid GSTPilot feature. Today it meters GSTR-1
generation; GSTR-3B, Reconciliation, AI Fix, HSN Validator, Bulk Conversion and API usage
will all debit the same wallet.

## Money model

- **1 credit = ₹1.** Credits are `Int` — never `Decimal` — so balance arithmetic is exact.
- One GSTR-1 return costs `generation_cost` credits (default 6).
- Credits never expire.
- Recharges earn slab-based bonus credits. Bonus rounds **down**.

## The one hard invariant

**A wallet balance is never written directly.** Every movement goes through
`creditWallet` / `debitWallet` in `services/wallet.service.ts`, which run inside a
`prisma.$transaction`, re-read and lock the wallet row, then write a `WalletTransaction`
ledger row carrying `balanceBefore` and `balanceAfter`. `Wallet.balance` is a materialised
running total that must always equal the newest ledger row's `balanceAfter`.

There is no `prisma.wallet.update({ data: { balance } })` anywhere else in the codebase.
Keep it that way — it is what makes the ledger reconcilable and the CSV export truthful.

## GSTIN capacity (active-capacity + archive model)

**Capacity is the number of ACTIVE GSTIN profiles, not how many were ever created.** A plan
grants `base` active slots; add-ons grant more. `total = base + additional`, and a slot is
consumed only while a profile is `ACTIVE`. All arithmetic lives in `domain/gstin-capacity.ts`
(pure, unit-tested); nothing derives capacity from a raw client count.

Profiles have an explicit lifecycle (`GstinStatus`): `ACTIVE`, `ARCHIVED`,
`INACTIVE_FOR_BILLING`, `PENDING_DELETE`. Never a single boolean.

- **Archiving frees the slot immediately** and preserves everything — history, reports,
  imports, audit. The freed slot is reusable at no cost: restore the archived GSTIN, or
  activate a different one. An add-on is _capacity_, never welded to one GSTIN.
- **Permanent delete** is a separate flow, allowed only on an already-archived profile, so
  it can never be used to free a live slot. Filing history keys off `gstinNumber`, not the
  profile id, so it survives the delete.
- **Deleting is never how a slot is freed** — archiving is.

### Anti-abuse (create → file → archive → repeat)

Archives are _not_ frozen, so a CA replacing a client stays smooth. Abuse is bounded two
ways instead (thresholds in `pricing.config.ts` → `GSTIN_ANTI_ABUSE`, never hardcoded):

- **Per-cycle activation ceiling** = `total + replacementAllowancePerCycle`. Counts distinct
  brand-new GSTINs activated since `Subscription.startDate` (the `GstinCreationLog` ledger).
  Restoring a GSTIN already activated this period does **not** count — undoing an accidental
  archive is always free. The window resets at renewal because it is measured from
  `startDate`.
- **Churn rate-limit**: capacity ops (activate/archive/restore) per hour. Over the ceiling,
  the op is refused and a `ABUSE_REVIEW_TRIGGERED` audit event is written — the user is never
  auto-banned.

### Enforcement & integrity

- Every gate is server-side (`canActivateGstin`). Activation, restore and permanent-delete
  run in a `$transaction` that re-reads the live active count, so two tabs cannot both take
  the last slot; `@@unique([userId, gstinNumber])` is the structural backstop.
- One profile per GSTIN per workspace across all statuses — a known GSTIN is restored, never
  duplicated.
- Every capacity change writes a `BillingAuditLog` event (`GSTIN_ACTIVATED`, `_ARCHIVED`,
  `_RESTORED`, `_PERMANENTLY_DELETED`, `ABUSE_REVIEW_TRIGGERED`).
- Subscription expiry locks processing only; it never deletes or archives data.

> Not yet built (later phases): renewal/downgrade capacity-resolution screens when the new
> plan holds fewer than the currently-active count, add-on carryover rules, and multi-member
> workspace sharing. Today `userId` is the workspace boundary.

## Free trial

Trial allowances are **usage grants, not credits**. A free generation mints nothing; it
increments `Wallet.freeGenerationsUsed` and writes a zero-value `FREE_TRIAL` ledger row for
the audit trail only. Defaults: 1 GSTIN, 2 generations, watermark on.

The trial ends the moment `lifetimeRecharged > 0`, which is also the referral payout
trigger — the two are deliberately the same signal.

## Razorpay

Two independent settlement paths converge on one idempotent handler:

1. `verifyPaymentAction` — the fast path, verifies the client-returned signature.
2. `POST /api/webhooks/razorpay` — **authoritative**. Reads the raw body via
   `request.text()` before any JSON parse (the HMAC is over raw bytes), compares with
   `crypto.timingSafeEqual`.

Idempotency is structural: `RechargeOrder.webhookEventId` is `@unique` and is written
inside the same transaction that credits the wallet. A replayed event hits the constraint
and becomes a no-op. The wallet cannot be credited twice.

Bonus is always computed **server-side** from the amount. The client's preview calls the
same `calculateBonus`, so what the user is shown is exactly what settles.

## Referrals

- Permanent code per user (`GSTP-XXXXXX`), generated lazily.
- Optional 24-hour share token, one per user per day, single-use, new users only.
- **The reward is paid only after the referee's first successful Razorpay recharge.**
  Never on signup, never on registration, and — deliberately — **never on credit-code
  redemption**, otherwise an admin handing out codes could farm payouts.
- Abuse guards are all server-side: self-referral blocked, `Referral.refereeId` is
  `@unique` so one redemption per account ever, duplicate GSTIN/mobile rejected, expired
  tokens rejected, and a frozen wallet blocks payouts.

The signup form's referral field is non-blocking by construction: it runs _after_
`signUp.email` has already succeeded and can only produce a toast, so a bad code can never
cost a user their account.

## Credit codes

Hand-issued gifts, separate from referrals. An admin sets the code, the credit amount, an
optional expiry, and **how many users it stays valid for** (`maxRedemptions`). No bonus slab
applies — a 500-credit code grants exactly 500. Redemption runs in a transaction and the
`@@unique([creditCodeId, userId])` insert is the real race guard; the pre-check only exists
to produce a friendly error message.

## Configuration, not code

Everything priced is a row in `billing_config`, read through `services/config.service.ts`
with the `constants/billing.constants.ts` values as a fallback if a row is missing:

| Key                | What it controls                               |
| ------------------ | ---------------------------------------------- |
| `generation_cost`  | credits per GSTR-1                             |
| `bonus_slabs`      | the recharge bonus table                       |
| `recharge_packs`   | pack amounts, labels, which is "Most Popular"  |
| `referral_rewards` | referrer and referee payouts                   |
| `free_trial`       | max GSTINs, free generations, watermark on/off |
| `active_campaign`  | the seasonal promo                             |

`/admin/billing` edits all six. A campaign has a `bonusMultiplier` (1.5 turns a 10% slab
into 15%) and an `extraBonusPercent` added on top, plus optional start/end dates — so
Diwali, filing season, FY end and cashback are **all configuration**. Adding a promotion
must never require a deploy.

Every admin mutation writes an `AuditLog` row.

## Pricing psychology (intentional, do not "fix")

The lowest slab pays **0%** bonus. This is on purpose: a one-time trier tops up ₹20–50 and
gets exactly what they paid for, while a regular filer self-selects ₹199 or ₹499 because
the extra value is visible on the card. Custom recharge must never out-compete the named
packs.

## Layout

```
constants/     seeded defaults + the string unions (no Prisma enums anywhere)
schemas/       Zod, including the slab-table validator used on admin save
types/         all serialisable — no Prisma row crosses the client boundary
domain/        bonus-calculator, referral-code — pure and unit-tested
services/      wallet, referral, credit-code, razorpay, config, entitlement
actions/       wallet, recharge, referral, credit-code, metering, admin
presentation/  wallet-card, recharge-panel, transaction-table, referral-panel,
               redeem-code-panel, paywall-screen, admin-billing-panel, admin-wallet-tools
```

## Metering point

The gate is **step 9's "Generate Return & Proceed to Download"**, not step 10's download
button. Step 9's `onNext` fires exactly once per journey; step 10's `downloadWorkbook`
hits the server on every click and would double-charge, while `downloadJson` makes no
server call and would never charge.

## Tests

`tests/unit/billing-*.test.ts`. Prisma is mocked with an in-memory fake that reproduces the
unique constraints, so the race guards are actually exercised rather than assumed. Covered:
all four bonus worked examples and every slab boundary, insufficient balance, frozen
wallet, ledger before/after continuity, webhook idempotency, self-referral, expired token,
reward-not-paid-before-recharge, credit codes (double redeem, exhaustion, expiry, exact
face value, no referral settlement).
