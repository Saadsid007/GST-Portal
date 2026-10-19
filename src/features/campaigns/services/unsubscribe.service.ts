import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { verifyUnsubscribeToken } from "@/features/campaigns/domain/unsubscribe-token";

const log = createLogger({ module: "unsubscribe" });

/**
 * Stops campaign mail to an address, if the signed link is genuine.
 *
 * Account email (OTPs, receipts, support replies) is not affected — it is not
 * marketing, and a person who unsubscribes still needs their login codes.
 */
export async function unsubscribeEmail(email: string, token: string): Promise<boolean> {
  const address = email.toLowerCase().trim();
  if (!address || !token || !verifyUnsubscribeToken(address, token)) return false;
  const { count } = await prisma.marketingSubscriber.updateMany({
    where: { email: address },
    data: { status: "UNSUBSCRIBED" },
  });
  log.info({ email: address, matched: count }, "Unsubscribed from campaigns");
  return true;
}
