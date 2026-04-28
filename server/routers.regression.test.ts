import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("routers regression safeguards", () => {
  it("prevents duplicate task creation when a move is confirmed more than once", () => {
    expect(routersSource).toContain("const existingTasks = await db");
    expect(routersSource).toContain("const existingTaskTypes = new Set");
    expect(routersSource).toContain("!existingTaskTypes.has('pickup')");
    expect(routersSource).toContain("!existingTaskTypes.has('delivery')");
  });

  it("promotes the move status to confirmed when status2 becomes Bestätigt", () => {
    expect(routersSource).toContain("const isMoveBeingConfirmed = input.status === 'confirmed' || input.status2 === 'Bestätigt'");
    expect(routersSource).toContain("if (input.status === undefined && input.status2 === 'Bestätigt') {");
    expect(routersSource).toContain("moveUpdate.status = 'confirmed';");
  });

  it("does not duplicate worker tasks through a direct left join on tasks", () => {
    expect(routersSource).not.toContain(".leftJoin(tasks, eq(moves.id, tasks.moveId))");
    expect(routersSource).toContain("let taskMetaByMove: Record<number, { taskId: number | null; taskNotes: string | null }> = {};");
    expect(routersSource).toContain("taskId: taskMetaByMove[move.id]?.taskId ?? null");
    expect(routersSource).toContain("customerPhotos: customerPhotosByMove[move.id] || []");
  });

  it("stores move gross prices as rounded euro values and keeps invoice records in euro strings", () => {
    expect(routersSource).toContain("if (data.grossPrice !== undefined) updateData.grossPrice = Math.round(data.grossPrice);");
    expect(routersSource).toContain("if (input.grossPrice !== undefined) moveUpdate.grossPrice = Math.round(input.grossPrice);");
    expect(routersSource).toContain("amount: String(getInvoiceAmountEuros(move))");
    expect(routersSource).toContain("const totalAmount = input.auditTotalPrice");
    expect(routersSource).toContain("amount: String(totalAmount)");
  });

  it("derives invoice pdf totals in cents from stored euro move prices only at render time", () => {
    expect(routersSource).toContain("const getInvoiceTotalCents = (move: { auditTotalPrice: unknown; grossPrice: unknown }) => {");
    expect(routersSource).toContain("return Math.round(getMoveGrossPriceEuros(move.grossPrice) * 100);");
    expect(routersSource).toContain("const totalAmount = getInvoiceTotalCents(move);");
  });
});
