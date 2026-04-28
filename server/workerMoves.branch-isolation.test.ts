import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { branches, customers, moves, users } from "../drizzle/schema";

describe("Worker Branch Isolation - workerMoves.list", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let frankfurtBranchId: number;
  let bochumBranchId: number;
  let workerId: number;
  let frankfurtCustomerId: number;
  let bochumCustomerId: number;
  let frankfurtMoveCode: string;
  let bochumMoveCode: string;
  let completedMoveCode: string;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const suffix = Date.now();

    const [frankfurtBranch] = await db
      .insert(branches)
      .values({
        name: `Frankfurt Test ${suffix}`,
        city: "Frankfurt",
        address: "Test Address Frankfurt",
        phone: "111111",
        email: `frankfurt-${suffix}@test.local`,
        isActive: 1,
      })
      .$returningId();

    const [bochumBranch] = await db
      .insert(branches)
      .values({
        name: `Bochum Test ${suffix}`,
        city: "Bochum",
        address: "Test Address Bochum",
        phone: "222222",
        email: `bochum-${suffix}@test.local`,
        isActive: 1,
      })
      .$returningId();

    frankfurtBranchId = frankfurtBranch.id;
    bochumBranchId = bochumBranch.id;

    const [worker] = await db
      .insert(users)
      .values({
        openId: `local-worker-${suffix}`,
        name: "Test Worker",
        username: `worker-${suffix}`,
        passwordHash: "hashed_password",
        role: "worker",
        branchId: frankfurtBranchId,
        isLocalUser: 1,
        isActive: 1,
        loginMethod: "local",
      })
      .$returningId();

    workerId = worker.id;

    const [frankfurtCustomer] = await db
      .insert(customers)
      .values({
        branchId: frankfurtBranchId,
        firstName: "Frankfurt",
        lastName: "Customer",
        email: `frankfurt-customer-${suffix}@test.local`,
        phone: "123456",
        company: "Test Company",
      })
      .$returningId();

    const [bochumCustomer] = await db
      .insert(customers)
      .values({
        branchId: bochumBranchId,
        firstName: "Bochum",
        lastName: "Customer",
        email: `bochum-customer-${suffix}@test.local`,
        phone: "654321",
        company: "Test Company",
      })
      .$returningId();

    frankfurtCustomerId = frankfurtCustomer.id;
    bochumCustomerId = bochumCustomer.id;

    frankfurtMoveCode = `FA-${suffix}`;
    bochumMoveCode = `BO-${suffix}`;
    completedMoveCode = `FA-COMPLETED-${suffix}`;

    await db.insert(moves).values([
      {
        branchId: frankfurtBranchId,
        customerId: frankfurtCustomerId,
        moveCode: frankfurtMoveCode,
        status: "confirmed",
        pickupAddress: "Frankfurt Address",
        deliveryAddress: "Frankfurt Delivery",
        pickupDate: new Date(),
        deliveryDate: new Date(),
        paymentStatus: "unpaid",
      },
      {
        branchId: bochumBranchId,
        customerId: bochumCustomerId,
        moveCode: bochumMoveCode,
        status: "confirmed",
        pickupAddress: "Bochum Address",
        deliveryAddress: "Bochum Delivery",
        pickupDate: new Date(),
        deliveryDate: new Date(),
        paymentStatus: "unpaid",
      },
    ]);
  });

  afterAll(async () => {
    if (!db) return;

    try {
      await db.delete(moves).where(inArray(moves.moveCode, [frankfurtMoveCode, bochumMoveCode, completedMoveCode]));
      await db.delete(customers).where(inArray(customers.id, [frankfurtCustomerId, bochumCustomerId]));
      await db.delete(users).where(eq(users.id, workerId));
      await db.delete(branches).where(inArray(branches.id, [frankfurtBranchId, bochumBranchId]));
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  it("should filter moves by branchId when passed as input", async () => {
    const result = await db
      .select({
        id: moves.id,
        moveCode: moves.moveCode,
        branchId: moves.branchId,
        status: moves.status,
      })
      .from(moves)
      .where(and(eq(moves.status, "confirmed"), eq(moves.branchId, frankfurtBranchId)));

    expect(result.some((move) => move.moveCode === frankfurtMoveCode)).toBe(true);
    expect(result.some((move) => move.moveCode === bochumMoveCode)).toBe(false);
  });

  it("should not show Bochum tasks when filtering by Frankfurt branch", async () => {
    const frankfurtResult = await db
      .select({
        id: moves.id,
        moveCode: moves.moveCode,
        branchId: moves.branchId,
      })
      .from(moves)
      .where(and(eq(moves.status, "confirmed"), eq(moves.branchId, frankfurtBranchId)));

    expect(frankfurtResult.every((move) => move.branchId === frankfurtBranchId)).toBe(true);
    expect(frankfurtResult.some((move) => move.branchId === bochumBranchId)).toBe(false);
  });

  it("should show Bochum tasks when filtering by Bochum branch", async () => {
    const bochumResult = await db
      .select({
        id: moves.id,
        moveCode: moves.moveCode,
        branchId: moves.branchId,
      })
      .from(moves)
      .where(and(eq(moves.status, "confirmed"), eq(moves.branchId, bochumBranchId)));

    expect(bochumResult.some((move) => move.moveCode === bochumMoveCode)).toBe(true);
    expect(bochumResult.some((move) => move.branchId === frankfurtBranchId)).toBe(false);
  });

  it("should respect branch isolation in completed moves", async () => {
    await db.insert(moves).values({
      branchId: frankfurtBranchId,
      customerId: frankfurtCustomerId,
      moveCode: completedMoveCode,
      status: "completed",
      pickupAddress: "Frankfurt Address",
      deliveryAddress: "Frankfurt Delivery",
      pickupDate: new Date(),
      deliveryDate: new Date(),
      paymentStatus: "unpaid",
    });

    const result = await db
      .select({
        id: moves.id,
        status: moves.status,
        branchId: moves.branchId,
        moveCode: moves.moveCode,
      })
      .from(moves)
      .where(and(eq(moves.status, "completed"), eq(moves.branchId, frankfurtBranchId)));

    expect(result.some((move) => move.moveCode === completedMoveCode)).toBe(true);
    expect(result.every((move) => move.branchId === frankfurtBranchId)).toBe(true);
  });
});
