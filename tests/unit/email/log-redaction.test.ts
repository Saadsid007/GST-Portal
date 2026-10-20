import { describe, expect, it } from "vitest";
import { redactSubjectForLog } from "@/features/email/domain/log-redaction";

describe("redactSubjectForLog", () => {
  it("masks the code in a verification subject", () => {
    expect(redactSubjectForLog("Your GSTPilot Verification Code: 211746")).toBe(
      "Your GSTPilot Verification Code: ••••••"
    );
  });

  it("leaves ordinary subjects alone", () => {
    expect(redactSubjectForLog("Welcome to GSTPilot — Your 30-Day Free Trial is Active!")).toBe(
      "Welcome to GSTPilot — Your 30-Day Free Trial is Active!"
    );
  });
});
