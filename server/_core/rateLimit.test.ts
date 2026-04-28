import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeRateLimit, __resetRateLimitStateForTests } from "./rateLimit";

afterEach(() => {
  __resetRateLimitStateForTests();
  vi.useRealTimers();
});

describe("consumeRateLimit", () => {
  it("allows requests up to the max, then blocks further ones", () => {
    const key = "test-key";
    const options = { max: 3, windowMs: 60_000 };

    const r1 = consumeRateLimit(key, options);
    const r2 = consumeRateLimit(key, options);
    const r3 = consumeRateLimit(key, options);
    const r4 = consumeRateLimit(key, options);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  it("reports a decreasing remaining count", () => {
    const key = "decreasing";
    const options = { max: 3, windowMs: 60_000 };

    expect(consumeRateLimit(key, options).remaining).toBe(2);
    expect(consumeRateLimit(key, options).remaining).toBe(1);
    expect(consumeRateLimit(key, options).remaining).toBe(0);
  });

  it("isolates buckets by key", () => {
    const options = { max: 1, windowMs: 60_000 };

    expect(consumeRateLimit("ip:1.1.1.1", options).allowed).toBe(true);
    expect(consumeRateLimit("ip:1.1.1.1", options).allowed).toBe(false);
    // Different key starts fresh.
    expect(consumeRateLimit("ip:2.2.2.2", options).allowed).toBe(true);
  });

  it("resets the bucket once the window has elapsed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));

    const key = "reset";
    const options = { max: 2, windowMs: 60_000 };

    expect(consumeRateLimit(key, options).allowed).toBe(true);
    expect(consumeRateLimit(key, options).allowed).toBe(true);
    expect(consumeRateLimit(key, options).allowed).toBe(false);

    // Advance past the window.
    vi.setSystemTime(new Date("2026-04-23T12:01:01Z"));

    expect(consumeRateLimit(key, options).allowed).toBe(true);
  });
});
