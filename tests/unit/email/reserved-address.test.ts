import { describe, expect, it } from "vitest";
import { isUndeliverableAddress } from "@/features/email/domain/reserved-address";

describe("isUndeliverableAddress", () => {
  it.each([
    "qa.gstpilot+sb1@example.com",
    "QA@Example.COM",
    "a@mail.example.org",
    "deleted.abc@deleted.invalid",
    "x@site.test",
    "x@localhost",
    "no-at-sign@",
  ])("skips %s", (address) => {
    expect(isUndeliverableAddress(address)).toBe(true);
  });

  it.each([
    "someone@gmail.com",
    "ca@firm.co.in",
    "owner@examples.com",
    "me@notexample.com",
    "team@gstpilot.cloud",
  ])("delivers to %s", (address) => {
    expect(isUndeliverableAddress(address)).toBe(false);
  });
});
