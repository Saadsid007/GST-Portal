import { describe, expect, it } from "vitest";
import { shouldReloadForStaleDeployment, STALE_RELOAD_COOLDOWN_MS } from "@/lib/stale-deployment";

describe("shouldReloadForStaleDeployment", () => {
  it("reloads the first time", () => {
    expect(shouldReloadForStaleDeployment(null, 1_000_000)).toBe(true);
  });

  it("does not reload again within the cooldown, so a fault cannot loop", () => {
    expect(shouldReloadForStaleDeployment(1_000_000, 1_000_000 + 5_000)).toBe(false);
  });

  it("reloads again once the cooldown has passed", () => {
    expect(
      shouldReloadForStaleDeployment(1_000_000, 1_000_000 + STALE_RELOAD_COOLDOWN_MS + 1)
    ).toBe(true);
  });
});
