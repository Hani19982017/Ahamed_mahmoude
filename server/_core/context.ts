import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

/**
 * Helper to get the effective branchId for filtering:
 * - admin with selectedBranchId: use selectedBranchId
 * - admin without: null (see all)
 * - everyone else: their own branchId
 */
export function getEffectiveBranchId(
  user: User | null,
  selectedBranchId?: number | null
): number | null {
  if (!user) return null;
  if (user.role === 'admin') {
    return selectedBranchId ?? null; // null = all branches
  }
  return user.branchId ?? null;
}

/**
 * Enforces branch ownership for a given resource branchId.
 * Throws "FORBIDDEN" if the user cannot access this branch.
 *
 * Rules:
 * - admin: can access any branch
 * - anyone else: can only access their own branch
 */
export function assertBranchAccess(
  user: User | null,
  resourceBranchId: number | null | undefined
): void {
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.role === 'admin') return; // admin sees all
  if (!user.branchId) throw new Error("FORBIDDEN: لا يوجد فرع مخصص لك");
  if (resourceBranchId !== user.branchId) {
    throw new Error("FORBIDDEN: لا يمكنك الوصول إلى بيانات فرع آخر");
  }
}
