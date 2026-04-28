import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const adminReportsSource = readFileSync(new URL("./AdminReports.tsx", import.meta.url), "utf8");

describe("AdminReports regression safeguards", () => {
  it("renders revenue bars inside a full-height chart container so months with data remain visible", () => {
    expect(adminReportsSource).toContain('const hasAnyRevenue = data.some((d) => d.totalRevenue > 0 || d.schadenKosten > 0);');
    expect(adminReportsSource).toContain('className="flex h-56 items-end gap-2 w-full rounded-xl border border-[#e3edf3] bg-white/80 px-3 pb-6 pt-4"');
    expect(adminReportsSource).toContain('className="flex h-full flex-1 flex-col items-center justify-end gap-2"');
  });

  it("keeps damage and complaint empty states actionable by linking operators back to orders", () => {
    expect(adminReportsSource).toContain("Keine Schadensfälle im gewählten Zeitraum");
    expect(adminReportsSource).toContain("Zu den Aufträgen");
    expect(adminReportsSource).toContain("Keine Beschwerden im gewählten Zeitraum");
    expect(adminReportsSource).toContain("Beschwerden über Aufträge pflegen");
    expect(adminReportsSource).toContain("navigate('/orders')");
  });
});
