import { describe, expect, it } from "vitest";
import {
  KUNDENNUMMER_LENGTH,
  formatCustomerNumber,
  normalizeCustomerSearch,
  parseCustomerNumber,
} from "../shared/customerNumber";

describe("customer number helpers", () => {
  it("formats customer ids as fixed-length sequential Kundennummer values", () => {
    expect(KUNDENNUMMER_LENGTH).toBe(5);
    expect(formatCustomerNumber(1)).toBe("00001");
    expect(formatCustomerNumber(12)).toBe("00012");
    expect(formatCustomerNumber(123)).toBe("00123");
    expect(formatCustomerNumber(12345)).toBe("12345");
  });

  it("rejects invalid ids when formatting or parsing customer numbers", () => {
    expect(formatCustomerNumber(0)).toBe("");
    expect(formatCustomerNumber(-7)).toBe("");
    expect(formatCustomerNumber(Number.NaN)).toBe("");
    expect(parseCustomerNumber(undefined)).toBeNull();
    expect(parseCustomerNumber("")).toBeNull();
    expect(parseCustomerNumber("KD-")).toBeNull();
  });

  it("parses and normalizes customer numbers for unified search", () => {
    expect(parseCustomerNumber("00001")).toBe(1);
    expect(parseCustomerNumber("Kundennummer 00042")).toBe(42);
    expect(parseCustomerNumber("KD-00105")).toBe(105);
    expect(normalizeCustomerSearch("  00042 ")).toBe("00042");
    expect(normalizeCustomerSearch(" KuNdEnNuMmEr ")).toBe("kundennummer");
  });
});
