"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone, X } from "lucide-react";
import type { PublicAnnouncement } from "@/features/announcements/services/announcement.service";
import { cn } from "@/lib/utils";

/**
 * Offer strip above the public header.
 *
 * A marquee rather than centred text, because the old strip used flex-wrap on a
 * full sentence: on a phone it broke onto three lines and pushed the header
 * down. A single non-wrapping track is the same height at every width, which is
 * what actually fixes the mobile layout — the scrolling is a side benefit that
 * lets several offers share one line.
 *
 * The track is rendered twice and translated by exactly -50%, so the second
 * copy is under the cursor at the moment the first finishes and the loop has no
 * visible seam. `aria-hidden` on the duplicate keeps screen readers from
 * hearing every offer twice.
 */
export function OfferStrip({ announcements }: { announcements: PublicAnnouncement[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || announcements.length === 0) return null;

  // Duration scales with content so a long list doesn't race past unread.
  const seconds = Math.max(18, announcements.length * 12);

  return (
    <div className="relative isolate brand-gradient text-primary-foreground">
      <div className="flex items-center gap-2 py-2 pr-9 pl-3 sm:pr-11 sm:pl-4">
        <Megaphone className="size-3.5 flex-shrink-0 opacity-90" aria-hidden />

        {/* group/marquee so hovering anywhere on the strip pauses the scroll. */}
        <div className="marquee-viewport group/marquee relative min-w-0 flex-1 overflow-hidden">
          <div
            className="flex w-max animate-marquee items-center group-hover/marquee:[animation-play-state:paused]"
            style={{ animationDuration: `${seconds}s` }}
          >
            <Track announcements={announcements} />
            <Track announcements={announcements} aria-hidden />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss announcements"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 opacity-80 transition hover:bg-primary-foreground/15 hover:opacity-100 sm:right-3"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Track({
  announcements,
  ...rest
}: {
  announcements: PublicAnnouncement[];
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex shrink-0 items-center" {...rest}>
      {announcements.map((a) => (
        <span
          key={a.id}
          className="flex items-center gap-1.5 px-5 text-2xs font-semibold whitespace-nowrap sm:text-xs"
        >
          {a.message}
          {a.linkHref && a.linkLabel && (
            <Link
              href={a.linkHref}
              className={cn(
                "inline-flex items-center gap-0.5 font-bold underline underline-offset-2",
                "hover:opacity-90"
              )}
            >
              {a.linkLabel}
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          )}
          <span aria-hidden className="ml-3 opacity-40">
            •
          </span>
        </span>
      ))}
    </div>
  );
}
