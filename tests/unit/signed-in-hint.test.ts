import { describe, expect, it } from "vitest";
import { hasSignedInHint, SIGNED_IN_HINT_COOKIE } from "@/features/auth/domain/signed-in-hint";

describe("hasSignedInHint", () => {
  it("finds the hint among other cookies", () => {
    expect(hasSignedInHint(`theme=dark; ${SIGNED_IN_HINT_COOKIE}=1; other=x`)).toBe(true);
    expect(hasSignedInHint(`${SIGNED_IN_HINT_COOKIE}=1`)).toBe(true);
  });

  it("is false without it, or with any other value", () => {
    expect(hasSignedInHint("")).toBe(false);
    expect(hasSignedInHint("theme=dark")).toBe(false);
    expect(hasSignedInHint(`${SIGNED_IN_HINT_COOKIE}=0`)).toBe(false);
    expect(hasSignedInHint(`x${SIGNED_IN_HINT_COOKIE}=1`)).toBe(false);
  });
});
