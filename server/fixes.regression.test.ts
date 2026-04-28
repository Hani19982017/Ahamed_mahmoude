import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routersContent = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const contextContent = readFileSync(new URL("./_core/context.ts", import.meta.url), "utf8");
const indexContent = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const appContent = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("Branch isolation — moves endpoints", () => {
  it("exports an assertBranchAccess helper from context", () => {
    expect(contextContent).toContain("export function assertBranchAccess");
    expect(contextContent).toContain("FORBIDDEN");
  });

  it("enforces branch access on moves.update", () => {
    // Anchor to the 'update' key under the moves router, ignoring workerMoves.updateNotes etc.
    const idx = routersContent.indexOf("update: protectedProcedure");
    expect(idx).toBeGreaterThan(-1);
    // Look at a 1200-char window around the first moves.update mutation body.
    const window = routersContent.slice(idx, idx + 1200);
    expect(window).toContain("assertBranchAccess(ctx.user, existingMove.branchId)");
  });

  it("enforces branch access on moves.getById", () => {
    const idx = routersContent.indexOf("getById: protectedProcedure");
    expect(idx).toBeGreaterThan(-1);
    const window = routersContent.slice(idx, idx + 800);
    expect(window).toContain("assertBranchAccess(ctx.user, move.branchId)");
  });

  it("enforces branch access on moves.delete", () => {
    const idx = routersContent.indexOf("delete: protectedProcedure");
    expect(idx).toBeGreaterThan(-1);
    const window = routersContent.slice(idx, idx + 800);
    expect(window).toContain("assertBranchAccess(ctx.user, existingMove.branchId)");
  });

  it("enforces branch access on generateInvoice", () => {
    const idx = routersContent.indexOf("generateInvoice: protectedProcedure");
    expect(idx).toBeGreaterThan(-1);
    const window = routersContent.slice(idx, idx + 1500);
    expect(window).toContain("assertBranchAccess(ctx.user, move.branchId)");
  });

  it("enforces branch access on fullUpdate", () => {
    const idx = routersContent.indexOf("fullUpdate: protectedProcedure");
    expect(idx).toBeGreaterThan(-1);
    const window = routersContent.slice(idx, idx + 3000);
    expect(window).toContain("assertBranchAccess(ctx.user, existingMove.branchId)");
  });

  it("enforces branch access on workerMoves write operations", () => {
    for (const endpoint of ["reportSchaden", "reportBeschwerde", "complete", "updatePayment"]) {
      const idx = routersContent.indexOf(`${endpoint}: protectedProcedure`);
      expect(idx, `${endpoint} should exist`).toBeGreaterThan(-1);
      const window = routersContent.slice(idx, idx + 1500);
      expect(window, `${endpoint} should assert branch access`).toContain("assertBranchAccess");
    }
  });
});

describe("Price precision — grossPrice should preserve 2 decimals", () => {
  it("does not blindly Math.round grossPrice to an integer", () => {
    // The old buggy form was `Math.round(input.grossPrice)` — make sure no line matches it.
    const bugLines = routersContent
      .split("\n")
      .filter((line) => /Math\.round\(\s*(?:input\.|data\.)?grossPrice\s*\)/.test(line));
    expect(bugLines, "grossPrice must preserve 2-decimal precision").toEqual([]);
  });

  it("uses the cent-rounding pattern for grossPrice", () => {
    expect(routersContent).toContain("Math.round(data.grossPrice * 100) / 100");
    expect(routersContent).toContain("Math.round(input.grossPrice * 100) / 100");
  });
});

describe("Rate limiting — login and password-reset endpoints", () => {
  it("rate-limits /api/auth/admin-login", () => {
    const idx = indexContent.indexOf("/api/auth/admin-login'");
    expect(idx).toBeGreaterThan(-1);
    const window = indexContent.slice(idx, idx + 1500);
    expect(window).toContain("consumeRateLimit");
    expect(window).toContain("admin-login:");
  });

  it("rate-limits /api/auth/local-login", () => {
    const idx = indexContent.indexOf("/api/auth/local-login'");
    expect(idx).toBeGreaterThan(-1);
    const window = indexContent.slice(idx, idx + 1500);
    expect(window).toContain("consumeRateLimit");
    expect(window).toContain("staff-login:");
  });

  it("rate-limits requestManagerPasswordReset", () => {
    const idx = routersContent.indexOf("requestManagerPasswordReset: publicProcedure");
    expect(idx).toBeGreaterThan(-1);
    const window = routersContent.slice(idx, idx + 2000);
    expect(window).toContain("consumeRateLimit");
    expect(window).toContain("manager-reset:");
  });
});

describe("Frontend route protection", () => {
  it("wraps protected routes with RequireAuth", () => {
    expect(appContent).toContain("import RequireAuth from");
    // Admin dashboard must require the admin role
    expect(appContent).toMatch(/allowedRoles=\{?\[\s*"admin"\s*\]/);
    // Branches management must require the admin role
    const branchesIdx = appContent.indexOf('path={"/branches"}');
    expect(branchesIdx).toBeGreaterThan(-1);
    const branchesBlock = appContent.slice(branchesIdx, branchesIdx + 400);
    expect(branchesBlock).toContain("RequireAuth");
  });

  it("keeps /login and / public", () => {
    // Both Home and LocalLogin are rendered with `component={...}`, not wrapped.
    expect(appContent).toMatch(/path=\{"\/"\}\s+component=\{Home\}/);
    expect(appContent).toMatch(/path=\{"\/login"\}\s+component=\{LocalLogin\}/);
  });
});

describe("Templates authorization", () => {
  it("restricts template upsert to admin and branch_manager", () => {
    const idx = routersContent.indexOf("upsert: protectedProcedure");
    expect(idx).toBeGreaterThan(-1);
    const window = routersContent.slice(idx, idx + 1200);
    expect(window).toContain("allowedRoles = ['admin', 'branch_manager']");
  });

  it("restricts seedDefaults to admin only", () => {
    const idx = routersContent.indexOf("seedDefaults: protectedProcedure");
    expect(idx).toBeGreaterThan(-1);
    const window = routersContent.slice(idx, idx + 1200);
    expect(window).toContain("ctx.user.role !== 'admin'");
  });
});

describe("Worker-less confirmation warnings", () => {
  it("bubbles up warnings when confirming a move without enough workers", () => {
    expect(routersContent).toContain("لا يوجد عمال نشطون في هذا الفرع");
    expect(routersContent).toContain("warnings.push");
    // The mutation returns the warnings array to the UI.
    expect(routersContent).toContain("return { success: true, warnings }");
  });

  it("only counts active workers", () => {
    // Must filter out deactivated workers when deciding whether to create tasks.
    expect(routersContent).toContain("sql`${users.isActive} = 1`");
  });
});
