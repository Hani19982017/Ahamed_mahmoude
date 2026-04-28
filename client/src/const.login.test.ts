import { afterEach, describe, expect, it, vi } from "vitest";

describe("manager email login entry", () => {
  const originalWindow = globalThis.window;
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    vi.resetModules();
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    }
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", originalEnv.VITE_OAUTH_PORTAL_URL ?? "");
    vi.stubEnv("VITE_APP_ID", originalEnv.VITE_APP_ID ?? "");
  });

  it("builds an OAuth email login URL that returns to the app callback", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          origin: "https://umzug.example.com",
        },
      },
      configurable: true,
    });

    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://portal.example.com");
    vi.stubEnv("VITE_APP_ID", "app-123");

    const { getLoginUrl } = await import("./const");
    const loginUrl = new URL(getLoginUrl());

    expect(loginUrl.origin).toBe("https://portal.example.com");
    expect(loginUrl.pathname).toBe("/app-auth");
    expect(loginUrl.searchParams.get("appId")).toBe("app-123");
    expect(loginUrl.searchParams.get("type")).toBe("signIn");
    expect(loginUrl.searchParams.get("redirectUri")).toBe("https://umzug.example.com/api/oauth/callback");
    expect(loginUrl.searchParams.get("state")).toBe(btoa("https://umzug.example.com/api/oauth/callback"));
  });
});
