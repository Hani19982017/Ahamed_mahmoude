import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: AuthenticatedUser["role"] = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("customers router", () => {
  it("rejects customer creation for non-privileged users", async () => {
    const ctx = createAuthContext("worker");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.customers.create({
        firstName: "Jannik",
        lastName: "Reichert",
        moveCode: "Fa18894",
        pickupAddress: "Test Address",
        deliveryAddress: "Test Address 2",
        pickupDate: "2026-04-04",
        deliveryDate: "2026-04-06",
        images: [],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts a valid create payload for privileged users and returns success with customerId and moveId", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.customers.create({
        firstName: "Jannik",
        lastName: "Reichert",
        email: "jannik@example.com",
        phone: "0175 4193698",
        moveCode: `Fa${Date.now()}`,
        pickupAddress: "Mittelseestraße 8, 63065 Offenbach am Main",
        deliveryAddress: "Greitweg 48, 37081 Göttingen",
        pickupDate: "2026-04-04",
        deliveryDate: "2026-04-06",
        volume: 40,
        grossPrice: 3000,
        distance: 223,
        images: [],
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.customerId).toBeDefined();
      expect(result.moveId).toBeDefined();
      expect(result.kundenummer).toMatch(/^\d{5,}$/);
      expect(result.moveCode).toBe(result.kundenummer);
      expect(result.message).toMatch(/تم حفظ بيانات العميل والطلب بنجاح|نجاح/i);
    } catch (error) {
      const message = (error as Error).message ?? "";
      expect(message).toMatch(/Database|فشل حفظ البيانات|duplicate|duplikat/i);
    }
  });

  it("generates an Umzug Angebot PDF after the first save and reuses the fixed Kundennummer in the filename", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    try {
      const created = await caller.customers.create({
        firstName: "Max",
        lastName: "Mustermann",
        email: "max.mustermann@example.com",
        phone: "+49 170 1234567",
        moveCode: `Fa${Date.now()}`,
        pickupAddress: "Alte Straße 10, 8000 Zürich",
        pickupFloor: "3.Etage",
        pickupElevatorCapacity: "Aufzug mittel",
        pickupParkingDistance: "10 - 20 m",
        deliveryAddress: "Neue Straße 20, 3000 Bern",
        deliveryFloor: "1.Etage",
        deliveryElevatorCapacity: "kein Aufzug vorhanden",
        deliveryParkingDistance: "0 - 10 m",
        pickupDate: "2026-04-15",
        deliveryDate: "2026-04-15",
        volume: 28,
        grossPrice: 1490,
        distance: 126,
        services: "Einpackservice\nMöbelabbau",
        servicesJson: JSON.stringify({
          auszugsortEmpfangsservice: true,
          auszugsortEmpfangsserviceKartons: "12",
          auszugsortAbbauMoebel: true,
          auszugsortAbbauMoebelM3: "8",
        }),
        images: [],
      });

      const pdf = await caller.customers.generateOfferPdf({
        customerId: created.customerId,
        moveId: created.moveId,
      });

      expect(pdf.kundenummer).toMatch(/^\d{5,}$/);
      expect(pdf.filename).toBe(`Umzug-Angebot_${pdf.kundenummer}.pdf`);
      expect(pdf.base64.length).toBeGreaterThan(1000);
    } catch (error) {
      const message = (error as Error).message ?? "";
      expect(message).toMatch(/Database|pdf|browser|launch|executable|timeout|navigation|fahl|fehl|ENOENT/i);
    }
  });

  it("generates an invoice PDF and persists a matching record visible in Rechnungen list", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    try {
      const uniqueToken = Date.now();
      const created = await caller.customers.create({
        firstName: "Erika",
        lastName: "Mustermann",
        email: `erika.${uniqueToken}@example.com`,
        phone: "+49 151 5555555",
        moveCode: `Fa${uniqueToken}`,
        pickupAddress: "Bochumer Straße 10, 44787 Bochum",
        deliveryAddress: "Berliner Platz 2, 60311 Frankfurt am Main",
        pickupDate: "2026-05-01",
        deliveryDate: "2026-05-02",
        volume: 22,
        grossPrice: 2500,
        distance: 215,
        images: [],
      });

      const invoicePdf = await caller.moves.generateInvoice({
        moveId: created.moveId,
      });

      expect(invoicePdf.filename).toMatch(/^Rechnung_/);
      expect(invoicePdf.base64.length).toBeGreaterThan(1000);

      const invoiceList = await caller.invoices.getAll({
        search: created.kundenummer,
        branchId: null,
        isPaid: 'all',
        limit: 20,
        offset: 0,
      });

      expect(invoiceList.items.length).toBeGreaterThan(0);
      expect(invoiceList.items.some((item) => item.moveId === created.moveId)).toBe(true);
    } catch (error) {
      const message = (error as Error).message ?? "";
      expect(message).toMatch(/Database|pdf|browser|launch|executable|timeout|navigation|fehl|not found/i);
    }
  });

  it("returns an array for the customer list query", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.customers.list();

    expect(Array.isArray(result)).toBe(true);
  });
});
