"use server";

import { z } from "zod";
import { unsubscribeEmail } from "@/features/campaigns/services/unsubscribe.service";

const Schema = z.object({ email: z.string().max(320), token: z.string().max(64) });

export async function unsubscribeAction(
  input: z.input<typeof Schema>
): Promise<{ success: boolean }> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { success: false };
  return { success: await unsubscribeEmail(parsed.data.email, parsed.data.token) };
}
