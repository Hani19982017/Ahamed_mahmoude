import { beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import {
  authenticateLocalCredentials,
  createLocalUser,
  findLocalUserByUsername,
  hashPassword,
  verifyPassword,
} from "./_core/localAuth";

describe("Local Authentication - Username Only", () => {
  const usernames = ["testworker", "testworker-duplicate", "missing-worker", "admin-local-login"];

  beforeEach(async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    await db.delete(users).where(inArray(users.username, usernames));
  });

  it("hashes and verifies passwords correctly", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeTruthy();
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword123!", hash)).resolves.toBe(false);
  });

  it("creates a local user with username and password without requiring email", async () => {
    const result = await createLocalUser({
      name: "Test Worker",
      username: "testworker",
      password: "TestPassword123!",
      role: "worker",
      branchId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBeTypeOf("number");

    const createdUser = await findLocalUserByUsername("testworker");
    expect(createdUser).toBeTruthy();
    expect(createdUser?.username).toBe("testworker");
    expect(createdUser?.role).toBe("worker");
    expect(createdUser?.branchId).toBe(1);
    expect(createdUser?.isLocalUser).toBe(1);
    expect(createdUser?.passwordHash).toBeTruthy();
    expect(createdUser?.localEmail ?? null).toBeNull();
  });

  it("finds users by username and returns null for missing usernames", async () => {
    await createLocalUser({
      name: "Duplicate Test",
      username: "testworker-duplicate",
      password: "TestPassword123!",
      role: "admin",
      branchId: null,
    });

    const found = await findLocalUserByUsername("testworker-duplicate");
    const missing = await findLocalUserByUsername("missing-worker");

    expect(found?.username).toBe("testworker-duplicate");
    expect(found?.role).toBe("admin");
    expect(missing).toBeNull();
  });

  it("rejects duplicate usernames for local users", async () => {
    const first = await createLocalUser({
      name: "First User",
      username: "testworker",
      password: "TestPassword123!",
      role: "worker",
      branchId: 1,
    });

    const second = await createLocalUser({
      name: "Second User",
      username: "testworker",
      password: "AnotherPassword123!",
      role: "supervisor",
      branchId: 1,
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.error).toMatch(/Benutzername|مستخدم/i);

    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const savedUsers = await db.select().from(users).where(eq(users.username, "testworker"));
    expect(savedUsers).toHaveLength(1);
  });

  it("authenticates non-admin local users through username and password", async () => {
    await createLocalUser({
      name: "Worker Login",
      username: "testworker",
      password: "TestPassword123!",
      role: "worker",
      branchId: 1,
    });

    const result = await authenticateLocalCredentials({
      username: "testworker",
      password: "TestPassword123!",
      loginType: "staff",
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.user?.username).toBe("testworker");
    expect(result.user?.role).toBe("worker");
  });

  it("rejects admin accounts from the local username/password path", async () => {
    await createLocalUser({
      name: "Admin Login",
      username: "admin-local-login",
      password: "AdminPassword123!",
      role: "admin",
      branchId: null,
    });

    const result = await authenticateLocalCredentials({
      username: "admin-local-login",
      password: "AdminPassword123!",
      loginType: "staff",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain("info.fr@move-profis.de");
  });
});
