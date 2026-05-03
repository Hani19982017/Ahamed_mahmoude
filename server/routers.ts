import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { customersRouter } from "./routers/customers";
import { branchesRouter } from "./routers/branches";
import { adminRouter } from "./routers/admin";
import { remindersRouter } from "./routers/reminders";
import { getDb } from "./db";
import { generateInvoiceHTML, InvoiceData } from "./invoiceTemplate";
import { generatePDF } from "./pdfGenerator";
import { moves, users, customers, moveImages, messageTemplates, branches, invoices, tasks, customerReminders } from "../drizzle/schema";
import { and, desc, like, or, sql, eq, ne } from "drizzle-orm";
import { z } from "zod";
import {
  changeManagerPassword,
  createManagerPasswordResetLink,
  resetManagerPasswordWithToken,
} from "./_core/localAuth";
import { MANAGER_LOGIN_EMAIL } from "./_core/managerLogin";
import { formatCustomerNumber } from "../shared/customerNumber";

const getMoveGrossPriceEuros = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getInvoiceTotalCents = (move: { auditTotalPrice: unknown; grossPrice: unknown }) => {
  const auditCents = Number(move.auditTotalPrice ?? 0);
  if (Number.isFinite(auditCents) && auditCents > 0) return Math.round(auditCents);
  return Math.round(getMoveGrossPriceEuros(move.grossPrice) * 100);
};

const getInvoiceAmountEuros = (move: { auditTotalPrice: unknown; grossPrice: unknown }) => {
  const auditCents = Number(move.auditTotalPrice ?? 0);
  if (Number.isFinite(auditCents) && auditCents > 0) return auditCents / 100;
  return getMoveGrossPriceEuros(move.grossPrice);
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    changeManagerPassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1, "current password is required"),
        newPassword: z.string().min(8, "new password is too short"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("FORBIDDEN");
        }

        const result = await changeManagerPassword({
          userId: ctx.user.id,
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
        });

        if (!result.success) {
          throw new Error(result.error ?? "Manager password change failed");
        }

        return { success: true } as const;
      }),
    requestManagerPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
        origin: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Rate limit: max 3 requests per 15 minutes per IP.
        const { consumeRateLimit } = await import('./_core/rateLimit');
        const ip = (ctx.req?.ip || ctx.req?.socket?.remoteAddress || 'unknown').toString();
        const rate = consumeRateLimit(`manager-reset:${ip}`, { max: 3, windowMs: 15 * 60 * 1000 });
        if (!rate.allowed) {
          const minutes = Math.ceil(rate.retryAfterMs / 60000);
          throw new Error(`Zu viele Anfragen. Bitte versuchen Sie es in ${minutes} Minute(n) erneut.`);
        }

        if (input.email.trim().toLowerCase() !== MANAGER_LOGIN_EMAIL) {
          return { success: true, delivered: false, resetUrl: null } as const;
        }

        const resetUrl = await createManagerPasswordResetLink(input.origin);
        if (!resetUrl) {
          return { success: true, delivered: false, resetUrl: null } as const;
        }

        // Try to deliver via the notification service (production / cloud deployments).
        const delivered = await notifyOwner({
          title: "Manager password reset requested",
          content: `A reset link for ${MANAGER_LOGIN_EMAIL} was requested. Open this URL to set a new password: ${resetUrl}`,
        }).catch(() => false);

        // Always log the reset URL to the server console so a local operator can
        // copy it from the terminal — useful when running locally without SMTP.
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  PASSWORD RESET LINK FOR ' + MANAGER_LOGIN_EMAIL);
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  ' + resetUrl);
        console.log('  (Valid for 15 minutes)');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');

        // In development mode, also return the URL directly to the client so the
        // user can click it without checking the terminal. NEVER do this in
        // production — it would let anyone reset the manager password.
        const isDev = process.env.NODE_ENV !== 'production';

        return {
          success: true,
          delivered,
          resetUrl: isDev ? resetUrl : null,
        } as const;
      }),
    resetManagerPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1, "token is required"),
        newPassword: z.string().min(8, "new password is too short"),
      }))
      .mutation(async ({ input }) => {
        const result = await resetManagerPasswordWithToken({
          token: input.token,
          newPassword: input.newPassword,
        });

        if (!result.success) {
          throw new Error(result.error ?? "Manager password reset failed");
        }

        return { success: true } as const;
      }),
  }),
  branches: branchesRouter,
  admin: adminRouter,
  customers: customersRouter,
  reminders: remindersRouter,
  moves: router({
    list: protectedProcedure
      .input(z.object({ branchId: z.number().nullable().optional() }).optional())
      .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        // تصفية حسب الفرع: المدير يمكنه اختيار فرع أو رؤية الكل، الباقون يرون فرعهم فقط
        const { getEffectiveBranchId } = await import('./_core/context');
        const effectiveBranchId = getEffectiveBranchId(ctx.user, input?.branchId);
        const allMoves = effectiveBranchId
          ? await db.select().from(moves).where(eq(moves.branchId, effectiveBranchId))
          : await db.select().from(moves);
        // جلب عدد صور العميل (customer_photos) لكل طلب دفعة واحدة
        const photoCounts = await db
          .select({ moveId: moveImages.moveId, count: sql<number>`COUNT(*)` })
          .from(moveImages)
          .where(eq(moveImages.imageType, 'customer_photos'))
          .groupBy(moveImages.moveId);
        const photoCountMap: Record<number, number> = {};
        for (const row of photoCounts) {
          photoCountMap[row.moveId] = Number(row.count);
        }
        return allMoves.map(m => ({
          ...m,
          kundenummer: formatCustomerNumber(m.customerId),
          customerPhotoCount: photoCountMap[m.id] || 0,
        }));
      } catch (e) {
        console.error("Error fetching moves:", e);
        return [];
      }
    }),
    update: protectedProcedure
      .input(z.object({
        moveId: z.number(),
        pickupAddress: z.string().optional(),
        pickupFloor: z.string().optional(),
        pickupElevatorCapacity: z.string().optional(),
        pickupParkingDistance: z.string().optional(),
        deliveryAddress: z.string().optional(),
        deliveryFloor: z.string().optional(),
        deliveryElevatorCapacity: z.string().optional(),
        deliveryParkingDistance: z.string().optional(),
        pickupDate: z.string().optional(),
        deliveryDate: z.string().optional(),
        grossPrice: z.number().optional(),
        volume: z.number().optional(),
        distance: z.number().optional(),
        numTrips: z.number().optional(),
        status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled"]).optional(),
        paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
        moveType: z.string().optional(),
        services: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const allowedRoles = ["admin", "sales", "supervisor"]; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) {
          throw new Error("FORBIDDEN");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { moveId, ...data } = input;

        // Branch isolation: verify the move belongs to the user's branch
        const { assertBranchAccess } = await import('./_core/context');
        const [existingMove] = await db.select({ branchId: moves.branchId }).from(moves).where(eq(moves.id, moveId)).limit(1);
        if (!existingMove) throw new Error("الطلب غير موجود");
        assertBranchAccess(ctx.user, existingMove.branchId);

        const updateData: Record<string, unknown> = {};
        if (data.pickupAddress !== undefined) updateData.pickupAddress = data.pickupAddress;
        if (data.pickupFloor !== undefined) updateData.pickupFloor = data.pickupFloor;
        if (data.pickupElevatorCapacity !== undefined) updateData.pickupElevatorCapacity = data.pickupElevatorCapacity;
        if (data.pickupParkingDistance !== undefined) updateData.pickupParkingDistance = data.pickupParkingDistance;
        if (data.deliveryAddress !== undefined) updateData.deliveryAddress = data.deliveryAddress;
        if (data.deliveryFloor !== undefined) updateData.deliveryFloor = data.deliveryFloor;
        if (data.deliveryElevatorCapacity !== undefined) updateData.deliveryElevatorCapacity = data.deliveryElevatorCapacity;
        if (data.deliveryParkingDistance !== undefined) updateData.deliveryParkingDistance = data.deliveryParkingDistance;
        if (data.pickupDate !== undefined) updateData.pickupDate = new Date(data.pickupDate);
        if (data.deliveryDate !== undefined) updateData.deliveryDate = new Date(data.deliveryDate);
        // grossPrice is stored as decimal(15,2) in euros — preserve 2-decimal precision, don't round to int
        if (data.grossPrice !== undefined) updateData.grossPrice = Math.round(data.grossPrice * 100) / 100;
        if (data.volume !== undefined) updateData.volume = data.volume;
        if (data.distance !== undefined) updateData.distance = data.distance;
        if (data.numTrips !== undefined) updateData.numTrips = data.numTrips;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;
        if (data.moveType !== undefined) updateData.moveType = data.moveType;
        if (data.services !== undefined) updateData.services = data.services;
        try {
          await db.update(moves).set(updateData).where(eq(moves.id, moveId));
          return { success: true };
        } catch (e) {
          console.error("Error updating move:", e);
          throw new Error("فشل تحديث الطلب");
        }
      }),

    // جلب طلب واحد مع بيانات العميل والصور
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return null;
        try {
          const [move] = await db.select().from(moves).where(eq(moves.id, input.id)).limit(1);
          if (!move) return null;
          // Branch isolation
          const { assertBranchAccess } = await import('./_core/context');
          assertBranchAccess(ctx.user, move.branchId);
          const [customer] = await db.select().from(customers).where(eq(customers.id, move.customerId)).limit(1);
          // Don't pull the LONGBLOB `data` column — it's heavy and only needed
          // when serving an individual image via /api/images/:id.
      // Fetch images, but exclude the heavy LONGBLOB `data` column.
          // Drizzle's column-explicit select was failing on Render with
          // "Cannot convert undefined or null to object", so we use the
          // simpler approach: full select then strip `data` in JS.
          const rawImages = await db.select().from(moveImages).where(eq(moveImages.moveId, move.id));
          const images = rawImages.map(({ data: _ignored, ...img }) => ({
            ...img,
            imageUrl: img.imageUrl || `/api/images/${img.id}`,
          }));
          return { move, customer: customer ?? null, images };
        } catch (e) {
          console.error("Error fetching move:", e);
          return null;
        }
      }),

    // حذف طلب (للمدير فقط)
    delete: protectedProcedure
      .input(z.object({ moveId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const allowedRoles = ["admin", "sales"]; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) throw new Error("FORBIDDEN");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          // Branch isolation: verify the move belongs to the user's branch
          const { assertBranchAccess } = await import('./_core/context');
          const [existingMove] = await db.select({ branchId: moves.branchId }).from(moves).where(eq(moves.id, input.moveId)).limit(1);
          if (!existingMove) throw new Error("الطلب غير موجود");
          assertBranchAccess(ctx.user, existingMove.branchId);

          await db.delete(moveImages).where(eq(moveImages.moveId, input.moveId)).catch(() => {});
          await db.delete(moves).where(eq(moves.id, input.moveId));
          return { success: true };
        } catch (e) {
          console.error("Error deleting move:", e);
          throw new Error("فشل حذف الطلب");
        }
      }),

    // تحديث شامل للطلب وبيانات العميل (مع جميع الحقول)
    generateInvoice: protectedProcedure
      .input(z.object({ moveId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');

        // جلب بيانات الطلب مع بيانات العميل والفرع
        const moveResult = await db
          .select()
          .from(moves)
          .leftJoin(customers, eq(moves.customerId, customers.id))
          .leftJoin(branches, eq(moves.branchId, branches.id))
          .where(eq(moves.id, input.moveId))
          .limit(1);

        if (!moveResult.length) throw new Error('Auftrag nicht gefunden');

        const { moves: move, customers: customer, branches: branch } = moveResult[0];
        if (!customer) throw new Error('Kundendaten nicht gefunden');

        // Branch isolation
        const { assertBranchAccess } = await import('./_core/context');
        assertBranchAccess(ctx.user, move.branchId);

        // تحديد تاريخ الفاتورة
        const today = new Date();
        const invoiceDate = today.toLocaleDateString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });

        // تحديد تاريخ الانتقال
        const moveDate = move.pickupDate
          ? new Date(move.pickupDate).toLocaleDateString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric'
            })
          : 'N/A';

        // تحديد تاريخ الدفع
        const paymentDate = move.bezahltDatum
          ? new Date(move.bezahltDatum).toLocaleDateString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric'
            })
          : undefined;

        // عنوان العميل (من عنوان الانتقال)
        const customerAddress = move.pickupAddress || 'N/A';

        // وصف الخدمة
        const serviceType = move.moveType || 'Umzug';
        const fromCity = move.pickupAddress ? move.pickupAddress.split(',').pop()?.trim() || '' : '';
        const toCity = move.deliveryAddress ? move.deliveryAddress.split(',').pop()?.trim() || '' : '';
        const serviceDescription = `${serviceType}sleistung${fromCity && toCity ? ` von ${fromCity} nach ${toCity}` : ''} – Leistungsdatum: ${moveDate}`;

        // المبلغ الإجمالي
        const totalAmount = getInvoiceTotalCents(move);

        // معلومات الشركة (hardcoded - يمكن تعديلها لاحقاً)
        const branchName = branch?.name || 'Check Umzug';
        const branchAddress = branch?.address || branch?.city || 'Deutschland';
        const branchPhone = branch?.phone || '';
        const branchEmail = branch?.email || '';

        const invoiceData: InvoiceData = {
          // Company info
          companyName: branchName,
          companyAddress: branchAddress,
          companyPhone: branchPhone,
          companyEmail: branchEmail,
          companyTaxId: undefined, // يُضاف لاحقاً

          // Bank info (يُضاف لاحقاً)
          bankName: undefined,
          bankIban: undefined,
          bankBic: undefined,

          // Customer info
          customerName: `${customer.title ? customer.title + ' ' : ''}${customer.firstName} ${customer.lastName}`,
          customerAddress: customerAddress,
          customerPhone: customer.phone || 'N/A',
          customerEmail: customer.email || 'N/A',

          // Invoice details
          invoiceNumber: move.rechnungNummer || `RE-${move.moveCode || move.id}`,
          invoiceDate,
          moveDate,

          // Service
          serviceDescription,
          totalAmount,

          // Payment
          isPaid: move.istBezahlt === 1,
          paymentDate,
          paymentMethod: move.paymentWay || undefined,
        };

        const html = generateInvoiceHTML(invoiceData);
        const pdfBuffer = await generatePDF(html);
        const base64 = pdfBuffer.toString('base64');

        // حفظ سجل الفاتورة في جدول invoices تلقائياً
        try {
          const existingInvoice = await db
            .select({ id: invoices.id })
            .from(invoices)
            .where(eq(invoices.invoiceNumber, invoiceData.invoiceNumber))
            .limit(1);

          if (existingInvoice.length === 0) {
            await db.insert(invoices).values({
              invoiceNumber: invoiceData.invoiceNumber,
              moveId: input.moveId,
              customerId: move.customerId || 0,
              branchId: move.branchId || undefined,
              customerName: invoiceData.customerName,
              amount: String(getInvoiceAmountEuros(move)),
              isPaid: invoiceData.isPaid ? 1 : 0,
              paymentMethod: invoiceData.paymentMethod || null,
              paymentDate: invoiceData.isPaid && move.bezahltDatum ? new Date(move.bezahltDatum) : undefined,
            });
          } else {
            // تحديث السجل الموجود
            await db.update(invoices)
              .set({
                customerName: invoiceData.customerName,
                amount: String(getInvoiceAmountEuros(move)),
                isPaid: invoiceData.isPaid ? 1 : 0,
                paymentMethod: invoiceData.paymentMethod || null,
                paymentDate: invoiceData.isPaid && move.bezahltDatum ? new Date(move.bezahltDatum) : undefined,
              })
              .where(eq(invoices.invoiceNumber, invoiceData.invoiceNumber));
          }
        } catch (invoiceErr) {
          console.error('Failed to save invoice record:', invoiceErr);
          // لا نوقف العملية إذا فشل حفظ السجل
        }

        return {
          base64,
          filename: `Rechnung_${invoiceData.invoiceNumber}.pdf`,
        };
      }),
    fullUpdate: protectedProcedure
      .input(z.object({
        moveId: z.number(),
        // بيانات العميل
        title: z.string().optional(),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),

        sitz: z.string().optional(),
        status2: z.string().optional(),
        versuch: z.string().optional(),
        callCheck: z.string().optional(),
        shaden: z.string().optional(),
        angebotPerPost: z.boolean().optional(),
        bezahlt: z.boolean().optional(),
        mitFotos: z.boolean().optional(),
        // بيانات الطلب الأساسية
        moveCode: z.string().optional(),
        moveType: z.string().optional(),
        status: z.enum(["pending","confirmed","in_progress","completed","cancelled"]).optional(),
        paymentStatus: z.enum(["unpaid","partial","paid"]).optional(),
        grossPrice: z.number().optional(),
        volume: z.number().optional(),
        distance: z.number().optional(),
        anfahrt: z.number().optional(),
        pickupDate: z.string().optional(),
        deliveryDate: z.string().optional(),
        pickupAddress: z.string().optional(),
        pickupFloor: z.string().optional(),
        pickupElevatorCapacity: z.string().optional(),
        pickupParkingDistance: z.string().optional(),
        deliveryAddress: z.string().optional(),
        deliveryFloor: z.string().optional(),
        deliveryElevatorCapacity: z.string().optional(),
        deliveryParkingDistance: z.string().optional(),
        auszugFlaeche: z.number().optional(),
        auszugZimmer: z.number().optional(),
        einzugFlaeche: z.number().optional(),
        einzugZimmer: z.number().optional(),
        servicesJson: z.string().optional(),
        // NOTE
        summary: z.string().optional(),
        anmerkungen: z.string().optional(),
        serviceanmerkungen: z.string().optional(),
        moebelListe: z.string().optional(),
        kundenNote: z.string().optional(),
        kontaktinfo: z.string().optional(),
        // Web Bewertung
        bewertungPlatform: z.string().optional(),
        bewertungScore: z.number().optional(),
        bewertungLink: z.string().optional(),
        // Plan
        planMitarbeiter: z.number().optional(),
        planFahrzeuge: z.number().optional(),
        planStartzeit: z.string().optional(),
        planEndzeit: z.string().optional(),
        planBemerkungen: z.string().optional(),
        // Finanzen
        anzahlung: z.number().optional(),
        restbetrag: z.number().optional(),
        zahlungsart: z.string().optional(),
        rechnungNr: z.string().optional(),
        // Schaden/Beschwerde/Extra
        schadenDescription: z.string().optional(),
        schadenKosten: z.number().optional(),
        schadenStatus: z.string().optional(),
        beschwerdeDescription: z.string().optional(),
        beschwerdeSchweregard: z.string().optional(),
        extraVolumen: z.number().optional(),
        extraPreis: z.number().optional(),
        extraBemerkungen: z.string().optional(),
        // Audits
        bezahltVon: z.string().optional(),
        betzhalKunde: z.string().optional(),
        istBezahlt: z.boolean().optional(),
        paymentWay: z.string().optional(),
        auditTotalPrice: z.number().optional(),
        bezahltDatum: z.string().optional(),
        bankBetrag: z.number().optional(),
        barBetrag: z.number().optional(),
        rechnungAusgestellt: z.boolean().optional(),
        rechnungBetrag: z.number().optional(),
        rechnungNummer: z.string().optional(),
        // صور جديدة
        images: z.array(z.object({ name: z.string(), data: z.string() })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const allowedRoles = ["admin", "sales", "supervisor"]; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) throw new Error("FORBIDDEN");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          // جلب الطلب للحصول على customerId
          const [existingMove] = await db.select().from(moves).where(eq(moves.id, input.moveId)).limit(1);
          if (!existingMove) throw new Error("الطلب غير موجود");
          // Branch isolation
          const { assertBranchAccess } = await import('./_core/context');
          assertBranchAccess(ctx.user, existingMove.branchId);
          // تحديث بيانات العميل
          const customerUpdate: Record<string, unknown> = {};
          if (input.title !== undefined) customerUpdate.title = input.title;
          if (input.name !== undefined) {
            const parts = input.name.trim().split(" ");
            customerUpdate.firstName = parts[0] || "";
            customerUpdate.lastName = parts.slice(1).join(" ") || "";
          }
          if (input.email !== undefined) customerUpdate.email = input.email;
          if (input.phone !== undefined) customerUpdate.phone = input.phone;
          if (input.company !== undefined) customerUpdate.company = input.company;

          if (input.sitz !== undefined) customerUpdate.sitz = input.sitz;
          if (input.status2 !== undefined) customerUpdate.status2 = input.status2;
          if (input.versuch !== undefined) customerUpdate.versuch = input.versuch;
          if (input.callCheck !== undefined) customerUpdate.callCheck = input.callCheck;
          if (input.shaden !== undefined) customerUpdate.shaden = input.shaden;
          if (input.angebotPerPost !== undefined) customerUpdate.angebotPerPost = input.angebotPerPost ? 1 : 0;
          if (input.bezahlt !== undefined) customerUpdate.bezahlt = input.bezahlt ? 1 : 0;
         if (input.mitFotos !== undefined) customerUpdate.mitFotos = input.mitFotos ? 1 : 0;
          if (Object.keys(customerUpdate).length > 0) {
            await db.update(customers).set(customerUpdate as any).where(eq(customers.id, existingMove.customerId));
          }

          // Sync reminder: bump lastUpdatedAt + sync versuch + refresh name.
          // Wrapped in try/catch so a stale/missing reminder never blocks save.
          try {
            const remName = [
              customerUpdate.title ?? existingMove.title ?? null,
              customerUpdate.firstName ?? existingMove.firstName ?? null,
              customerUpdate.lastName ?? existingMove.lastName ?? null,
            ]
              .filter(Boolean)
              .join(" ")
              .trim();
            const remUpdate: Record<string, unknown> = {
              lastUpdatedAt: new Date(),
            };
            if (remName) remUpdate.customerName = remName;
            if (input.versuch !== undefined) remUpdate.versuch = input.versuch;
            await db
              .update(customerReminders)
              .set(remUpdate as any)
              .where(eq(customerReminders.customerId, existingMove.customerId));
          } catch (e) {
            console.error("Failed to sync reminder:", e);
          }
          // تحديث بيانات الطلب
          const moveUpdate: Record<string, unknown> = {};
          moveUpdate.moveCode = formatCustomerNumber(existingMove.customerId);
          if (input.moveType !== undefined) moveUpdate.moveType = input.moveType;
          if (input.status !== undefined) moveUpdate.status = input.status;
          if (input.paymentStatus !== undefined) moveUpdate.paymentStatus = input.paymentStatus;
          if (input.grossPrice !== undefined) moveUpdate.grossPrice = Math.round(input.grossPrice * 100) / 100;
          if (input.volume !== undefined) moveUpdate.volume = input.volume;
          if (input.distance !== undefined) moveUpdate.distance = input.distance;
          if (input.anfahrt !== undefined) moveUpdate.anfahrt = input.anfahrt;
          if (input.pickupDate !== undefined) moveUpdate.pickupDate = input.pickupDate ? new Date(input.pickupDate) : null;
          if (input.deliveryDate !== undefined) moveUpdate.deliveryDate = input.deliveryDate ? new Date(input.deliveryDate) : null;
          if (input.pickupAddress !== undefined) moveUpdate.pickupAddress = input.pickupAddress;
          if (input.pickupFloor !== undefined) moveUpdate.pickupFloor = input.pickupFloor;
          if (input.pickupElevatorCapacity !== undefined) moveUpdate.pickupElevatorCapacity = input.pickupElevatorCapacity;
          if (input.pickupParkingDistance !== undefined) moveUpdate.pickupParkingDistance = input.pickupParkingDistance;
          if (input.deliveryAddress !== undefined) moveUpdate.deliveryAddress = input.deliveryAddress;
          if (input.deliveryFloor !== undefined) moveUpdate.deliveryFloor = input.deliveryFloor;
          if (input.deliveryElevatorCapacity !== undefined) moveUpdate.deliveryElevatorCapacity = input.deliveryElevatorCapacity;
          if (input.deliveryParkingDistance !== undefined) moveUpdate.deliveryParkingDistance = input.deliveryParkingDistance;
          if (input.auszugFlaeche !== undefined) moveUpdate.auszugFlaeche = input.auszugFlaeche;
          if (input.auszugZimmer !== undefined) moveUpdate.auszugZimmer = input.auszugZimmer;
          if (input.einzugFlaeche !== undefined) moveUpdate.einzugFlaeche = input.einzugFlaeche;
          if (input.einzugZimmer !== undefined) moveUpdate.einzugZimmer = input.einzugZimmer;
          if (input.servicesJson !== undefined) moveUpdate.servicesJson = input.servicesJson;
          if (input.summary !== undefined) moveUpdate.summary = input.summary;
          if (input.anmerkungen !== undefined) moveUpdate.anmerkungen = input.anmerkungen;
          if (input.serviceanmerkungen !== undefined) moveUpdate.serviceanmerkungen = input.serviceanmerkungen;
          if (input.moebelListe !== undefined) moveUpdate.moebelListe = input.moebelListe;
          if (input.kundenNote !== undefined) moveUpdate.kundenNote = input.kundenNote;
          if (input.kontaktinfo !== undefined) moveUpdate.kontaktinfo = input.kontaktinfo;
          if (input.bewertungPlatform !== undefined) moveUpdate.bewertungPlatform = input.bewertungPlatform;
          if (input.bewertungScore !== undefined) moveUpdate.bewertungScore = input.bewertungScore;
          if (input.bewertungLink !== undefined) moveUpdate.bewertungLink = input.bewertungLink;
          if (input.planMitarbeiter !== undefined) moveUpdate.planMitarbeiter = input.planMitarbeiter;
          if (input.planFahrzeuge !== undefined) moveUpdate.planFahrzeuge = input.planFahrzeuge;
          if (input.planStartzeit !== undefined) moveUpdate.planStartzeit = input.planStartzeit;
          if (input.planEndzeit !== undefined) moveUpdate.planEndzeit = input.planEndzeit;
          if (input.planBemerkungen !== undefined) moveUpdate.planBemerkungen = input.planBemerkungen;
          if (input.anzahlung !== undefined) moveUpdate.anzahlung = input.anzahlung;
          if (input.restbetrag !== undefined) moveUpdate.restbetrag = input.restbetrag;
          if (input.zahlungsart !== undefined) moveUpdate.zahlungsart = input.zahlungsart;
          if (input.rechnungNr !== undefined) moveUpdate.rechnungNr = input.rechnungNr;
          if (input.schadenDescription !== undefined) moveUpdate.schadenDescription = input.schadenDescription;
          if (input.schadenKosten !== undefined) moveUpdate.schadenKosten = input.schadenKosten;
          if (input.schadenStatus !== undefined) moveUpdate.schadenStatus = input.schadenStatus;
          if (input.beschwerdeDescription !== undefined) moveUpdate.beschwerdeDescription = input.beschwerdeDescription;
          if (input.beschwerdeSchweregard !== undefined) moveUpdate.beschwerdeSchweregard = input.beschwerdeSchweregard;
          if (input.extraVolumen !== undefined) moveUpdate.extraVolumen = input.extraVolumen;
          if (input.extraPreis !== undefined) moveUpdate.extraPreis = input.extraPreis;
          if (input.extraBemerkungen !== undefined) moveUpdate.extraBemerkungen = input.extraBemerkungen;
          // Audits
          if (input.bezahltVon !== undefined) moveUpdate.bezahltVon = input.bezahltVon;
          if (input.betzhalKunde !== undefined) moveUpdate.betzhalKunde = input.betzhalKunde;
          if (input.istBezahlt !== undefined) {
            moveUpdate.istBezahlt = input.istBezahlt ? 1 : 0;
            moveUpdate.paymentStatus = input.istBezahlt ? 'paid' : 'unpaid';
          }
          if (input.paymentWay !== undefined) moveUpdate.paymentWay = input.paymentWay;
          if (input.auditTotalPrice !== undefined) moveUpdate.auditTotalPrice = Math.round(input.auditTotalPrice * 100);
          if (input.bezahltDatum !== undefined) moveUpdate.bezahltDatum = input.bezahltDatum ? new Date(input.bezahltDatum) : null;
          if (input.bankBetrag !== undefined) moveUpdate.bankBetrag = Math.round(input.bankBetrag * 100);
          if (input.barBetrag !== undefined) moveUpdate.barBetrag = Math.round(input.barBetrag * 100);
          if (input.rechnungAusgestellt !== undefined) moveUpdate.rechnungAusgestellt = input.rechnungAusgestellt ? 1 : 0;
          if (input.rechnungBetrag !== undefined) moveUpdate.rechnungBetrag = Math.round(input.rechnungBetrag * 100);
          if (input.rechnungNummer !== undefined) moveUpdate.rechnungNummer = input.rechnungNummer;

          const isMoveBeingConfirmed = input.status === 'confirmed' || input.status2 === 'Bestätigt';
          if (input.status === undefined && input.status2 === 'Bestätigt') {
            moveUpdate.status = 'confirmed';
          }

          moveUpdate.updatedAt = new Date();
          await db.update(moves).set(moveUpdate as any).where(eq(moves.id, input.moveId));

          // Warnings bubbled back to the UI so the user knows when automation didn't fully succeed.
          const warnings: string[] = [];

          // إنشاء مهام تلقائية عند تأكيد الطلب
          if (isMoveBeingConfirmed && existingMove.status !== 'confirmed') {
            try {
              // جلب العاملين في نفس الفرع
              const workers = await db
                .select()
                .from(users)
                .where(and(
                  eq(users.branchId, existingMove.branchId),
                  eq(users.role, 'worker'),
                  sql`${users.isActive} = 1`
                ))
                .limit(5);

              if (workers.length === 0) {
                warnings.push('لم يتم إنشاء مهام للعمال: لا يوجد عمال نشطون في هذا الفرع. يرجى إضافة عمال من قسم إدارة المستخدمين.');
              } else if (workers.length === 1) {
                warnings.push('تم إنشاء مهمة الاستلام فقط: يوجد عامل واحد في الفرع. يلزم عامل ثانٍ لمهمة التسليم.');
              }

              const existingTasks = await db
                .select({ id: tasks.id, taskType: tasks.taskType })
                .from(tasks)
                .where(eq(tasks.moveId, input.moveId));
              const existingTaskTypes = new Set(existingTasks.map((task) => task.taskType || ''));

              // إنشاء مهام للعاملين
              if (workers.length > 0 && !existingTaskTypes.has('pickup')) {
                await db.insert(tasks).values({
                  moveId: input.moveId,
                  assignedTo: workers[0].id,
                  taskType: 'pickup',
                  status: 'pending',
                  notes: `Pickup: ${existingMove.pickupAddress || 'Pickup location'} - Delivery: ${existingMove.deliveryAddress || 'Delivery location'}`,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }

              if (workers.length > 1 && !existingTaskTypes.has('delivery')) {
                await db.insert(tasks).values({
                  moveId: input.moveId,
                  assignedTo: workers[1].id,
                  taskType: 'delivery',
                  status: 'pending',
                  notes: `Delivery: ${existingMove.deliveryAddress || 'Delivery location'}`,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            } catch (error) {
              console.error('Error creating tasks:', error);
              warnings.push('حدث خطأ أثناء إنشاء مهام العمال، تم حفظ تأكيد الطلب فقط.');
            }
          }

          // إنشاء فاتورة تلقائية عند تسجيل الدفع
          if (input.istBezahlt === true) {
            try {
              // جلب بيانات الطلب مع بيانات العميل والفرع
              const moveResult = await db
                .select()
                .from(moves)
                .leftJoin(customers, eq(moves.customerId, customers.id))
                .leftJoin(branches, eq(moves.branchId, branches.id))
                .where(eq(moves.id, input.moveId))
                .limit(1);

              if (moveResult.length > 0) {
                const { moves: mv, customers: cust, branches: branch } = moveResult[0];
                if (cust) {
                  const invoiceNumber = (input.rechnungNummer && input.rechnungNummer.trim())
                    ? input.rechnungNummer.trim()
                    : (existingMove.rechnungNummer && existingMove.rechnungNummer.trim())
                      ? existingMove.rechnungNummer.trim()
                      : `RE-${mv.moveCode || mv.id}`;

                  const customerName = `${cust.title ? cust.title + ' ' : ''}${cust.firstName} ${cust.lastName}`.trim();
                  const totalAmount = input.auditTotalPrice
                    ? input.auditTotalPrice
                    : input.grossPrice
                      ? input.grossPrice
                      : getInvoiceAmountEuros(mv);

                  const paymentMethod = input.paymentWay || mv.paymentWay || null;
                  const paymentDate = input.bezahltDatum
                    ? new Date(input.bezahltDatum)
                    : mv.bezahltDatum
                      ? new Date(mv.bezahltDatum)
                      : new Date();

                  // تحقق من عدم وجود فاتورة مسبقاً
                  const existingInv = await db
                    .select({ id: invoices.id })
                    .from(invoices)
                    .where(eq(invoices.moveId, input.moveId))
                    .limit(1);

                  if (existingInv.length === 0) {
                    await db.insert(invoices).values({
                      invoiceNumber,
                      moveId: input.moveId,
                      customerId: mv.customerId || 0,
                      branchId: mv.branchId || undefined,
                      customerName,
                      amount: String(totalAmount),
                      isPaid: 1,
                      paymentMethod,
                      paymentDate,
                    });
                  } else {
                    // تحديث الفاتورة الموجودة
                    await db.update(invoices)
                      .set({
                        customerName,
                        amount: String(totalAmount),
                        isPaid: 1,
                        paymentMethod,
                        paymentDate,
                        invoiceNumber,
                      })
                      .where(eq(invoices.moveId, input.moveId));
                  }
                }
              }
            } catch (invErr) {
              console.error('Auto-invoice creation failed:', invErr);
              // لا نوقف العملية إذا فشل إنشاء الفاتورة
            }
          }

          // Save photos directly to the database as LONGBLOB.
          // No external storage required — works on Render free tier without
          // ephemeral filesystem issues. Photos are served via /api/images/:id.
          if (input.images && input.images.length > 0) {
            for (const img of input.images) {
              try {
                // Strip the data URL prefix ("data:image/jpeg;base64,...") if present
                const commaIndex = img.data.indexOf(',');
                const base64Data = commaIndex >= 0 ? img.data.slice(commaIndex + 1) : img.data;
                const mimeMatch = img.data.match(/^data:([^;]+);/);
                const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                const buffer = Buffer.from(base64Data, 'base64');

                const inserted = await db.insert(moveImages).values({
                  moveId: input.moveId,
                  imageKey: img.name || `photo-${Date.now()}`,
                  data: buffer,
                  mimeType,
                  imageType: 'customer_photos',
                } as any).$returningId?.() ?? null;

                // Build a stable URL the frontend can use to display the photo.
                // Drizzle's $returningId may not be available — fall back to a
                // SELECT to fetch the new row's id.
                let imageId: number | null = inserted?.[0]?.id ?? null;
                if (imageId === null) {
                  const [latest] = await db.select({ id: moveImages.id })
                    .from(moveImages)
                    .where(eq(moveImages.moveId, input.moveId))
                    .orderBy(desc(moveImages.id))
                    .limit(1);
                  imageId = latest?.id ?? null;
                }

                if (imageId !== null) {
                  await db.update(moveImages)
                    .set({ imageUrl: `/api/images/${imageId}` })
                    .where(eq(moveImages.id, imageId));
                }
              } catch (e) {
                console.error('Error saving image to DB:', e);
                warnings.push(`فشل حفظ الصورة: ${img.name || 'unknown'}`);
              }
            }
          }
          return { success: true, warnings };
        } catch (e) {
          console.error("Error in fullUpdate:", e);
          throw new Error("فشل تحديث البيانات");
        }
      }),
  }),
  workerMoves: router({
    // جلب مهام العامل الحالية مع بيانات العميل
    list: protectedProcedure
      .input(z.object({ branchId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const result = await db
          .select({
            id: moves.id,
            branchId: moves.branchId,
            customerId: moves.customerId,
            moveCode: moves.moveCode,
            pickupAddress: moves.pickupAddress,
            pickupFloor: moves.pickupFloor,
            pickupElevatorCapacity: moves.pickupElevatorCapacity,
            pickupParkingDistance: moves.pickupParkingDistance,
            deliveryAddress: moves.deliveryAddress,
            deliveryFloor: moves.deliveryFloor,
            deliveryElevatorCapacity: moves.deliveryElevatorCapacity,
            deliveryParkingDistance: moves.deliveryParkingDistance,
            pickupDate: moves.pickupDate,
            deliveryDate: moves.deliveryDate,
            volume: moves.volume,
            grossPrice: moves.grossPrice,
            distance: moves.distance,
            numTrips: moves.numTrips,
            moveType: moves.moveType,
            services: moves.services,
            status: moves.status,
            paymentStatus: moves.paymentStatus,
            assignedSupervisor: moves.assignedSupervisor,
            assignedWorkers: moves.assignedWorkers,
            schadenDescription: moves.schadenDescription,
            schadenImages: moves.schadenImages,
            beschwerdeDescription: moves.beschwerdeDescription,
            beschwerdeImages: moves.beschwerdeImages,
            completedAt: moves.completedAt,
            createdAt: moves.createdAt,
            updatedAt: moves.updatedAt,
            servicesJson: moves.servicesJson,
            summary: moves.summary,
            anmerkungen: moves.anmerkungen,
            moebelListe: moves.moebelListe,
            kundenNote: moves.kundenNote,
            serviceanmerkungen: moves.serviceanmerkungen,
            anzahlung: moves.anzahlung,
            restbetrag: moves.restbetrag,
            zahlungsart: moves.zahlungsart,
            istBezahlt: moves.istBezahlt,
            paymentWay: moves.paymentWay,
            auditTotalPrice: moves.auditTotalPrice,
            bankBetrag: moves.bankBetrag,
            barBetrag: moves.barBetrag,
            rechnungNummer: moves.rechnungNummer,
            bezahltVon: moves.bezahltVon,
            betzhalKunde: moves.betzhalKunde,
            bezahltDatum: moves.bezahltDatum,
            rechnungBetrag: moves.rechnungBetrag,
            rechnungAusgestellt: moves.rechnungAusgestellt,
            customerName: customers.firstName,
            customerLastName: customers.lastName,
            customerPhone: customers.phone,
            customerEmail: customers.email,
            customerSitz: customers.sitz,
            customerBezahlt: customers.bezahlt,
          })
          .from(moves)
          .leftJoin(customers, eq(moves.customerId, customers.id))
          .where(and(
            or(
              eq(moves.status, 'confirmed'),
              eq(moves.status, 'completed')
            ),
            input?.branchId ? eq(moves.branchId, input.branchId) : (ctx.user?.branchId ? eq(moves.branchId, ctx.user.branchId) : sql`1=1`)
          ));

        const moveIds = result.map(r => r.id);
        let customerPhotosByMove: Record<number, { id: number; imageUrl: string; imageKey: string }[]> = {};
        let taskMetaByMove: Record<number, { taskId: number | null; taskNotes: string | null }> = {};

        if (moveIds.length > 0) {
          const moveConditions = or(...moveIds.map(id => eq(moveImages.moveId, id)));
          const taskConditions = or(...moveIds.map(id => eq(tasks.moveId, id)));

          const allPhotos = await db
            .select({ id: moveImages.id, moveId: moveImages.moveId, imageUrl: moveImages.imageUrl, imageKey: moveImages.imageKey })
            .from(moveImages)
            .where(and(
              eq(moveImages.imageType, 'customer_photos'),
              moveConditions
            ));

          const relatedTasks = await db
            .select({ id: tasks.id, moveId: tasks.moveId, notes: tasks.notes, status: tasks.status, updatedAt: tasks.updatedAt })
            .from(tasks)
            .where(taskConditions);

          for (const photo of allPhotos) {
            if (!customerPhotosByMove[photo.moveId]) customerPhotosByMove[photo.moveId] = [];
            customerPhotosByMove[photo.moveId].push({ id: photo.id, imageUrl: photo.imageUrl, imageKey: photo.imageKey });
          }

          const sortedTasks = relatedTasks.sort((a, b) => {
            const aRank = a.status === 'in_progress' ? 0 : a.status === 'pending' ? 1 : 2;
            const bRank = b.status === 'in_progress' ? 0 : b.status === 'pending' ? 1 : 2;
            if (aRank !== bRank) return aRank - bRank;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });

          for (const task of sortedTasks) {
            if (!taskMetaByMove[task.moveId]) {
              taskMetaByMove[task.moveId] = {
                taskId: task.id,
                taskNotes: task.notes ?? null,
              };
            }
          }
        }

        return result.map((move) => ({
          ...move,
          customerName: [move.customerName, move.customerLastName].filter(Boolean).join(' ').trim(),
          kundenummer: formatCustomerNumber(move.customerId),
          customerPhotos: customerPhotosByMove[move.id] || [],
          taskId: taskMetaByMove[move.id]?.taskId ?? null,
          taskNotes: taskMetaByMove[move.id]?.taskNotes ?? null,
        }));
      } catch (e) {
        console.error('Error fetching worker moves:', e);
        return [];
      }
    }),
    // تقرير تلف (Schaden)
    reportSchaden: protectedProcedure
      .input(z.object({
        moveId: z.number(),
        description: z.string().min(1),
        images: z.array(z.object({
          name: z.string(),
          data: z.string(), // base64
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        // Branch isolation
        const { assertBranchAccess } = await import('./_core/context');
        const [existingMove] = await db.select({ branchId: moves.branchId }).from(moves).where(eq(moves.id, input.moveId)).limit(1);
        if (!existingMove) throw new Error('الطلب غير موجود');
        assertBranchAccess(ctx.user, existingMove.branchId);
        const { storagePut } = await import('./storage');
        let imageUrls: string[] = [];
        if (input.images && input.images.length > 0) {
          for (const img of input.images) {
            try {
              const buffer = Buffer.from(img.data.split(',')[1] || img.data, 'base64');
              const { url } = await storagePut(
                `moves/${input.moveId}/schaden/${Date.now()}-${img.name}`,
                buffer,
                'image/jpeg'
              );
              imageUrls.push(url);
            } catch (e) {
              console.error('Error uploading schaden image:', e);
            }
          }
        }
        await db.update(moves).set({
          schadenDescription: input.description,
          schadenImages: JSON.stringify(imageUrls),
        } as any).where(eq(moves.id, input.moveId));
        return { success: true };
      }),
    // تقرير شكوى (Beschwerde)
    reportBeschwerde: protectedProcedure
      .input(z.object({
        moveId: z.number(),
        description: z.string().min(1),
        images: z.array(z.object({
          name: z.string(),
          data: z.string(), // base64
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        // Branch isolation
        const { assertBranchAccess } = await import('./_core/context');
        const [existingMove] = await db.select({ branchId: moves.branchId }).from(moves).where(eq(moves.id, input.moveId)).limit(1);
        if (!existingMove) throw new Error('الطلب غير موجود');
        assertBranchAccess(ctx.user, existingMove.branchId);
        const { storagePut } = await import('./storage');
        let imageUrls: string[] = [];
        if (input.images && input.images.length > 0) {
          for (const img of input.images) {
            try {
              const buffer = Buffer.from(img.data.split(',')[1] || img.data, 'base64');
              const { url } = await storagePut(
                `moves/${input.moveId}/beschwerde/${Date.now()}-${img.name}`,
                buffer,
                'image/jpeg'
              );
              imageUrls.push(url);
            } catch (e) {
              console.error('Error uploading beschwerde image:', e);
            }
          }
        }
        await db.update(moves).set({
          beschwerdeDescription: input.description,
          beschwerdeImages: JSON.stringify(imageUrls),
        } as any).where(eq(moves.id, input.moveId));
        return { success: true };
      }),
    // إتمام المهمة (زر الإنجاز)
    complete: protectedProcedure
      .input(z.object({ moveId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        // Branch isolation
        const { assertBranchAccess } = await import('./_core/context');
        const [existingMove] = await db.select({ branchId: moves.branchId }).from(moves).where(eq(moves.id, input.moveId)).limit(1);
        if (!existingMove) throw new Error('الطلب غير موجود');
        assertBranchAccess(ctx.user, existingMove.branchId);
        await db.update(moves).set({
          status: 'completed',
          completedAt: new Date(),
        } as any).where(eq(moves.id, input.moveId));
        return { success: true };
      }),
    // تحديث بيانات الدفع من قِبل العامل
    updatePayment: protectedProcedure
      .input(z.object({
        moveId: z.number(),
        bankBetrag: z.number().optional(),   // مبلغ التحويل البنكي (€)
        barBetrag: z.number().optional(),    // مبلغ الكاش (€)
        paymentWay: z.string().optional(),   // Bank / Bar / Bank and Bar
        istBezahlt: z.number().optional(),   // 0 = Nein, 1 = Ja
        bezahltDatum: z.string().optional(), // ISO date string
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        // Branch isolation
        const { assertBranchAccess } = await import('./_core/context');
        const [existingMove] = await db.select({ branchId: moves.branchId }).from(moves).where(eq(moves.id, input.moveId)).limit(1);
        if (!existingMove) throw new Error('الطلب غير موجود');
        assertBranchAccess(ctx.user, existingMove.branchId);
        const updateData: Record<string, unknown> = {};
        if (input.bankBetrag !== undefined) updateData.bankBetrag = Math.round(input.bankBetrag * 100);
        if (input.barBetrag !== undefined) updateData.barBetrag = Math.round(input.barBetrag * 100);
        if (input.paymentWay !== undefined) updateData.paymentWay = input.paymentWay;
        if (input.istBezahlt !== undefined) {
          updateData.istBezahlt = input.istBezahlt;
          updateData.paymentStatus = input.istBezahlt === 1 ? 'paid' : 'unpaid';
        }
        if (input.bezahltDatum) updateData.bezahltDatum = new Date(input.bezahltDatum);
        await db.update(moves).set(updateData as any).where(eq(moves.id, input.moveId));
        return { success: true };
      }),
    // تحديث ملاحظات المهمة
    updateNotes: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        notes: z.string().max(1000),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        await db.update(tasks).set({
          notes: input.notes,
          updatedAt: new Date(),
        }).where(eq(tasks.id, input.taskId));
        return { success: true };
      }),
  }),
  templates: router({
    // جلب جميع القوالب
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(messageTemplates).orderBy(messageTemplates.id);
      } catch (e) {
        console.error('Error fetching templates:', e);
        return [];
      }
    }),
    // إنشاء أو تحديث قالب (upsert بالاسم)
    upsert: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string(),
        content: z.string(),
        language: z.string().default('de'),
        subject: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Templates are shared company-wide — only admins/branch_managers can modify.
        const allowedRoles = ['admin']; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) throw new Error('FORBIDDEN');
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        if (input.id) {
          await db.update(messageTemplates)
            .set({ content: input.content, subject: input.subject })
            .where(eq(messageTemplates.id, input.id));
          return { success: true };
        } else {
          await db.insert(messageTemplates).values({
            name: input.name,
            content: input.content,
            language: input.language,
            subject: input.subject,
            isDefault: 0,
          });
          return { success: true };
        }
      }),
    // إدراج القوالب الافتراضية إذا لم تكن موجودة
    seedDefaults: protectedProcedure
      .input(z.object({ templates: z.array(z.object({ name: z.string(), content: z.string() })) }))
      .mutation(async ({ input, ctx }) => {
        // Only admins can seed global defaults.
        if (ctx.user.role !== 'admin') throw new Error('FORBIDDEN');
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        const existing = await db.select({ name: messageTemplates.name }).from(messageTemplates);
        const existingNames = new Set(existing.map(t => t.name));
        const toInsert = input.templates.filter(t => !existingNames.has(t.name));
        if (toInsert.length > 0) {
          await db.insert(messageTemplates).values(
            toInsert.map(t => ({ name: t.name, content: t.content, language: 'de', isDefault: 1 }))
          );
        }
        return { inserted: toInsert.length };
      }),
  }),
  users: router({    // إنشاء مستخدم جديد من قِبَل المدير أو مدير الفرع
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        username: z.string().min(3),
        password: z.string().min(6),
        role: z.enum(['admin', 'branch_manager', 'supervisor', 'worker', 'sales']),
        branchId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const allowedRoles = ['admin']; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) throw new Error('FORBIDDEN');
        // مدير الفرع ينشئ مستخدمين في فرعه فقط ولا يستطيع إنشاء مدير عام
        if (ctx.user.role === 'branch_manager') {
          if (input.role === 'admin') throw new Error('FORBIDDEN: لا يمكنك إنشاء مدير عام');
          // يجبر الفرع على فرع مدير الفرع
          if (!ctx.user.branchId) throw new Error('FORBIDDEN: لا يوجد فرع مخصص لك');
          input.branchId = ctx.user.branchId;
        }
        const { createLocalUser } = await import('./_core/localAuth');
        const result = await createLocalUser({
          name: input.name,
          username: input.username,
          password: input.password,
          role: input.role,
          branchId: input.branchId ?? null,
        });
        if (!result.success) throw new Error(result.error || 'Fehler beim Erstellen');
        return { success: true, userId: result.userId };
      }),
    // تحديث كلمة سر مستخدم محلي (للمدير العام ومدير الفرع)
    updatePassword: protectedProcedure
      .input(z.object({
        userId: z.number(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const allowedRoles = ['admin']; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) throw new Error('FORBIDDEN');
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        // مدير الفرع يتحقق أن المستخدم في فرعه
        if (ctx.user.role === 'branch_manager') {
          const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (!targetUser || targetUser.branchId !== ctx.user.branchId) {
            throw new Error('FORBIDDEN: المستخدم ليس في فرعك');
          }
        }
        const { updateLocalUserPassword } = await import('./_core/localAuth');
        await updateLocalUserPassword(input.userId, input.newPassword);
        return { success: true };
      }),
    // قائمة المستخدمين (للمدير العام ومدير الفرع)
    list: protectedProcedure.query(async ({ ctx }) => {
      const allowedRoles = ['admin', 'branch_manager'];
      if (!allowedRoles.includes(ctx.user.role)) {
        throw new Error('FORBIDDEN');
      }
      const db = await getDb();
      if (!db) return [];
      try {
        // مدير الفرع يرى فقط مستخدمي فرعه (بدون المدراء العاميين) - فقط النشطين
         if (ctx.user.role === 'branch_manager' && ctx.user.branchId) {
          return await db.select().from(users)
            .where(and(
              eq(users.branchId, ctx.user.branchId),
              sql`${users.role} != 'admin'`,
              sql`${users.isActive} = 1`
            ));
        }
        // المدير العام يرى النشطين فقط
        return await db.select().from(users).where(sql`${users.isActive} = 1`);     } catch (e) {
        console.error('Error fetching users:', e);
        return [];
      }
    }),
    // تغيير دور مستخدم (للمدير العام ومدير الفرع)
    updateRole: protectedProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['admin', 'branch_manager', 'supervisor', 'worker', 'sales']),
      }))
      .mutation(async ({ ctx, input }) => {
        const allowedRoles = ['admin']; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) throw new Error('FORBIDDEN');
        if (input.userId === ctx.user.id) throw new Error('لا يمكنك تغيير دورك الخاص');
        // مدير الفرع لا يستطيع تعيين دور مدير عام
        if (ctx.user.role === 'branch_manager' && input.role === 'admin') {
          throw new Error('FORBIDDEN: لا يمكنك تعيين دور مدير عام');
        }
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        // مدير الفرع يتحقق أن المستخدم في فرعه
        if (ctx.user.role === 'branch_manager') {
          const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (!targetUser || targetUser.branchId !== ctx.user.branchId) {
            throw new Error('FORBIDDEN: المستخدم ليس في فرعك');
          }
        }
        await db.update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),
    // تعديل بيانات مستخدم (للمدير العام ومدير الفرع)
    updateProfile: protectedProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().min(1).optional(),
        username: z.string().min(3).optional(),
        branchId: z.number().nullable().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const allowedRoles = ['admin']; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) throw new Error('FORBIDDEN');
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        // مدير الفرع يتحقق أن المستخدم في فرعه ولا يغير الفرع
        if (ctx.user.role === 'branch_manager') {
          const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (!targetUser || targetUser.branchId !== ctx.user.branchId) {
            throw new Error('FORBIDDEN: المستخدم ليس في فرعك');
          }
          // مدير الفرع لا يستطيع تغيير الفرع
          delete (input as any).branchId;
        }
        const updateData: Record<string, unknown> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.username !== undefined) {
          const normalizedUsername = input.username.trim();
          if (!normalizedUsername) {
            throw new Error('اسم المستخدم مطلوب');
          }
          const { findLocalUserByUsername } = await import('./_core/localAuth');
          const existingUser = await findLocalUserByUsername(normalizedUsername);
          if (existingUser && existingUser.id !== input.userId) {
            throw new Error('اسم المستخدم مستخدم بالفعل');
          }
          updateData.username = normalizedUsername;
        }
        if (input.branchId !== undefined) updateData.branchId = input.branchId;
        if (Object.keys(updateData).length === 0) {
          return { success: true, message: 'لا تغييرات' };
        }
        await db.update(users)
          .set(updateData)
          .where(eq(users.id, input.userId));
        return { success: true };
      }),
    // تحديث الفرع للعامل (للعامل نفسه فقط)
    updateBranch: protectedProcedure
      .input(z.object({
        userId: z.number(),
        branchId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // العامل يستطيع تحديث فرعه فقط
        if (ctx.user.id !== input.userId && ctx.user.role !== 'admin') {
          throw new Error('FORBIDDEN');
        }
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        await db.update(users)
          .set({ branchId: input.branchId })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),
    // حذف مستخدم (للمدير العام ومدير الفرع)
    delete: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const allowedRoles = ['admin']; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) throw new Error('FORBIDDEN');
        if (input.userId === ctx.user.id) throw new Error('لا يمكنك حذف حسابك الخاص');
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        // مدير الفرع يتحقق أن المستخدم في فرعه
        if (ctx.user.role === 'branch_manager') {
          const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
          if (!targetUser || targetUser.branchId !== ctx.user.branchId) {
            throw new Error('FORBIDDEN: المستخدم ليس في فرعك');
          }
        }
        // Soft delete: تعطيل الحساب بدلاً من الحذف الفعلي لمنع إعادة الإنشاء عبر OAuth
        await db.update(users).set({ isActive: 0 } as any).where(eq(users.id, input.userId));
        return { success: true };
      }),
  }),

  // ===== INVOICES ROUTER =====
  invoices: router({
    // جلب قائمة الفواتير مع بحث وتصفية (للمدير وفريق المبيعات فقط)
    getAll: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        isPaid: z.enum(['all', 'paid', 'unpaid']).optional().default('all'),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        branchId: z.number().nullable().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');

        // التحقق من الصلاحيات
        const allowedRoles = ['admin', 'sales']; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) {
          throw new Error('Zugriff verweigert');
        }

        const { getEffectiveBranchId } = await import('./_core/context');
        const effectiveBranchId = getEffectiveBranchId(ctx.user, input.branchId ?? undefined);

        const conditions: any[] = [];

        // فلتر الفرع
        if (effectiveBranchId) {
          conditions.push(eq(invoices.branchId, effectiveBranchId));
        }

        // فلتر البحث
        if (input.search) {
          conditions.push(
            or(
              like(invoices.invoiceNumber, `%${input.search}%`),
              like(invoices.customerName, `%${input.search}%`)
            )
          );
        }

        // فلتر حالة الدفع
        if (input.isPaid === 'paid') {
          conditions.push(eq(invoices.isPaid, 1));
        } else if (input.isPaid === 'unpaid') {
          conditions.push(eq(invoices.isPaid, 0));
        }

        const query = db
          .select()
          .from(invoices)
          .orderBy(desc(invoices.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        if (conditions.length > 0) {
          const result = await query.where(and(...conditions));
          return result;
        }

        return await query;
      }),

    // إحصائيات الفواتير
    getStats: protectedProcedure
      .input(z.object({
        branchId: z.number().nullable().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB not available');

        const allowedRoles = ['admin', 'sales']; // branch_manager is read-only
        if (!allowedRoles.includes(ctx.user.role)) {
          throw new Error('Zugriff verweigert');
        }

        const { getEffectiveBranchId } = await import('./_core/context');
        const effectiveBranchId = getEffectiveBranchId(ctx.user, input?.branchId ?? undefined);

        const statsQuery = db
          .select({
            total: sql<number>`COUNT(*)`,
            totalAmount: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0)`,
            paidCount: sql<number>`SUM(CASE WHEN is_paid = 1 THEN 1 ELSE 0 END)`,
            paidAmount: sql<number>`COALESCE(SUM(CASE WHEN is_paid = 1 THEN CAST(amount AS DECIMAL(10,2)) ELSE 0 END), 0)`,
            unpaidCount: sql<number>`SUM(CASE WHEN is_paid = 0 THEN 1 ELSE 0 END)`,
            unpaidAmount: sql<number>`COALESCE(SUM(CASE WHEN is_paid = 0 THEN CAST(amount AS DECIMAL(10,2)) ELSE 0 END), 0)`,
          })
          .from(invoices);

        const [totalResult] = effectiveBranchId
          ? await statsQuery.where(eq(invoices.branchId, effectiveBranchId))
          : await statsQuery;

        return {
          total: Number(totalResult?.total || 0),
          totalAmount: Number(totalResult?.totalAmount || 0),
          paidCount: Number(totalResult?.paidCount || 0),
          paidAmount: Number(totalResult?.paidAmount || 0),
          unpaidCount: Number(totalResult?.unpaidCount || 0),
          unpaidAmount: Number(totalResult?.unpaidAmount || 0),
        };
      }),

    // إعادة توليد PDF لفاتورة موجودة
    regenerate: protectedProcedure
      .input(z.object({ moveId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const allowedRoles = ['admin', 'sales'];
        if (!allowedRoles.includes(ctx.user.role)) {
          throw new Error('Zugriff verweigert');
        }
        // استخدام نفس منطق generateInvoice
        const db = await getDb();
        if (!db) throw new Error('DB not available');
        const moveResult = await db
          .select()
          .from(moves)
          .leftJoin(customers, eq(moves.customerId, customers.id))
          .leftJoin(branches, eq(moves.branchId, branches.id))
          .where(eq(moves.id, input.moveId))
          .limit(1);
        if (!moveResult.length) throw new Error('Auftrag nicht gefunden');
        const { moves: move, customers: customer, branches: branch } = moveResult[0];
        if (!customer) throw new Error('Kundendaten nicht gefunden');
        const today = new Date();
        const invoiceDate = today.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const moveDate = move.pickupDate ? new Date(move.pickupDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
        const paymentDate = move.bezahltDatum ? new Date(move.bezahltDatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : undefined;
        const customerAddress = move.pickupAddress || 'N/A';
        const serviceType = move.moveType || 'Umzug';
        const fromCity = move.pickupAddress ? move.pickupAddress.split(',').pop()?.trim() || '' : '';
        const toCity = move.deliveryAddress ? move.deliveryAddress.split(',').pop()?.trim() || '' : '';
        const serviceDescription = `${serviceType}sleistung${fromCity && toCity ? ` von ${fromCity} nach ${toCity}` : ''} – Leistungsdatum: ${moveDate}`;
        const totalAmount = getInvoiceTotalCents(move);
        const branchName = branch?.name || 'Check Umzug';
        const branchAddress = branch?.address || branch?.city || 'Deutschland';
        const invoiceData: InvoiceData = {
          companyName: branchName, companyAddress: branchAddress, companyPhone: branch?.phone || '', companyEmail: branch?.email || '',
          customerName: `${customer.title ? customer.title + ' ' : ''}${customer.firstName} ${customer.lastName}`,
          customerAddress, customerPhone: customer.phone || 'N/A', customerEmail: customer.email || 'N/A',
          invoiceNumber: move.rechnungNummer || `RE-${move.moveCode || move.id}`,
          invoiceDate, moveDate, serviceDescription, totalAmount,
          isPaid: move.istBezahlt === 1, paymentDate, paymentMethod: move.paymentWay || undefined,
        };
        const html = generateInvoiceHTML(invoiceData);
        const pdfBuffer = await generatePDF(html);
        const base64 = pdfBuffer.toString('base64');
        return { base64, filename: `Rechnung_${invoiceData.invoiceNumber}.pdf` };
      }),
  }),
});

export type AppRouter = typeof appRouter;
