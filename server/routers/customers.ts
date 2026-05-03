import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { customers, moves, moveImages, customerReminders } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { formatCustomerNumber } from "../../shared/customerNumber";
import { generatePDF } from "../pdfGenerator";
import { generateOfferHTML } from "../offerTemplate";

function attachCustomerNumber<T extends { id: number }>(customer: T) {
  return {
    ...customer,
    kundenummer: formatCustomerNumber(customer.id),
  };
}

function formatDateForOffer(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-DE").format(date);
}

function formatMoneyForOffer(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(numeric)) return "0,00";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function parseServicesJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildOfferSummary(servicesJson: Record<string, unknown>, servicesText: string | null | undefined) {
  const lines: string[] = [];

  if (servicesJson.auszugsortEmpfangsservice) {
    lines.push(`Einpackservice Auszug (${String(servicesJson.auszugsortEmpfangsserviceKartons ?? 0)} Kartons)`);
  }
  if (servicesJson.einzugsortAuspacksservice) {
    lines.push(`Auspackservice Einzug (${String(servicesJson.einzugsortAuspacksserviceKartons ?? 0)} Kartons)`);
  }
  if (servicesJson.auszugsortAbbauMoebel) {
    lines.push(`Möbelabbau Auszug (${String(servicesJson.auszugsortAbbauMoebelM3 ?? 0)} m³)`);
  }
  if (servicesJson.einzugsortAufbauMoebel) {
    lines.push(`Möbelaufbau Einzug (${String(servicesJson.einzugsortAufbauMoebelM3 ?? 0)} m³)`);
  }
  if (servicesJson.auszugsortAbbauKueche) {
    lines.push(`Küchenabbau (${String(servicesJson.auszugsortAbbauKuecheM3 ?? 0)} m³)`);
  }
  if (servicesJson.einzugsortAufbauKueche) {
    lines.push(`Küchenaufbau (${String(servicesJson.einzugsortAufbauKuecheM3 ?? 0)} m³)`);
  }
  if (Number(servicesJson.umzugskartons ?? 0) > 0) {
    lines.push(`Umzugskartons: ${String(servicesJson.umzugskartons)}`);
  }
  if (Number(servicesJson.kleiderkartons ?? 0) > 0) {
    lines.push(`Kleiderkartons: ${String(servicesJson.kleiderkartons)}`);
  }
  if (servicesJson.klaviertransport) {
    lines.push(`Klaviertransport (${String(servicesJson.klavierGross ?? "Standard")})`);
  }
  if (servicesJson.endreinigung) {
    lines.push("Endreinigung");
  }
  if (servicesJson.entsorgungMoebel) {
    lines.push(`Entsorgung (${String(servicesJson.entsorgungType ?? "Standard")}, ${String(servicesJson.entsorgungM3 ?? 0)} m³)`);
  }
  if (servicesJson.anschlussWaschmaschine) {
    lines.push("Anschluss Waschmaschine");
  }
  if (String(servicesJson.sonstigeLeistung ?? "").trim()) {
    lines.push(`Sonstige Leistung: ${String(servicesJson.sonstigeLeistung)}`);
  }

  if (lines.length === 0 && servicesText?.trim()) {
    return servicesText.trim();
  }

  if (servicesText?.trim()) {
    lines.push(servicesText.trim());
  }

  return lines.join("\n");
}

export const customersRouter = router({
  /**
   * Create a new customer and move order
   */
  create: protectedProcedure
    .input(
      z.object({
        // Branch data - يمكن أن يكون null ويُحدَّد تلقائياً من المستخدم
        branchId: z.number().nullable().optional(),
        // Customer data
       title: z.string().optional(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
        versuch: z.string().optional(),
        // reminderDate (YYYY-MM-DD) — sales sets a follow-up date here.
        // The customer appears in the Reminders section once this date arrives.
        // null/undefined = no reminder scheduled.
        reminderDate: z.string().nullable().optional(),

        // Move data
        moveCode: z.string().min(1).optional(),
        pickupAddress: z.string().min(1),
        pickupFloor: z.string().optional(),
        pickupElevatorCapacity: z.string().optional(),
        pickupParkingDistance: z.string().optional(),
        deliveryAddress: z.string().min(1),
        deliveryFloor: z.string().optional(),
        deliveryElevatorCapacity: z.string().optional(),
        deliveryParkingDistance: z.string().optional(),
        pickupDate: z.string(),
        deliveryDate: z.string(),
        volume: z.number().optional(),
        grossPrice: z.number().optional(),
        distance: z.number().optional(),
        numTrips: z.number().optional(),
        moveType: z.string().optional(),
        services: z.string().optional(),
        servicesJson: z.string().optional(),

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

        // Images (as base64 or URLs)
        images: z
          .array(
            z.object({
              name: z.string(),
              data: z.string(), // base64 encoded
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin", "sales", "supervisor"]; // branch_manager is read-only
      if (!allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Keine Berechtigung zum Erstellen von Kunden",
        });
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const effectiveBranchId: number = input.branchId ?? ctx.user.branchId ?? 1;

      try {
      const customerResult = await db
          .insert(customers)
          .values({
            branchId: effectiveBranchId,
            title: input.title,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            company: input.company,
            notes: input.notes,
            versuch: input.versuch,
          })
          .$returningId();

        const customerId = customerResult[0]?.id;

        if (!customerId) {
          throw new Error("فشل استرداد معرف العميل بعد الإنشاء");
        }

        const kundenummer = formatCustomerNumber(customerId);
        const moveCode = kundenummer;

        const moveResult = await db
          .insert(moves)
          .values({
            branchId: effectiveBranchId,
            customerId,
            moveCode,
            pickupAddress: input.pickupAddress,
            pickupFloor: input.pickupFloor,
            pickupElevatorCapacity: input.pickupElevatorCapacity,
            pickupParkingDistance: input.pickupParkingDistance,
            deliveryAddress: input.deliveryAddress,
            deliveryFloor: input.deliveryFloor,
            deliveryElevatorCapacity: input.deliveryElevatorCapacity,
            deliveryParkingDistance: input.deliveryParkingDistance,
            pickupDate: new Date(input.pickupDate),
            deliveryDate: new Date(input.deliveryDate),
            volume: input.volume,
            grossPrice: input.grossPrice ? input.grossPrice.toFixed(2) : "0.00",
            distance: input.distance,
            numTrips: input.numTrips || 0,
            moveType: input.moveType,
            services: input.services,
            servicesJson: input.servicesJson,
            paymentStatus: input.istBezahlt ? "paid" : "unpaid",
            bezahltVon: input.bezahltVon,
            betzhalKunde: input.betzhalKunde,
            istBezahlt: input.istBezahlt ? 1 : 0,
            paymentWay: input.paymentWay,
            auditTotalPrice: input.auditTotalPrice ? Math.round(input.auditTotalPrice * 100) : undefined,
            bezahltDatum: input.bezahltDatum ? new Date(input.bezahltDatum) : undefined,
            bankBetrag: input.bankBetrag ? Math.round(input.bankBetrag * 100) : undefined,
            barBetrag: input.barBetrag ? Math.round(input.barBetrag * 100) : undefined,
            rechnungAusgestellt: input.rechnungAusgestellt ? 1 : 0,
            rechnungBetrag: input.rechnungBetrag ? Math.round(input.rechnungBetrag * 100) : undefined,
            rechnungNummer: input.rechnungNummer,
          })
          .$returningId();

        const moveId = moveResult[0]?.id;

        if (!moveId) {
          throw new Error("فشل استرداد معرف الطلب بعد الإنشاء");
        }

        if (input.images && input.images.length > 0) {
          for (const image of input.images) {
            try {
              const buffer = Buffer.from(image.data.split(",")[1] || image.data, "base64");
              const { url, key } = await storagePut(`moves/${moveId}/${Date.now()}-${image.name}`, buffer, "image/jpeg");

              await db.insert(moveImages).values({
                moveId,
                imageUrl: url,
                imageKey: key,
                imageType: "customer_photos",
                uploadedBy: ctx.user.id,
              } as any);
            } catch (error) {
              console.error("Error uploading image:", error);
            }
          }
        }

        // forget to call/whatsapp this new customer.
        try {
          const fullName = [input.title, input.firstName, input.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
       await db.insert(customerReminders).values({
            customerId,
            branchId: effectiveBranchId,
            customerName: fullName || "Unbekannt",
            kundennummer: kundenummer,
            versuch: input.versuch ?? null,
            // Convert ISO date string → Date object for the DATE column.
            // null is preserved so customers without a reminder are hidden in the list.
            reminderDate: input.reminderDate ? new Date(input.reminderDate) : null,
          });
        } catch (reminderError) {
          // Reminder creation should never block the main customer save.
          console.error("Failed to create reminder:", reminderError);
        }

        return {
          success: true,
          customerId,
          kundenummer,
          moveId,
          moveCode,
          message: "تم حفظ بيانات العميل والطلب بنجاح",
        };
      } catch (error) {
        console.error("Error creating customer:", error);
        throw new Error("فشل حفظ البيانات");
      }
    }),

  /**
   * Get all customers
   */
  list: protectedProcedure
    .input(z.object({ branchId: z.number().nullable().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const { getEffectiveBranchId } = await import("../_core/context");
        const effectiveBranchId = getEffectiveBranchId(ctx.user, input?.branchId);
        const result = effectiveBranchId
          ? await db.select().from(customers).where(eq(customers.branchId, effectiveBranchId))
          : await db.select().from(customers);

        return result.map(attachCustomerNumber);
      } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
      }
    }),

  /**
   * Get customer by ID with their moves
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const customer = await db.select().from(customers).where(eq(customers.id, input.id)).limit(1);

        if (customer.length === 0) return null;

        const { getEffectiveBranchId } = await import("../_core/context");
        const effectiveBranchId = getEffectiveBranchId(ctx.user, null);
        if (effectiveBranchId && customer[0].branchId !== effectiveBranchId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Keine Berechtigung, diesen Kunden anzuzeigen",
          });
        }

        const customerMoves = await db.select().from(moves).where(eq(moves.customerId, input.id));

        const movesWithImages = await Promise.all(
          customerMoves.map(async (move) => {
            const images = await db.select().from(moveImages).where(eq(moveImages.moveId, move.id));
            return { ...move, images, kundenummer: formatCustomerNumber(move.customerId) };
          }),
        );

        return {
          ...attachCustomerNumber(customer[0]),
          moves: movesWithImages,
        };
      } catch (error) {
        console.error("Error fetching customer:", error);
        return null;
      }
    }),

  generateOfferPdf: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        moveId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allowedRoles = ["admin", "sales", "supervisor"]; // branch_manager is read-only
      if (!allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Keine Berechtigung zum Erstellen von Angeboten",
        });
      }

      const customerRows = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      const moveRows = await db.select().from(moves).where(eq(moves.id, input.moveId)).limit(1);

      const customer = customerRows[0];
      const move = moveRows[0];

      if (!customer || !move || move.customerId !== customer.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kunde oder Auftrag nicht gefunden",
        });
      }

      const { getEffectiveBranchId } = await import("../_core/context");
      const effectiveBranchId = getEffectiveBranchId(ctx.user, null);
      if (effectiveBranchId && customer.branchId !== effectiveBranchId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Keine Berechtigung für dieses Angebot",
        });
      }

      const kundenummer = formatCustomerNumber(customer.id);
      const servicesJson = parseServicesJson((move as any).servicesJson);
      const customerName = `${customer.title ? `${customer.title} ` : ""}${customer.firstName} ${customer.lastName}`.trim();
      const moveDate = formatDateForOffer((move as any).pickupDate);
      const grossPriceNumeric = Number((move as any).grossPrice ?? 0);
      const grossPrice = formatMoneyForOffer(grossPriceNumeric);
      const nettoPrice = grossPrice;
      const volumeValue = Number((move as any).volume ?? 0);
      const distanceValue = Number((move as any).distance ?? 0);
      const serviceSummary = buildOfferSummary(servicesJson, (move as any).services ?? undefined);
      const greetingName = customer.lastName?.trim() ? `${customer.title ?? ""} ${customer.lastName}`.trim() : customerName;

      const html = generateOfferHTML({
        kundenummer,
        moveDate,
        customerName,
        customerEmail: customer.email ?? "",
        customerPhone: customer.phone ?? "",
        pickupAddress: (move as any).pickupAddress ?? "-",
        pickupFloor: String((move as any).pickupFloor ?? "-"),
        pickupElevator: String((move as any).pickupElevatorCapacity ?? "-"),
        pickupWalkway: String((move as any).pickupParkingDistance ?? "-"),
        deliveryAddress: (move as any).deliveryAddress ?? "-",
        deliveryFloor: String((move as any).deliveryFloor ?? "-"),
        deliveryElevator: String((move as any).deliveryElevatorCapacity ?? "-"),
        deliveryWalkway: String((move as any).deliveryParkingDistance ?? "-"),
        distanceKm: Number.isFinite(distanceValue) && distanceValue > 0 ? formatMoneyForOffer(distanceValue).replace(/,00$/, "") : "0",
        volumeM3: Number.isFinite(volumeValue) && volumeValue > 0 ? formatMoneyForOffer(volumeValue).replace(/,00$/, "") : "0",
        grossPrice,
        nettoPrice,
        packageName: "Premium",
        serviceSummary,
        greetingLine: `Hallo ${greetingName},`,
      });

      const pdfBuffer = await generatePDF(html, {
        margin: {
          top: "0mm",
          right: "0mm",
          bottom: "0mm",
          left: "0mm",
        },
        preferCSSPageSize: true,
      });

      return {
        filename: `Umzug-Angebot_${kundenummer}.pdf`,
        base64: pdfBuffer.toString("base64"),
        kundenummer,
      };
    }),

  /**
   * Delete customer (admin only)
   */
  delete: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const allowedRoles = ["admin"]; // branch_manager is read-only
      if (!allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nur Administratoren können Kunden löschen",
        });
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      try {
        const customer = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
        if (customer.length === 0) throw new Error("Customer not found");

        const { getEffectiveBranchId } = await import("../_core/context");
        const effectiveBranchId = getEffectiveBranchId(ctx.user, null);
        if (effectiveBranchId && customer[0].branchId !== effectiveBranchId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Keine Berechtigung, diesen Kunden zu löschen",
          });
        }

        const customerMoves = await db.select({ id: moves.id }).from(moves).where(eq(moves.customerId, input.customerId));
        const moveIds = customerMoves.map((m) => m.id);
        if (moveIds.length > 0) {
          for (const moveId of moveIds) {
            await db.delete(moveImages).where(eq(moveImages.moveId, moveId)).catch(() => {});
          }
        }
        await db.delete(moves).where(eq(moves.customerId, input.customerId));
        await db.delete(customers).where(eq(customers.id, input.customerId));
        return { success: true };
      } catch (error) {
        console.error("Error deleting customer:", error);
        throw new Error("فشل حذف العميل");
      }
    }),

  /**
   * Update customer
   */
  update: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        data: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          company: z.string().optional(),
          source: z.string().optional(),
          notes: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        await db.update(customers).set(input.data).where(eq(customers.id, input.customerId));
        return { success: true, kundenummer: formatCustomerNumber(input.customerId) };
      } catch (error) {
        console.error("Error updating customer:", error);
        throw new Error("فشل تحديث البيانات");
      }
    }),
});
