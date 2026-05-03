/**
 * Customer reminders router (v2 — manual-date model).
 *
 * Behavior:
 *  - The list shows ONLY customers whose reminderDate has arrived
 *    (reminderDate IS NOT NULL AND reminderDate <= TODAY).
 *  - Customers without a reminder date are hidden.
 *  - All visible rows are "due" — there is no yellow/green distinction.
 *    The UI always renders a green dot.
 *
 * Endpoints:
 *  - reminders.list   → fetches due reminders (with branch isolation)
 *  - reminders.update → updates reminderDate and/or versuch from the dialog
 *  - reminders.clear  → clears reminderDate (hides the customer from the list)
 *  - reminders.delete → permanently deletes the reminder record
 *
 * Permissions:
 *  - admin: full access, sees ALL branches
 *  - sales: full access, but only sees their OWN branch
 *  - everyone else: forbidden
 */

import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { customerReminders } from "../../drizzle/schema";

const ALLOWED_ROLES = ["admin", "sales"] as const;

/** Returns today's date as a Date object representing midnight UTC. */
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function ensureAllowed(role: string | undefined): asserts role is "admin" | "sales" {
  if (!ALLOWED_ROLES.includes(role as any)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Keine Berechtigung für Erinnerungen",
    });
  }
}

export const remindersRouter = router({
  /**
   * Returns reminders that are due today or earlier.
   * Customers without a reminderDate are excluded — the section appears
   * empty when no follow-up is due.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    ensureAllowed(ctx.user.role);

    const db = await getDb();
    if (!db) return [];

    const today = todayDateOnly();

    // Branch isolation: admin sees all, sales only their own branch.
    const branchFilter =
      ctx.user.role === "admin"
        ? undefined
        : eq(customerReminders.branchId, ctx.user.branchId ?? -1);

    const whereClause = branchFilter
      ? and(
          isNotNull(customerReminders.reminderDate),
          lte(customerReminders.reminderDate, today),
          branchFilter,
        )
      : and(
          isNotNull(customerReminders.reminderDate),
          lte(customerReminders.reminderDate, today),
        );

    const rows = await db
      .select()
      .from(customerReminders)
      .where(whereClause)
      .orderBy(customerReminders.reminderDate);

    // The frontend treats every visible row as "green" (due), so we don't
    // compute a color server-side anymore. We still expose hoursSinceUpdate
    // for any UI that wants to show "X days overdue".
    const now = Date.now();
    return rows.map((r) => ({
      ...r,
      colorState: "green" as const,
      hoursSinceUpdate: Math.floor((now - new Date(r.lastUpdatedAt).getTime()) / (60 * 60 * 1000)),
    }));
  }),

  /**
   * Update a reminder's date and/or attempt count from the edit dialog.
   * - `reminderDate` accepts YYYY-MM-DD string, or null to clear the reminder.
   * - `versuch` accepts strings like "Versuch 1" .. "Versuch 6".
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        reminderDate: z.string().nullable().optional(),
        versuch: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      ensureAllowed(ctx.user.role);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Branch check for sales
      if (ctx.user.role === "sales") {
        const [existing] = await db
          .select()
          .from(customerReminders)
          .where(eq(customerReminders.id, input.id))
          .limit(1);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Erinnerung nicht gefunden" });
        }
        if (existing.branchId !== ctx.user.branchId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Diese Erinnerung gehört zu einer anderen Filiale",
          });
        }
      }

      const update: Record<string, unknown> = { lastUpdatedAt: new Date() };
      if (input.reminderDate !== undefined) {
        update.reminderDate = input.reminderDate ? new Date(input.reminderDate) : null;
      }
      if (input.versuch !== undefined) {
        update.versuch = input.versuch;
      }

      await db
        .update(customerReminders)
        .set(update as any)
        .where(eq(customerReminders.id, input.id));

      return { success: true };
    }),

  /**
   * Clear the reminder date — customer disappears from the list but the
   * reminder record stays in place (so it can be re-armed later).
   */
  clear: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      ensureAllowed(ctx.user.role);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (ctx.user.role === "sales") {
        const [existing] = await db
          .select()
          .from(customerReminders)
          .where(eq(customerReminders.id, input.id))
          .limit(1);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Erinnerung nicht gefunden" });
        }
        if (existing.branchId !== ctx.user.branchId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Diese Erinnerung gehört zu einer anderen Filiale",
          });
        }
      }

      await db
        .update(customerReminders)
        .set({ reminderDate: null, lastUpdatedAt: new Date() })
        .where(eq(customerReminders.id, input.id));

      return { success: true };
    }),

  /**
   * Permanently delete the reminder record. Used when work with the customer
   * is fully complete and you don't want to keep the reminder around.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      ensureAllowed(ctx.user.role);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (ctx.user.role === "sales") {
        const [existing] = await db
          .select()
          .from(customerReminders)
          .where(eq(customerReminders.id, input.id))
          .limit(1);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Erinnerung nicht gefunden" });
        }
        if (existing.branchId !== ctx.user.branchId) {
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
