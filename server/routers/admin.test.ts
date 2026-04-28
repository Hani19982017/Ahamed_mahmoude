import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthUser = NonNullable<TrpcContext["user"]>;

function createContext(role: AuthUser["role"]): TrpcContext {
  const user: AuthUser = {
    id: role === "admin" ? 1 : 2,
    openId: `${role}-user`,
    email: `${role}@example.com`,
    name: `${role} user`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin router", () => {
  it("denies regular users from accessing the financial summary", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(
      caller.admin.financialSummary({ year: 2026, month: 4, branchId: 1 })
    ).rejects.toThrow("Unauthorized");
  });

  it("denies regular users from accessing monthly revenue", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(
      caller.admin.monthlyRevenue({ year: 2026, branchId: 1 })
    ).rejects.toThrow("Unauthorized");
  });

  it("denies regular users from accessing schaden list", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(
      caller.admin.schadenList({ year: 2026, month: 4, branchId: 1 })
    ).rejects.toThrow("Unauthorized");
  });

  it("denies regular users from accessing beschwerde list", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(
      caller.admin.beschwerdeList({ year: 2026, month: 4, branchId: 1 })
    ).rejects.toThrow("Unauthorized");
  });

  it("allows admins to reach the financial summary procedure up to the data layer", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    try {
      const result = await caller.admin.financialSummary({ year: 2026, month: 4, branchId: 1 });
      expect(result).toHaveProperty("totalMoves");
      expect(result).toHaveProperty("netRevenue");
    } catch (error) {
      expect((error as Error).message).toMatch(/Database|Failed query/);
    }
  });

  it("allows admins to reach the monthly revenue procedure up to the data layer", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    try {
      const result = await caller.admin.monthlyRevenue({ year: 2026, branchId: 1 });
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect((error as Error).message).toMatch(/Database|Failed query/);
    }
  });
});
