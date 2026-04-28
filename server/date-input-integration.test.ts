import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("date input integration", () => {
  it("wires NewCustomer move date fields through the shared Input component", () => {
    const pagePath = path.resolve(process.cwd(), "client/src/pages/NewCustomer.tsx");
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).toContain('<Field label="Umzug Termin Von"><Input type="date"');
    expect(source).toContain('<Field label="Umzug Termin Bis"><Input type="date"');
    expect(source).toContain('<Field label="Datum Parkzone"><Input type="date"');
    expect(source).toContain('<Field label="Betzhlt Datum">');
    expect(source).toContain('<Input type="date" value={bezahltDatum}');
  });

  it("keeps MoveDetailDialog move date fields on the shared Input abstraction", () => {
    const dialogPath = path.resolve(process.cwd(), "client/src/components/MoveDetailDialog.tsx");
    const source = fs.readFileSync(dialogPath, "utf8");

    expect(source).toContain('const inp = (v: string, s: (x: string) => void');
    expect(source).toContain(': <Input value={v} onChange={e => s(e.target.value)} {...p} />;');
    expect(source).toContain('Field label="Umzug Termin Von">{inp(terminVon, setTerminVon, { type: "date"');
    expect(source).toContain('Field label="Umzug Termin Bis">{inp(terminBis, setTerminBis, { type: "date"');
  });
});
