"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import {
  ACTION_NOT_FOUND_HEADER,
  shouldReloadForStaleDeployment,
  STALE_RELOAD_KEY,
} from "@/lib/stale-deployment";

/**
 * Site-wide safety net for tabs opened before a deploy (see stale-deployment.ts).
 *
 * Server Action calls go through window.fetch. When the server says the
 * action does not exist, this tells the person why and loads the current
 * version, on every page, instead of each form showing its own puzzling
 * error. A one-minute cooldown keeps a real fault from causing a reload loop.
 */
export function StaleDeploymentGuard() {
  useEffect(() => {
    const original = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await original(...args);
      if (response.headers.get(ACTION_NOT_FOUND_HEADER) === "1") {
        const last = Number(sessionStorage.getItem(STALE_RELOAD_KEY)) || null;
        if (shouldReloadForStaleDeployment(last)) {
          sessionStorage.setItem(STALE_RELOAD_KEY, String(Date.now()));
          toast.info("GSTPilot was just updated. Reloading the page…");
          setTimeout(() => window.location.reload(), 1500);
        }
      }
      return response;
    };

    return () => {
      window.fetch = original;
    };
  }, []);

  return null;
}
