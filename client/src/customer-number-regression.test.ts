import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const newCustomerSource = readFileSync(new URL("./pages/NewCustomer.tsx", import.meta.url), "utf8");
const adminDashboardSource = readFileSync(new URL("./pages/AdminDashboard.tsx", import.meta.url), "utf8");
const ordersSource = readFileSync(new URL("./pages/Orders.tsx", import.meta.url), "utf8");
const moveDetailDialogSource = readFileSync(new URL("./components/MoveDetailDialog.tsx", import.meta.url), "utf8");

describe("customer number regression safeguards", () => {
  it("keeps Kundennummer inside ready-made customer messages", () => {
    expect(newCustomerSource).toContain("Ihre Kundennummer lautet ${code}");
    expect(newCustomerSource).toContain("Kundennummer (${code})");
    expect(newCustomerSource).toContain("Verwendungszweck: (Ihre Kundennummer ${code})");
    expect(moveDetailDialogSource).toContain("Kundennummer: ${code}");
    expect(moveDetailDialogSource).toContain("Field label=\"Kundennummer\"");
  });

  it("uses Kundennummer as the primary search key in admin and orders screens", () => {
    expect(adminDashboardSource).toContain("const kundenummer = formatCustomerNumber(m.customerId)?.toLowerCase();");
    expect(adminDashboardSource).not.toContain("m.moveCode?.toLowerCase().includes(q)");
    expect(ordersSource).toContain("const kundenummer = formatCustomerNumber(m.customerId)?.toLowerCase();");
    expect(ordersSource).not.toContain("m.moveCode?.toLowerCase().includes(q)");
  });
});
