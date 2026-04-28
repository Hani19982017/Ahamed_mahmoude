import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const adminDashboardSource = readFileSync(new URL("./AdminDashboard.tsx", import.meta.url), "utf8");

describe("AdminDashboard reports regression safeguards", () => {
  it("keeps the reports tab actionable even when there are no damage or complaint records yet", () => {
    expect(adminDashboardSource).toContain("لا توجد تقارير حتى الآن");
    expect(adminDashboardSource).toContain("يمكن تسجيل التلف أو الشكوى من متابعة الطلبات أو من لوحة العامل");
    expect(adminDashboardSource).toContain("الذهاب إلى الطلبات");
    expect(adminDashboardSource).toContain("فتح لوحة العامل");
    expect(adminDashboardSource).toContain("navigate('/orders')");
    expect(adminDashboardSource).toContain("navigate('/worker')");
  });
});
