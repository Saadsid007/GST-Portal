"use client";

import { useState } from "react";
import Link from "next/link";
import { LifeBuoy, MessageSquare, Plus } from "lucide-react";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import {
  STATUS_LABEL,
  STATUS_TONE,
  type TicketStatus,
} from "@/features/support/domain/support.constants";
import { RaiseRequestDialog } from "@/features/support/presentation/raise-request-dialog";

export interface TicketRow {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { replies: number };
}

export function MyTickets({ tickets }: { tickets: TicketRow[] }) {
  const [raising, setRaising] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Anything we&rsquo;re working on for you, and where it stands.
        </p>
        <Button size="sm" onClick={() => setRaising(true)}>
          <Plus />
          Raise a request
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No requests yet"
          description="Payment not showing up, a conversion behaving oddly, or anything else — raise it here and track it to resolution."
          action={
            <Button onClick={() => setRaising(true)}>
              <Plus />
              Raise a request
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/support/${t.id}`}>
                <Card variant="solid" interactive className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_TONE[t.status as TicketStatus] ?? "neutral"} dot>
                      {STATUS_LABEL[t.status as TicketStatus] ?? t.status}
                    </Badge>
                    <span className="font-mono text-2xs text-muted-foreground">{t.reference}</span>
                    {t._count.replies > 0 && (
                      <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                        <MessageSquare className="size-3" aria-hidden />
                        {t._count.replies}
                      </span>
                    )}
                    <span className="ml-auto text-2xs text-muted-foreground">
                      {t.updatedAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{t.subject}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {raising && <RaiseRequestDialog onClose={() => setRaising(false)} />}
    </div>
  );
}
