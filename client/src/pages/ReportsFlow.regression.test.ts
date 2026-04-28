import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const workerDashboardSource = readFileSync(new URL("./WorkerDashboard.tsx", import.meta.url), "utf8");
const moveDetailDialogSource = readFileSync(new URL("../components/MoveDetailDialog.tsx", import.meta.url), "utf8");

describe("reports flow regression safeguards", () => {
  it("keeps worker reporting wired for both damage and complaint flows", () => {
    expect(workerDashboardSource).toContain('reportType === "schaden"');
    expect(workerDashboardSource).toContain('reportSchadenMutation.mutate({ moveId: selectedTask.id, description: reportDescription, images })');
    expect(workerDashboardSource).toContain('reportBeschwerdeM.mutate({ moveId: selectedTask.id, description: reportDescription, images })');
    expect(workerDashboardSource).toContain('تقرير تلف');
    expect(workerDashboardSource).toContain('تقرير شكوى');
  });

  it("keeps order detail editing wired to persisted damage and complaint fields", () => {
    expect(moveDetailDialogSource).toContain('schadenDescription: schadenDesc');
    expect(moveDetailDialogSource).toContain('schadenStatus, beschwerdeDescription: beschwerdeDesc, beschwerdeSchweregard');
    expect(moveDetailDialogSource).toContain('setSchadenDesc(move.schadenDescription || "")');
    expect(moveDetailDialogSource).toContain('setBeschwerdeDesc(move.beschwerdeDescription || "")');
    expect(moveDetailDialogSource).toContain('Schaden (Damage Report)');
    expect(moveDetailDialogSource).toContain('Beschwerde (Complaint)');
  });
});
