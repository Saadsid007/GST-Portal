import { describe, expect, it } from "vitest";
import { loginPathFor, safeNextPath } from "@/features/auth/domain/safe-next";

describe("loginPathFor", () => {
  it("carries the requested page", () => {
    expect(loginPathFor("/convert?x=1")).toBe("/login?next=%2Fconvert%3Fx%3D1");
  });

  it.each([null, "", "//evil.com", "/\\evil.com"])("plain /login for %j", (path) => {
    expect(loginPathFor(path)).toBe("/login");
  });
});

describe("safeNextPath", () => {
  it.each(["/convert", "/convert?x=1", "/billing#plans", "/admin/users"])("keeps %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "javascript:alert(1)",
    "dashboard",
  ])("falls back to /dashboard for %j", (path) => {
    expect(safeNextPath(path)).toBe("/dashboard");
  });
});
