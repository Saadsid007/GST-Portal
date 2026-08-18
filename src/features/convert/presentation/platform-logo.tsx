"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "size-9 rounded-lg p-1", text: "text-2xs", px: 36 },
  md: { box: "size-11 rounded-xl p-1.5", text: "text-xs", px: 44 },
  lg: { box: "size-16 rounded-2xl p-2", text: "text-base", px: 64 },
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

const PLATFORM_IMAGE_MAP: Record<string, string> = {
  amazon: "/platforms/amazon.avif",
  flipkart: "/platforms/flipkart.png",
  glowroad: "/platforms/glowroad.avif",
  jiomart: "/platforms/jiomart.jfif",
  meesho: "/platforms/meesho.png",
  myntra: "/platforms/myntra.png",
  roposo: "/platforms/roposo.png",
  shopdeck: "/platforms/shopdeck.png",
  snapdeal: "/platforms/snapdeal.webp",
  custom: "/platforms/custom.svg",
  offline: "/platforms/offline.svg",
};

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
  const [failCount, setFailCount] = useState(0);
  const s = SIZES[size];

  const primarySrc = PLATFORM_IMAGE_MAP[id] ?? `/platforms/${id}.svg`;
  const fallbackSrc = `/platforms/${id}.svg`;

  const src = failCount === 0 ? primarySrc : failCount === 1 ? fallbackSrc : null;

  if (!src || failCount >= 2 || !id) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex flex-shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105",
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
        "flex flex-shrink-0 items-center justify-center overflow-hidden border border-border/80 bg-card shadow-xs ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 dark:ring-white/10",
        s.box,
        className
      )}
    >
      <Image
        src={src}
        alt={`${name} logo`}
        width={s.px}
        height={s.px}
        className="size-full object-contain"
        onError={() => setFailCount((prev) => prev + 1)}
        unoptimized
      />
    </span>
  );
}
