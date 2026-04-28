import { describe, expect, it } from "vitest";

describe("manager local login helpers", () => {
  it("recognizes only the fixed manager email address", async () => {
    const { MANAGER_LOGIN_EMAIL, isManagerLoginEmail } = await import("./_core/managerLogin");

    expect(MANAGER_LOGIN_EMAIL).toBe("info.fr@move-profis.de");
    expect(isManagerLoginEmail("info.fr@move-profis.de")).toBe(true);
    expect(isManagerLoginEmail(" INFO.FR@MOVE-PROFIS.DE ")).toBe(true);
    expect(isManagerLoginEmail("other@example.com")).toBe(false);
  });

  it("builds a reset URL that points back to the login screen with the reset token", async () => {
    const { getManagerPasswordResetUrl } = await import("./_core/managerLogin");
    const url = new URL(getManagerPasswordResetUrl("https://umzug.example.com/", "token-123"));

    expect(url.origin).toBe("https://umzug.example.com");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("adminResetToken")).toBe("token-123");
  });

  it("creates and verifies a signed manager password reset token", async () => {
    const { createManagerPasswordResetToken, verifyManagerPasswordResetToken } = await import("./_core/managerLogin");

    const token = await createManagerPasswordResetToken({
      openId: "manager-open-id",
      passwordFingerprint: "fingerprint-123",
    });

    const payload = await verifyManagerPasswordResetToken(token);
    expect(payload).toEqual({
      openId: "manager-open-id",
      passwordFingerprint: "fingerprint-123",
    });
  });
});
