import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The limiter is the only thing standing between the unauthenticated OTP
 * endpoints and an email bomb / brute-force oracle, so its window arithmetic is
 * worth pinning down. Prisma is mocked: this asserts the decision logic, not the
 * database.
 */
const store = new Map<string, { key: string; count: number; resetAt: Date }>();

vi.mock("@/lib/prisma", () => ({
  default: {
    rateLimit: {
      findUnique: vi.fn(
        async ({ where }: { where: { key: string } }) => store.get(where.key) ?? null
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { key: string };
          create: { key: string; count: number; resetAt: Date };
        }) => {
          const row = { ...create, key: where.key };
          store.set(where.key, row);
          return row;
        }
      ),
      update: vi.fn(async ({ where }: { where: { key: string } }) => {
        const row = store.get(where.key)!;
        row.count += 1;
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
        store.delete(where.key);
        return { count: 1 };
      }),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const { consumeRateLimit, resetRateLimit, retryAfterMessage, RATE_LIMITS } =
  await import("@/lib/rate-limit");

beforeEach(() => store.clear());

describe("consumeRateLimit", () => {
  it("allows requests up to the configured limit, then blocks", async () => {
    const limit = RATE_LIMITS.otpRequest.limit;

    for (let i = 0; i < limit; i++) {
      const res = await consumeRateLimit("otpRequest", "user@example.com");
      expect(res.allowed).toBe(true);
    }

    const blocked = await consumeRateLimit("otpRequest", "user@example.com");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("counts each subject separately", async () => {
    for (let i = 0; i < RATE_LIMITS.otpRequest.limit; i++) {
      await consumeRateLimit("otpRequest", "a@example.com");
    }
    expect((await consumeRateLimit("otpRequest", "a@example.com")).allowed).toBe(false);
    expect((await consumeRateLimit("otpRequest", "b@example.com")).allowed).toBe(true);
  });

  it("treats an address case-insensitively, so casing cannot reset the counter", async () => {
    for (let i = 0; i < RATE_LIMITS.otpRequest.limit; i++) {
      await consumeRateLimit("otpRequest", "victim@example.com");
    }
    const evasion = await consumeRateLimit("otpRequest", "VICTIM@Example.com");
    expect(evasion.allowed).toBe(false);
  });

  it("counts each action separately", async () => {
    for (let i = 0; i < RATE_LIMITS.otpRequest.limit; i++) {
      await consumeRateLimit("otpRequest", "user@example.com");
    }
    expect((await consumeRateLimit("otpVerify", "user@example.com")).allowed).toBe(true);
  });

  it("starts a fresh window once the previous one has expired", async () => {
    const start = new Date("2026-08-24T10:00:00Z");
    for (let i = 0; i < RATE_LIMITS.otpRequest.limit; i++) {
      await consumeRateLimit("otpRequest", "user@example.com", start);
    }
    expect((await consumeRateLimit("otpRequest", "user@example.com", start)).allowed).toBe(false);

    const afterWindow = new Date(start.getTime() + RATE_LIMITS.otpRequest.windowMs + 1000);
    const res = await consumeRateLimit("otpRequest", "user@example.com", afterWindow);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(RATE_LIMITS.otpRequest.limit - 1);
  });

  it("clears the counter after a completed flow", async () => {
    for (let i = 0; i < RATE_LIMITS.passwordReset.limit; i++) {
      await consumeRateLimit("passwordReset", "user@example.com");
    }
    expect((await consumeRateLimit("passwordReset", "user@example.com")).allowed).toBe(false);

    await resetRateLimit("passwordReset", "user@example.com");
    expect((await consumeRateLimit("passwordReset", "user@example.com")).allowed).toBe(true);
  });
});

describe("limit configuration", () => {
  it("keeps OTP request limits tight enough to stop email bombing", () => {
    // A real user asking for more than a handful of codes in ten minutes is
    // already anomalous; the cost of a wrong guess here is somebody's inbox.
    expect(RATE_LIMITS.otpRequest.limit).toBeLessThanOrEqual(5);
    expect(RATE_LIMITS.otpRequest.windowMs).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it("keeps password-reset attempts far below the 6-digit search space", () => {
    expect(RATE_LIMITS.passwordReset.limit).toBeLessThanOrEqual(10);
  });
});

describe("retryAfterMessage", () => {
  it("rounds up to whole minutes and never says zero", () => {
    const now = new Date("2026-08-24T10:00:00Z");
    expect(retryAfterMessage(new Date("2026-08-24T10:00:30Z"), now)).toContain("1 minute");
    expect(retryAfterMessage(new Date("2026-08-24T10:09:00Z"), now)).toContain("9 minutes");
  });
});
