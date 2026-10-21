"use client";

import Image from "next/image";
import logoDark from "@/assets/img/logo-dark.png";
import logoLight from "@/assets/img/logo-light.png";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  priority?: boolean;
  forceDark?: boolean;
}

export function AppLogo({
  className,
  size = "md",
  priority = false,
  forceDark = false,
}: AppLogoProps) {
  // Rendered at most ~150px wide. Without `sizes`, next/image offers the
  // 1200px source at 1x and 2x, and every page downloaded ~50KB for a logo.
  const sizesAttr = "160px";

  const sizeClasses = {
    sm: "h-6 sm:h-7 w-auto",
    md: "h-8 sm:h-9 w-auto",
    lg: "h-9 sm:h-10 w-auto",
    xl: "h-10 sm:h-12 w-auto",
  };

  if (forceDark) {
    return (
      <div className={cn("relative inline-flex flex-shrink-0 items-center select-none", className)}>
        <Image
          src={logoDark}
          alt="GSTPilot Logo"
          priority={priority}
          sizes={sizesAttr}
          className={cn(sizeClasses[size], "object-contain")}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative inline-flex flex-shrink-0 items-center select-none", className)}>
      {/* Light theme logo — displayed when in light mode */}
      <Image
        src={logoLight}
        alt="GSTPilot Logo"
        priority={priority}
        sizes={sizesAttr}
        className={cn(sizeClasses[size], "object-contain dark:hidden")}
      />
      {/* Dark theme logo — displayed when in dark mode */}
      <Image
        src={logoDark}
        alt="GSTPilot Logo"
        priority={priority}
        sizes={sizesAttr}
        className={cn(sizeClasses[size], "hidden object-contain dark:block")}
      />
    </div>
  );
}
