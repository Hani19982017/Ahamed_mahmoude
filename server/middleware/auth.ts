import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";

/**
 * Middleware to check if user is admin
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action",
    });
  }
  return next({ ctx });
});

/**
 * Middleware to check if user is supervisor or admin
 */
export const supervisorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user?.role !== "admin" && ctx.user?.role !== "supervisor") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action",
    });
  }
  return next({ ctx });
});

/**
 * Middleware to check if user is worker, supervisor, or admin
 */
export const workerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const allowedRoles = ["admin", "worker", "supervisor"];
  if (!ctx.user?.role || !allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action",
    });
  }
  return next({ ctx });
});
