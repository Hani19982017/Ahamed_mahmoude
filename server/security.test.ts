import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const schemaContent = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const sdkContent = readFileSync(new URL("./_core/sdk.ts", import.meta.url), "utf8");
const localAuthContent = readFileSync(new URL("./_core/localAuth.ts", import.meta.url), "utf8");
const routersContent = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("Security: deactivated user access control", () => {
  it("keeps the isActive field in the users schema", () => {
    expect(schemaContent).toContain("isActive");
  });

  it("blocks deactivated users in authenticateRequest", () => {
    expect(sdkContent).toContain("isActive === 0");
    expect(sdkContent).toContain("Account is deactivated");
  });

  it("blocks deactivated users in the local login flow", () => {
    expect(localAuthContent).toContain("user.isActive === 0");
    expect(localAuthContent).toContain("Konto deaktiviert");
  });

  it("uses soft delete instead of hard deleting user rows", () => {
    expect(routersContent).toContain("isActive: 0");
    expect(routersContent).toContain("Soft delete");
    expect(routersContent).not.toContain("await db.delete(users)");
  });

  it("filters deactivated users out of the users list", () => {
    expect(routersContent).toContain("sql`${users.isActive} = 1`");
  });

  it("checks the deactivated state before OAuth sync in authenticateRequest", () => {
    const authMethodStart = sdkContent.indexOf("async authenticateRequest");
    expect(authMethodStart).toBeGreaterThan(-1);

    const authMethodBody = sdkContent.slice(authMethodStart);
    const deactivationCheckIndex = authMethodBody.indexOf("deactivatedUser");
    const oauthSyncIndex = authMethodBody.indexOf("getUserInfoWithJwt");

    expect(deactivationCheckIndex).toBeGreaterThan(-1);
    expect(oauthSyncIndex).toBeGreaterThan(-1);
    expect(deactivationCheckIndex).toBeLessThan(oauthSyncIndex);
  });
});
