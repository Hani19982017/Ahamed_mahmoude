import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../db";
import { branchesRouter } from "./branches";

type AuthUser = NonNullable<TrpcContext["user"]>;

type MockDb = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function createContext(role: AuthUser["role"]): TrpcContext {
  const user: AuthUser = {
    id: role === "admin" ? 1 : 2,
    openId: `${role}-user`,
    email: `${role}@example.com`,
    name: `${role} user`,
    loginMethod: "local",
    role,
    branchId: role === "branch_manager" ? 5 : null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as AuthUser;

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createMockDb(): MockDb {
  const selectOrderBy = vi.fn().mockResolvedValue([{ id: 1, name: "Move Frankfurt", city: "Frankfurt", isActive: 1 }]);
  const selectLimit = vi.fn().mockResolvedValue([{ id: 1, name: "Move Frankfurt", city: "Frankfurt", isActive: 1 }]);
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ orderBy: selectOrderBy, where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const insertValues = vi.fn().mockResolvedValue({ insertId: 123 });
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateWhere = vi.fn().mockResolvedValue({ affectedRows: 1 });
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const delWhere = vi.fn().mockResolvedValue({ affectedRows: 0 });
  const del = vi.fn(() => ({ where: delWhere }));

  return {
    select,
    insert,
    update,
    delete: del,
  };
}

describe("branches router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows authenticated users to read branch list", async () => {
    const db = createMockDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const caller = branchesRouter.createCaller(createContext("branch_manager"));
    const result = await caller.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.name).toBe("Move Frankfurt");
  });

  it("prevents non-admin users from creating branches", async () => {
    const caller = branchesRouter.createCaller(createContext("branch_manager"));

    await expect(
      caller.create({
        name: "Move Berlin",
        city: "Berlin",
        address: "Alexanderplatz 1",
        phone: "+49 30 000000",
      })
    ).rejects.toThrow();

    expect(getDb).not.toHaveBeenCalled();
  });

  it("creates branches for admin without depending on email field", async () => {
    const db = createMockDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const caller = branchesRouter.createCaller(createContext("admin"));
    const result = await caller.create({
      name: "Move Hamburg",
      city: "Hamburg",
      address: "Hafenstraße 10",
      phone: "+49 40 000000",
    });

    expect(result).toEqual({ success: true, branchId: 123 });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.delete).not.toHaveBeenCalled();

    const insertedPayload = db.insert.mock.results[0]?.value.values.mock.calls[0][0];
    expect(insertedPayload).toMatchObject({
      name: "Move Hamburg",
      city: "Hamburg",
      address: "Hafenstraße 10",
      phone: "+49 40 000000",
      isActive: 1,
    });
    expect(insertedPayload).not.toHaveProperty("email");
  });

  it("deactivates branches instead of deleting them permanently", async () => {
    const db = createMockDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const caller = branchesRouter.createCaller(createContext("admin"));
    const result = await caller.deactivate({ branchId: 9 });

    expect(result).toEqual({ success: true });
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.delete).not.toHaveBeenCalled();

    const updatePayload = db.update.mock.results[0]?.value.set.mock.calls[0][0];
    expect(updatePayload).toMatchObject({ isActive: 0 });
  });

  it("reactivates deactivated branches for admin", async () => {
    const db = createMockDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const caller = branchesRouter.createCaller(createContext("admin"));
    const result = await caller.reactivate({ branchId: 9 });

    expect(result).toEqual({ success: true });
    const updatePayload = db.update.mock.results[0]?.value.set.mock.calls[0][0];
    expect(updatePayload).toMatchObject({ isActive: 1 });
  });
});
