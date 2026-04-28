import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { moves, customers } from "../../drizzle/schema";
import { eq, and, isNotNull, ne, sql, gte, lte, or } from "drizzle-orm";
import { formatCustomerNumber } from "../../shared/customerNumber";

export const adminRouter = router({

  /**
   * ملخص مالي شامل (KPI Dashboard)
   */
  financialSummary: protectedProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(), // 0 = كل الأشهر
      branchId: z.number().nullable().optional(), // null = كل الفروع (للمدير فقط)
    }))
    .query(async ({ input, ctx }) => {
      if (!["admin", "branch_manager"].includes(ctx.user?.role ?? "")) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const year = input.year ?? new Date().getFullYear();
      const month = input.month ?? 0;

      // تحديد الفرع: branch_manager يرى فرعه فقط، admin يختار
      const effectiveBranchId = ctx.user?.role === 'branch_manager'
        ? ctx.user.branchId
        : (input.branchId ?? null);

      // بناء شرط التاريخ
      const startDate = month > 0
        ? new Date(year, month - 1, 1)
        : new Date(year, 0, 1);
      const endDate = month > 0
        ? new Date(year, month, 0, 23, 59, 59)
        : new Date(year, 11, 31, 23, 59, 59);

      const branchCondition = effectiveBranchId ? eq(moves.branchId, effectiveBranchId) : sql`1=1`;

      const [result] = await db
        .select({
          totalMoves: sql<number>`COUNT(*)`,
          totalRevenue: sql<number>`COALESCE(SUM(CAST(COALESCE(grossPrice, 0) AS DECIMAL(10,2))), 0)`,
          paidRevenue: sql<number>`COALESCE(SUM(CASE WHEN ist_bezahlt = 1 THEN CAST(COALESCE(NULLIF(audit_total_price,0)/100.0, grossPrice, 0) AS DECIMAL(10,2)) ELSE 0 END), 0)`,
          paidMoves: sql<number>`SUM(CASE WHEN ist_bezahlt = 1 THEN 1 ELSE 0 END)`,
          unpaidMoves: sql<number>`SUM(CASE WHEN ist_bezahlt = 0 THEN 1 ELSE 0 END)`,
          schadenCount: sql<number>`SUM(CASE WHEN schaden_description IS NOT NULL AND schaden_description != '' THEN 1 ELSE 0 END)`,
          schadenKosten: sql<number>`COALESCE(SUM(CASE WHEN schadenkosten IS NOT NULL THEN schadenkosten / 100.0 ELSE 0 END), 0)`,
          beschwerdeCount: sql<number>`SUM(CASE WHEN beschwerde_description IS NOT NULL AND beschwerde_description != '' THEN 1 ELSE 0 END)`,
          completedMoves: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(moves)
        .where(and(
          gte(moves.createdAt, startDate),
          lte(moves.createdAt, endDate),
          branchCondition
        ));

      const totalRevenue = Number(result?.totalRevenue ?? 0);
      const paidRevenue = Number(result?.paidRevenue ?? 0);
      const schadenKosten = Number(result?.schadenKosten ?? 0);
      const netRevenue = totalRevenue - schadenKosten;

      return {
        totalMoves: Number(result?.totalMoves ?? 0),
        totalRevenue,
        paidRevenue,
        paidMoves: Number(result?.paidMoves ?? 0),
        unpaidMoves: Number(result?.unpaidMoves ?? 0),
        schadenCount: Number(result?.schadenCount ?? 0),
        schadenKosten,
        beschwerdeCount: Number(result?.beschwerdeCount ?? 0),
        completedMoves: Number(result?.completedMoves ?? 0),
        netRevenue,
      };
    }),

  /**
   * الإيرادات الشهرية لسنة كاملة
   */
  monthlyRevenue: protectedProcedure
    .input(z.object({
      year: z.number(),
      branchId: z.number().nullable().optional(),
    }))
    .query(async ({ input, ctx }) => {
      if (!["admin", "branch_manager"].includes(ctx.user?.role ?? "")) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const effectiveBranchId = ctx.user?.role === 'branch_manager'
        ? ctx.user.branchId
        : (input.branchId ?? null);

      const branchCondition = effectiveBranchId ? eq(moves.branchId, effectiveBranchId) : sql`1=1`;

      const rows = await db
        .select({
          month: sql<number>`MONTH(createdAt)`,
          totalMoves: sql<number>`COUNT(*)`,
          totalRevenue: sql<number>`COALESCE(SUM(CAST(COALESCE(grossPrice, 0) AS DECIMAL(10,2))), 0)`,
          paidRevenue: sql<number>`COALESCE(SUM(CASE WHEN ist_bezahlt = 1 THEN CAST(COALESCE(NULLIF(audit_total_price,0)/100.0, grossPrice, 0) AS DECIMAL(10,2)) ELSE 0 END), 0)`,
          paidMoves: sql<number>`SUM(CASE WHEN ist_bezahlt = 1 THEN 1 ELSE 0 END)`,
          schadenKosten: sql<number>`COALESCE(SUM(CASE WHEN schadenkosten IS NOT NULL THEN schadenkosten / 100.0 ELSE 0 END), 0)`,
          beschwerdeCount: sql<number>`SUM(CASE WHEN beschwerde_description IS NOT NULL AND beschwerde_description != '' THEN 1 ELSE 0 END)`,
        })
        .from(moves)
        .where(and(sql`YEAR(createdAt) = ${input.year}`, branchCondition))
        .groupBy(sql`MONTH(createdAt)`)
        .orderBy(sql`MONTH(createdAt)`);

      // إنشاء مصفوفة لكل الأشهر الـ 12
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      return monthNames.map((name, i) => {
        const row = rows.find(r => Number(r.month) === i + 1);
        const rev = Number(row?.totalRevenue ?? 0);
        const paidRev = Number(row?.paidRevenue ?? 0);
        const dmg = Number(row?.schadenKosten ?? 0);
        return {
          month: i + 1,
          monthName: name,
          totalMoves: Number(row?.totalMoves ?? 0),
          totalRevenue: rev,
          paidRevenue: paidRev,
          paidMoves: Number(row?.paidMoves ?? 0),
          schadenKosten: dmg,
          beschwerdeCount: Number(row?.beschwerdeCount ?? 0),
          netRevenue: rev - dmg,
        };
      });
    }),

  /**
   * قائمة حالات التلف الحقيقية من moves
   */
  schadenList: protectedProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(),
      branchId: z.number().nullable().optional(),
    }))
    .query(async ({ input, ctx }) => {
      if (!["admin", "branch_manager"].includes(ctx.user?.role ?? "")) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const effectiveBranchId = ctx.user?.role === 'branch_manager'
        ? ctx.user.branchId
        : (input.branchId ?? null);

      const conditions: any[] = [
        isNotNull(moves.schadenDescription),
        ne(moves.schadenDescription, ""),
        ...(effectiveBranchId ? [eq(moves.branchId, effectiveBranchId)] : []),
      ];

      if (input.year) {
        const startDate = input.month && input.month > 0
          ? new Date(input.year, input.month - 1, 1)
          : new Date(input.year, 0, 1);
        const endDate = input.month && input.month > 0
          ? new Date(input.year, input.month, 0, 23, 59, 59)
          : new Date(input.year, 11, 31, 23, 59, 59);
        conditions.push(gte(moves.createdAt, startDate));
        conditions.push(lte(moves.createdAt, endDate));
      }

      const rows = await db
        .select({
          id: moves.id,
          moveCode: moves.moveCode,
          customerId: moves.customerId,
          pickupAddress: moves.pickupAddress,
          deliveryAddress: moves.deliveryAddress,
          pickupDate: moves.pickupDate,
          schadenDescription: moves.schadenDescription,
          schadenImages: moves.schadenImages,
          schadenKosten: moves.schadenKosten,
          schadenStatus: moves.schadenStatus,
          createdAt: moves.createdAt,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          customerTitle: customers.title,
        })
        .from(moves)
        .leftJoin(customers, eq(moves.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(sql`${moves.createdAt} DESC`);

      return rows.map(r => ({
        ...r,
        kundenummer: formatCustomerNumber(r.customerId),
        schadenKosten: r.schadenKosten ? r.schadenKosten / 100 : null,
        customerName: [r.customerTitle, r.customerFirstName, r.customerLastName].filter(Boolean).join(" "),
      }));
    }),

  /**
   * تحديث تكلفة التلف وحالته
   */
  updateSchaden: protectedProcedure
    .input(z.object({
      moveId: z.number(),
      schadenKosten: z.number().optional(), // بالأورو
      schadenStatus: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!["admin"].includes(ctx.user?.role ?? "")) throw new Error("Unauthorized"); // branch_manager is read-only
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const update: Record<string, unknown> = {};
      if (input.schadenKosten !== undefined) update.schadenKosten = Math.round(input.schadenKosten * 100);
      if (input.schadenStatus !== undefined) update.schadenStatus = input.schadenStatus;

      await db.update(moves).set(update as any).where(eq(moves.id, input.moveId));
      return { success: true };
    }),

  /**
   * قائمة الشكاوى الحقيقية من moves
   */
  beschwerdeList: protectedProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(),
      branchId: z.number().nullable().optional(),
    }))
    .query(async ({ input, ctx }) => {
      if (!["admin", "branch_manager"].includes(ctx.user?.role ?? "")) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const effectiveBranchId = ctx.user?.role === 'branch_manager'
        ? ctx.user.branchId
        : (input.branchId ?? null);

      const conditions: any[] = [
        isNotNull(moves.beschwerdeDescription),
        ne(moves.beschwerdeDescription, ""),
        ...(effectiveBranchId ? [eq(moves.branchId, effectiveBranchId)] : []),
      ];

      if (input.year) {
        const startDate = input.month && input.month > 0
          ? new Date(input.year, input.month - 1, 1)
          : new Date(input.year, 0, 1);
        const endDate = input.month && input.month > 0
          ? new Date(input.year, input.month, 0, 23, 59, 59)
          : new Date(input.year, 11, 31, 23, 59, 59);
        conditions.push(gte(moves.createdAt, startDate));
        conditions.push(lte(moves.createdAt, endDate));
      }

      const rows = await db
        .select({
          id: moves.id,
          moveCode: moves.moveCode,
          customerId: moves.customerId,
          pickupAddress: moves.pickupAddress,
          beschwerdeDescription: moves.beschwerdeDescription,
          beschwerdeImages: moves.beschwerdeImages,
          beschwerdeSchweregard: moves.beschwerdeSchweregard,
          createdAt: moves.createdAt,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          customerTitle: customers.title,
        })
        .from(moves)
        .leftJoin(customers, eq(moves.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(sql`${moves.createdAt} DESC`);

      return rows.map(r => ({
        ...r,
        kundenummer: formatCustomerNumber(r.customerId),
        customerName: [r.customerTitle, r.customerFirstName, r.customerLastName].filter(Boolean).join(" "),
      }));
    }),

  // ── Legacy procedures (kept for backward compatibility) ──────────────────
  damages: router({
    list: protectedProcedure
      .input(z.object({ branchId: z.number() }).optional())
      .query(async () => []),
    create: protectedProcedure
      .input(z.object({ branchId: z.number(), moveId: z.number(), customerId: z.number(), description: z.string(), estimatedCost: z.string().optional(), notes: z.string().optional() }))
      .mutation(async () => ({ success: true, damageId: 0 })),
  }),
  complaints: router({
    list: protectedProcedure
      .input(z.object({ branchId: z.number() }).optional())
      .query(async () => []),
    create: protectedProcedure
      .input(z.object({ branchId: z.number(), moveId: z.number(), customerId: z.number(), title: z.string(), description: z.string(), severity: z.enum(["low", "medium", "high", "critical"]).optional() }))
      .mutation(async () => ({ success: true, complaintId: 0 })),
  }),
  revenue: router({
    getAnnual: protectedProcedure
      .input(z.object({ branchId: z.number(), year: z.number() }))
      .query(async () => []),
    getMonthly: protectedProcedure
      .input(z.object({ branchId: z.number(), year: z.number(), month: z.number() }))
      .query(async () => null),
  }),
});
