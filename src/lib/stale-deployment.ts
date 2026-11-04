/**
 * Detecting a page that is older than the server it talks to.
 *
 * After a deploy, a tab opened earlier can call a Server Action the new build
 * no longer has. Next answers 404 with this header, and the action's caller
 * receives a cryptic "Server Action ... was not found on the server". The
 * only cure is loading the current page.
 */
export const ACTION_NOT_FOUND_HEADER = "x-nextjs-action-not-found";

/** sessionStorage key: when this tab last reloaded for a stale deployment. */
export const STALE_RELOAD_KEY = "gp_stale_reload_at";

/** Never reload again within this window, so a persistent fault cannot loop. */
export const STALE_RELOAD_COOLDOWN_MS = 60_000;

export function shouldReloadForStaleDeployment(
  lastReloadAt: number | null,
  now: number = Date.now()
): boolean {
  return lastReloadAt === null || now - lastReloadAt > STALE_RELOAD_COOLDOWN_MS;
}
