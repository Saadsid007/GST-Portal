"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marketplace mark.
 *
 * Renders `/platforms/<id>.<ext>` when that file exists and falls back to a
 * branded monogram otherwise, so dropping a logo into `public/platforms/`
 * makes it appear with no code change.
 *
 * The fallback is not a placeholder to be replaced later — Amazon, Flipkart and
 * the rest are third-party trademarks. Shipping them requires either their
 * brand-asset licence terms being met or the files being supplied deliberately,
 * which is a decision for whoever owns the site, not something to smuggle in.
 * The monogram is designed to look intentional on its own.
 */
const SIZES = {
  sm: { box: "size-8 rounded-lg", text: "text-2xs", px: 32 },
  md: { box: "size-10 rounded-xl", text: "text-xs", px: 40 },
  lg: { box: "size-14 rounded-2xl", text: "text-base", px: 56 },
} as const;

export interface PlatformLogoProps {
  /** Platform id, e.g. "amazon". Used to resolve the asset filename. */
  id: string;
  name: string;
  /** Tailwind gradient classes from the platform config, e.g. "from-x to-y". */
  accentColor?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Initials from the display name — "JioMart Partner" becomes "JM". */
function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

export function PlatformLogo({ id, name, accentColor, size = "md", className }: PlatformLogoProps) {
  const [failed, setFailed] = useState(false);
  const s = SIZES[size];

  if (failed || !id) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex flex-shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white shadow-sm",
          accentColor ?? "from-primary to-brand-deep",
          s.box,
          s.text,
          className
        )}
      >
        {monogram(name)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex flex-shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-border",
        s.box,
        className
      )}
    >
      <Image
        src={`/platforms/${id}.svg`}
        alt={`${name} logo`}
        width={s.px}
        height={s.px}
        className="size-full object-contain p-1.5"
        onError={() => setFailed(true)}
        unoptimized
      />
    </span>
  );
}
