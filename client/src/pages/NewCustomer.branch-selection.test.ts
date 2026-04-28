import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("./NewCustomer.tsx", import.meta.url), "utf8");

describe("NewCustomer branch selection regression safeguards", () => {
  it("tracks the selected branch by id instead of relying on the branch name only", () => {
    expect(pageSource).toContain("const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);");
    expect(pageSource).toContain("const branchId = selectedBranchId ?? user?.branchId ?? null;");
    expect(pageSource).toContain("value={selectedBranchId ?? \"\"}");
  });

  it("updates both the branch id and display name when the branch selection changes", () => {
    expect(pageSource).toContain("const nextBranchId = Number(e.target.value);");
    expect(pageSource).toContain("setSelectedBranchId(Number.isNaN(nextBranchId) ? null : nextBranchId);");
    expect(pageSource).toContain("setSitz(nextBranch?.name ?? \"\");");
  });

  it("guards against duplicate submissions while the create mutation is pending", () => {
    expect(pageSource).toContain("if (createCustomer.isPending) return;");
  });

  it("keeps the Umzug Angebot button visible and blocks generation before the first save inside the handler", () => {
    expect(pageSource).toContain("const canGenerateOffer = !!savedCustomerId && !!savedMoveId;");
    expect(pageSource).not.toContain("{canGenerateOffer ? (");
    expect(pageSource).toContain("if (!canGenerateOffer) {");
    expect(pageSource).toContain("Bitte speichern Sie den Kunden zuerst, bevor Sie das Umzug Angebot erstellen.");
  });

  it("prevents re-submitting the same customer after the first save", () => {
    expect(pageSource).toContain("if (savedCustomerId) {");
    expect(pageSource).toContain("Der Kunde wurde bereits gespeichert. Sie können jetzt das Umzug Angebot herunterladen.");
  });
});
