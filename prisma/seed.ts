/**
 * Seeds the admin-editable `billing_config` rows and the bootstrap admin account.
 *
 * Idempotent: an existing row is left untouched so re-running the seed never
 * overwrites pricing an admin has already tuned in production.
 */

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import prisma from "@/lib/prisma";
import {
  BILLING_CONFIG_KEYS,
  BONUS_SLABS,
  FREE_TRIAL_LIMITS,
  GENERATION_COST,
  RECHARGE_PACKS,
  REFERRAL_REWARDS,
} from "@/features/billing/constants/billing.constants";

const DEFAULTS: { key: string; value: unknown }[] = [
  { key: BILLING_CONFIG_KEYS.generationCost, value: GENERATION_COST },
  { key: BILLING_CONFIG_KEYS.bonusSlabs, value: BONUS_SLABS },
  { key: BILLING_CONFIG_KEYS.rechargePacks, value: RECHARGE_PACKS },
  { key: BILLING_CONFIG_KEYS.referralRewards, value: REFERRAL_REWARDS },
  { key: BILLING_CONFIG_KEYS.freeTrial, value: FREE_TRIAL_LIMITS },
  { key: BILLING_CONFIG_KEYS.activeCampaign, value: null },
];

/**
 * Creates the first admin. Registration goes through Better Auth rather than a raw
 * insert so the password hash matches what the sign-in endpoint will verify.
 */
async function seedAdmin(): Promise<void> {
  const email = env.ADMIN_SEED_EMAIL;
  const password = env.ADMIN_SEED_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await auth.api.signUpEmail({ body: { email, password, name: "Admin" } });
  }
  await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
}

async function main(): Promise<void> {
  for (const { key, value } of DEFAULTS) {
    await prisma.billingConfig.upsert({
      where: { key },
      create: { key, value: value as never },
      update: {},
    });
  }
  await seedAdmin();
}

// Not top-level await: tsx transforms this file as CJS, where that is unsupported.
void main().finally(() => prisma.$disconnect());
