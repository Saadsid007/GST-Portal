import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifySearchEngines, resetIndexingTokenCache } from "@/lib/seo/indexing";

/**
 * A search-engine ping must never be able to fail a deploy or a request. These cases
 * exercise the failure paths deliberately — a throw escaping this module would take
 * the whole notify step down with it.
 */
describe("notifySearchEngines", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetIndexingTokenCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("makes no network call when no provider is configured", async () => {
    const results = await notifySearchEngines(["/pricing", "/features"]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.submitted === 0)).toBe(true);
  });

  it("reports both providers without throwing", async () => {
    const results = await notifySearchEngines("/pricing");

    expect(results.map((result) => result.provider).sort()).toEqual(["google", "indexnow"]);
    for (const result of results) {
      expect(typeof result.ok).toBe("boolean");
      expect(typeof result.message).toBe("string");
    }
  });

  it("returns an empty array for an empty input rather than pinging", async () => {
    await expect(notifySearchEngines([])).resolves.toEqual([]);
    await expect(notifySearchEngines(["", ""])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never rejects when fetch itself rejects", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    await expect(notifySearchEngines(["/pricing"], "URL_DELETED")).resolves.toBeInstanceOf(Array);
  });

  it("de-duplicates URLs and resolves relative paths to absolute", async () => {
    const results = await notifySearchEngines(["/pricing", "/pricing"]);

    // Unconfigured providers report the input size via `skipped`.
    expect(results[0]?.skipped).toBe(1);
  });

  it("accepts an already-absolute URL unchanged", async () => {
    const results = await notifySearchEngines(["https://example.test/blog/post", "/blog/post"]);

    expect(results[0]?.skipped).toBe(2);
  });
});
