"use server";

import { requireAdmin } from "@/features/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { EmailService } from "@/features/email/services/email.service";
import { createLogger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

const logger = createLogger({ module: "marketing-actions" });

export interface MarketingAudienceItem {
  id: string;
  email: string;
  name: string | null;
  source: string;
  status: string;
  planSlug: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  userId?: string | null;
}

export interface MarketingAudienceStats {
  totalSubscribers: number;
  freeTrialSubscribers: number;
  paidSubscribers: number;
  unsubscribed: number;
}

/**
 * Fetch paginated marketing audience list with filters.
 */
export async function adminGetMarketingAudienceAction(params: {
  search?: string;
  status?: string;
  planSlug?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: {
    items: MarketingAudienceItem[];
    stats: MarketingAudienceStats;
    total: number;
    page: number;
    totalPages: number;
  };
  error?: string;
}> {
  try {
    await requireAdmin();

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(5, Math.min(200, params.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.MarketingSubscriberWhereInput = {};

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }

    if (params.status && params.status !== "ALL") {
      where.status = params.status;
    }

    if (params.planSlug && params.planSlug !== "ALL") {
      if (params.planSlug === "PAID") {
        where.planSlug = { notIn: ["free_trial", "free"] };
      } else {
        where.planSlug = params.planSlug;
      }
    }

    const [items, total, totalAll, freeTrialCount, paidCount, unsubCount] = await Promise.all([
      prisma.marketingSubscriber.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.marketingSubscriber.count({ where }),
      prisma.marketingSubscriber.count(),
      prisma.marketingSubscriber.count({ where: { planSlug: "free_trial" } }),
      prisma.marketingSubscriber.count({
        where: { planSlug: { notIn: ["free_trial", "free"] } },
      }),
      prisma.marketingSubscriber.count({ where: { status: "UNSUBSCRIBED" } }),
    ]);

    return {
      success: true,
      data: {
        items: items.map((i) => ({
          id: i.id,
          email: i.email,
          name: i.name,
          source: i.source,
          status: i.status,
          planSlug: i.planSlug,
          tags: i.tags,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          userId: i.userId,
        })),
        stats: {
          totalSubscribers: totalAll,
          freeTrialSubscribers: freeTrialCount,
          paidSubscribers: paidCount,
          unsubscribed: unsubCount,
        },
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    logger.error({ error: err }, "Failed to fetch marketing audience");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load marketing audience.",
    };
  }
}

/**
 * Export matching audience as CSV string for marketing software (Mailchimp, Meta Ads, Brevo).
 */
export async function adminExportAudienceCsvAction(params: {
  status?: string;
  planSlug?: string;
}): Promise<{
  success: boolean;
  csvContent?: string;
  filename?: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    const where: Prisma.MarketingSubscriberWhereInput = {};
    if (params.status && params.status !== "ALL") {
      where.status = params.status;
    }
    if (params.planSlug && params.planSlug !== "ALL") {
      if (params.planSlug === "PAID") {
        where.planSlug = { notIn: ["free_trial", "free"] };
      } else {
        where.planSlug = params.planSlug;
      }
    }

    const subscribers = await prisma.marketingSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const headers = ["Email", "Name", "Plan", "Status", "Source", "Tags", "Date Joined"];
    const rows = subscribers.map((s) => [
      `"${s.email.replace(/"/g, '""')}"`,
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${s.planSlug}"`,
      `"${s.status}"`,
      `"${s.source}"`,
      `"${s.tags.join(",")}"`,
      `"${s.createdAt.toISOString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const filename = `gstpilot_marketing_audience_${Date.now()}.csv`;

    return {
      success: true,
      csvContent,
      filename,
    };
  } catch (err) {
    logger.error({ error: err }, "Failed to export marketing audience CSV");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to export audience CSV.",
    };
  }
}

/**
 * Sync all registered accounts into the Marketing Audience database table.
 */
export async function adminSyncAllUsersToMarketingAction(): Promise<{
  success: boolean;
  syncedCount?: number;
  error?: string;
}> {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      include: {
        subscription: true,
      },
    });

    let count = 0;
    for (const u of users) {
      const planSlug = u.subscription?.planSlug || "free_trial";
      const tags = planSlug === "free_trial" ? ["trial_user"] : ["paid_customer", planSlug];

      await prisma.marketingSubscriber.upsert({
        where: { email: u.email },
        create: {
          email: u.email,
          name: u.name,
          userId: u.id,
          source: "SIGNUP",
          status: "SUBSCRIBED",
          planSlug,
          tags,
        },
        update: {
          name: u.name,
          userId: u.id,
          planSlug,
        },
      });
      count++;
    }

    logger.info({ syncedCount: count }, "All users synced to marketing audience table");
    revalidatePath("/admin/campaigns");
    return { success: true, syncedCount: count };
  } catch (err) {
    logger.error({ error: err }, "Failed to sync users to marketing audience");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sync users.",
    };
  }
}

/**
 * Send a marketing campaign broadcast email to selected target audience segments.
 */
export async function adminSendBroadcastCampaignAction(input: {
  subject: string;
  headline: string;
  bodyText: string;
  targetAudience: "ALL" | "TRIAL" | "PAID" | "EXPIRED";
  ctaText?: string;
  ctaUrl?: string;
}): Promise<{
  success: boolean;
  recipientCount?: number;
  broadcastId?: string;
  error?: string;
}> {
  try {
    const admin = await requireAdmin();
    const { subject, headline, bodyText, targetAudience, ctaText, ctaUrl } = input;

    if (!subject.trim() || !headline.trim() || !bodyText.trim()) {
      return { success: false, error: "Subject, headline and body text are required." };
    }

    // Determine target subscriber list
    const where: Prisma.MarketingSubscriberWhereInput = { status: "SUBSCRIBED" };
    if (targetAudience === "TRIAL") {
      where.planSlug = "free_trial";
    } else if (targetAudience === "PAID") {
      where.planSlug = { notIn: ["free_trial", "free"] };
    }

    const recipients = await prisma.marketingSubscriber.findMany({
      where,
      select: { email: true, name: true },
    });

    if (recipients.length === 0) {
      return { success: false, error: "No active subscribers found for the selected audience." };
    }

    // Create broadcast record
    const broadcast = await prisma.campaignBroadcast.create({
      data: {
        subject,
        headline,
        previewText: headline,
        contentHtml: bodyText,
        targetAudience,
        recipientCount: recipients.length,
        status: "SENDING",
        adminId: admin.user.id,
      },
    });

    // Send emails
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const res = await EmailService.sendCampaignBroadcastEmail({
          to: recipient.email,
          name: recipient.name || undefined,
          subject,
          headline,
          bodyText,
          ctaText: ctaText?.trim() ? ctaText.trim() : undefined,
          ctaUrl: ctaUrl?.trim() ? ctaUrl.trim() : undefined,
        });

        if (res.success) sentCount++;
        else failedCount++;
      } catch {
        failedCount++;
      }
    }

    await prisma.campaignBroadcast.update({
      where: { id: broadcast.id },
      data: {
        status: "SENT",
        sentCount,
        failedCount,
        sentAt: new Date(),
      },
    });

    logger.info(
      { broadcastId: broadcast.id, sentCount, failedCount },
      "Campaign broadcast dispatched"
    );

    revalidatePath("/admin/campaigns");
    return {
      success: true,
      recipientCount: sentCount,
      broadcastId: broadcast.id,
    };
  } catch (err) {
    logger.error({ error: err }, "Failed to send campaign broadcast");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to dispatch broadcast.",
    };
  }
}
