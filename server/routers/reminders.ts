/**
 * Customer reminders router.
 *
 * Endpoints:
 *   - reminders.list   → fetches reminder records (with branch isolation)
 *   - reminders.delete → soft-deletes a reminder when the customer is "done"
 *
 * Permissions:
 *   - admin: full access, sees ALL branches
 *   - sales: full access, but only sees their OWN branch
 *   - everyone else: forbidden
 */

import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { customerReminders } from "../../drizzle/schema";

const ALLOWED_ROLES = ["admin", "sales"] as const;

export const remindersRouter = router({
  /**
   * List reminders.
   * - admin sees all branches
   * - sales sees only their own branch
   *
   * Each row is annotated with `colorState` ("green" | "yellow") computed
   * server-side based on hours since `lastUpdatedAt`.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ALLOWED_ROLES.includes(ctx.user.role as any)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Keine Berechtigung für Erinnerungen",
      });
    }

    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(customerReminders)
      .orderBy(desc(customerReminders.lastUpdatedAt));

    // Branch isolation for non-admins
    const filtered =
      ctx.user.role === "admin"
        ? rows
        : rows.filter(r => r.branchId === ctx.user.branchId);

    const now = Date.now();
    const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

    return filtered.map(r => {
      const last = new Date(r.lastUpdatedAt).getTime();
      const elapsed = now - last;
      const colorState: "green" | "yellow" =
        elapsed >= TWO_DAYS_MS ? "green" : "yellow";
      return {
        ...r,
        colorState,
        hoursSinceUpdate: Math.floor(elapsed / (60 * 60 * 1000)),
      };
    });
  }),

  /**
   * Delete a reminder when the customer follow-up is complete.
   * Admin can delete any; sales can only delete reminders in their branch.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_ROLES.includes(ctx.user.role as any)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Keine Berechtigung zum Löschen",
        });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Branch isolation check for sales
      if (ctx.user.role === "sales") {
        const existing = await db
          .select()
          .from(customerReminders)
          .where(eq(customerReminders.id, input.id))
          .limit(1);
        if (existing.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Erinnerung nicht gefunden",
          });
        }
        if (existing[0].branchId !== ctx.user.branchId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Diese Erinnerung gehört zu einer anderen Filiale",
          });
        }
      }

      await db
        .delete(customerReminders)
        .where(eq(customerReminders.id, input.id));

      return { success: true };
    }),
});
