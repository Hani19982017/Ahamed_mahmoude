export const KUNDENNUMMER_LENGTH = 5;
export const KUNDENNUMMER_PLACEHOLDER = "Wird automatisch vergeben";

export function formatCustomerNumber(customerId: number | null | undefined): string {
  if (!customerId || customerId < 1 || !Number.isFinite(customerId)) {
    return "";
  }

  return String(Math.trunc(customerId)).padStart(KUNDENNUMMER_LENGTH, "0");
}

export function parseCustomerNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeCustomerSearch(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
