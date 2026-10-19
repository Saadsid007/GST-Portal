import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { formatRelative } from "@/lib/utils";

const STATUS: Record<string, "success" | "info" | "destructive" | "neutral"> = {
  SENT: "success",
  SENDING: "info",
  FAILED: "destructive",
};

/**
 * What went out, to whom and how much of it arrived. Broadcasts now send after
 * the response, so this is where an admin sees one finish.
 */
export async function BroadcastHistory() {
  const broadcasts = await prisma.campaignBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      subject: true,
      targetAudience: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Recent campaigns</h2>
        <p className="text-xs text-muted-foreground">
          Sending runs in the background; refresh to see a campaign finish.
        </p>
      </div>
      {broadcasts.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No campaigns sent yet.
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {broadcasts.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {b.targetAudience.toLowerCase()} · {formatRelative(b.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span>
                  {b.sentCount}/{b.recipientCount} delivered
                  {b.failedCount > 0 && (
                    <span className="text-destructive-ink"> · {b.failedCount} failed</span>
                  )}
                </span>
                <Badge variant={STATUS[b.status] ?? "neutral"}>{b.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
