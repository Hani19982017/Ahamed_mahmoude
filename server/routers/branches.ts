import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { branches } from "../../drizzle/schema";
import { asc, eq } from "drizzle-orm";

export const branchesRouter = router({
  /**
   * List branches.
   * Admin sees all branches so they can manage deactivated ones.
   * Other authenticated users can still read branch data where needed in the app.
   */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      return await db.select().from(branches).orderBy(asc(branches.city), asc(branches.name));
    } catch (error) {
      console.error("[Branches] Failed to list branches:", error);
      throw error;
    }
  }),

  /**
   * Get branch by ID
   */
  getById: protectedProcedure
    .input(z.object({ branchId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const result = await db
          .select()
          .from(branches)
          .where(eq(branches.id, input.branchId))
          .limit(1);

        return result[0] || null;
      } catch (error) {
        console.error("[Branches] Failed to get branch:", error);
        throw error;
      }
    }),

  /**
   * Create a new branch
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1),
        city: z.string().trim().min(1),
        address: z.string().trim().optional(),
        phone: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const result = await db.insert(branches).values({
          name: input.name,
          city: input.city,
          address: input.address || null,
          phone: input.phone || null,
          isActive: 1,
        });

        return { success: true, branchId: (result as any).insertId };
      } catch (error) {
        console.error("[Branches] Failed to create branch:", error);
        throw error;
      }
    }),

  /**
   * Update branch
   */
  update: adminProcedure
    .input(
      z.object({
        branchId: z.number(),
        name: z.string().trim().min(1).optional(),
        city: z.string().trim().min(1).optional(),
        address: z.string().trim().optional(),
        phone: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const updateData: Record<string, string | null> = {};

        if (input.name !== undefined) updateData.name = input.name;
        if (input.city !== undefined) updateData.city = input.city;
        if (input.address !== undefined) updateData.address = input.address || null;
        if (input.phone !== undefined) updateData.phone = input.phone || null;

        await db
          .update(branches)
          .set(updateData)
          .where(eq(branches.id, input.branchId));

        return { success: true };
      } catch (error) {
        console.error("[Branches] Failed to update branch:", error);
        throw error;
      }
    }),

  /**
   * Deactivate branch instead of deleting it permanently.
   */
  deactivate: adminProcedure
    .input(z.object({ branchId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        await db
          .update(branches)
          .set({ isActive: 0 })
          .where(eq(branches.id, input.branchId));

        return { success: true };
      } catch (error) {
        console.error("[Branches] Failed to deactivate branch:", error);
        throw error;
      }
    }),

  /**
   * Reactivate a previously deactivated branch.
   */
  reactivate: adminProcedure
    .input(z.object({ branchId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        await db
          .update(branches)
          .set({ isActive: 1 })
          .where(eq(branches.id, input.branchId));

        return { success: true };
      } catch (error) {
        console.error("[Branches] Failed to reactivate branch:", error);
        throw error;
      }
    }),

  /**
   * Backward-compatible alias: old delete calls now only deactivate the branch.
   */
  delete: adminProcedure
    .input(z.object({ branchId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        await db
          .update(branches)
          .set({ isActive: 0 })
          .where(eq(branches.id, input.branchId));

        return { success: true, deactivated: true };
      } catch (error) {
        console.error("[Branches] Failed to deactivate branch via delete alias:", error);
        throw error;
      }
    }),
});
