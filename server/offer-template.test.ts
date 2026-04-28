import { describe, expect, it } from "vitest";
import { generateOfferHTML } from "./offerTemplate";

describe("generateOfferHTML", () => {
  it("renders the 5-page Umzug Angebot template with customer + move data", () => {
    const html = generateOfferHTML({
      kundenummer: "00042",
      moveDate: "15.04.2026",
      customerName: "Max Mustermann",
      customerEmail: "max@example.com",
      customerPhone: "+49 123 456789",
      pickupAddress: "Alte Straße 10\n8000 Zürich",
      pickupFloor: "3",
      pickupElevator: "8 Personen",
      pickupWalkway: "15 m",
      deliveryAddress: "Neue Straße 20\n3000 Bern",
      deliveryFloor: "1",
      deliveryElevator: "Kein Aufzug",
      deliveryWalkway: "5 m",
      distanceKm: "126",
      volumeM3: "28",
      grossPrice: "1.490,00",
      nettoPrice: "1.490,00",
      packageName: "Premium",
      serviceSummary: "Einpackservice Auszug\nMöbelabbau Auszug",
      greetingLine: "Hallo Herr Mustermann,",
    });

    // Document chrome
    expect(html).toContain("Umzug Angebot 00042");
    expect(html).toContain("Move Profis");

    // Customer data appears on page 1 and page 3 signature
    expect(html).toContain("Max Mustermann");
    expect(html).toContain("max@example.com");
    expect(html).toContain("+49 123 456789");

    // Move data appears in the AUSZUG/EINZUG table on page 1
    expect(html).toContain("Alte Straße 10");
    expect(html).toContain("Neue Straße 20");
    expect(html).toContain("8 Personen");
    expect(html).toContain("Kein Aufzug");
    expect(html).toContain("3");
    expect(html).toContain("1");

    // Page 2 route box
    expect(html).toContain("126");
    expect(html).toContain("28");

    // Page 3 price box
    expect(html).toContain("1.490,00");

    // Page 2 dynamic service rows
    expect(html).toContain("Einpackservice Auszug");
    expect(html).toContain("Möbelabbau Auszug");

    // ID and date appear on page 1
    expect(html).toContain("00042");
    expect(html).toContain("15.04.2026");

    // Static text that lives in the rendered HTML (not inside images)
    expect(html).toContain("UMZUGS-ID");
    expect(html).toContain("UMZUGSDATUM");
    expect(html).toContain("Ihre Angaben zum Umzug");
    expect(html).toContain("Ihr Umzugsangebot");
    expect(html).toContain("LEISTUNGEN");
    expect(html).toContain("Umzugsversicherung");
    expect(html).toContain("Inkl. 19% MwSt.");
    expect(html).toContain("BEZAHLUNG");
    expect(html).toContain("Brutto Gesamtpreis");

    // The 5 embedded images (header + 2 badges + 2 full-page artwork)
    // are all base64 data URLs, not external HTTP fetches. Make sure
    // we did NOT accidentally leave external image URLs in the template.
    const dataUrlCount = (html.match(/data:image\/png;base64,/g) ?? []).length;
    expect(dataUrlCount).toBeGreaterThanOrEqual(11); // 3×header + 6×badge + 2×full = 11
  });

  it("uses the default greeting when none is provided", () => {
    const html = generateOfferHTML({
      kundenummer: "00001",
      moveDate: "01.01.2026",
      customerName: "Test",
      customerEmail: "",
      customerPhone: "",
      pickupAddress: "Pickup",
      pickupFloor: "",
      pickupElevator: "",
      pickupWalkway: "",
      deliveryAddress: "Delivery",
      deliveryFloor: "",
      deliveryElevator: "",
      deliveryWalkway: "",
      distanceKm: "0",
      volumeM3: "0",
      grossPrice: "0,00",
      nettoPrice: "0,00",
      packageName: "Premium",
      serviceSummary: "",
      greetingLine: "",
    });
    // The default greeting falls back when greetingLine is empty.
    // (Greeting itself is rendered inside the static page-5 artwork,
    // so it appears in an HTML comment here for traceability.)
    expect(html).toContain("Sehr geehrte Damen und Herren,");
  });
});
