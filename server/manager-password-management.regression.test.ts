import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const dashboardLayoutSource = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
const managerDialogSource = readFileSync(new URL("../client/src/components/ManagerPasswordDialog.tsx", import.meta.url), "utf8");
const localAuthSource = readFileSync(new URL("./_core/localAuth.ts", import.meta.url), "utf8");
const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("manager password management regression safeguards", () => {
  it("keeps an in-system manager password change dialog in the authenticated shell", () => {
    expect(dashboardLayoutSource).toContain("ManagerPasswordDialog");
    expect(dashboardLayoutSource).toContain("Manager-Passwort ändern");
    expect(managerDialogSource).toContain("changeManagerPassword");
    expect(managerDialogSource).toContain("info.fr@move-profis.de");
  });

  it("keeps server-side manager password change and reset procedures wired", () => {
    expect(localAuthSource).toContain("createManagerPasswordResetLink");
    expect(localAuthSource).toContain("resetManagerPasswordWithToken");
    expect(localAuthSource).toContain("changeManagerPassword");
    expect(routersSource).toContain("requestManagerPasswordReset");
    expect(routersSource).toContain("resetManagerPassword");
    expect(routersSource).toContain("changeManagerPassword");
    expect(routersSource).toContain("notifyOwner");
  });
});
