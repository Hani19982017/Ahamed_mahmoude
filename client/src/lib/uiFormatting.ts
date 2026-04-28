export const PAID_TONE = {
  badge: "bg-green-100 text-green-700 border-green-200",
  softBadge: "bg-green-100 text-green-700",
  surface: "border-green-400 bg-green-50 shadow-green-100 shadow-md",
  surfaceSubtle: "bg-green-50/60",
  row: "border-green-200 bg-green-50 hover:bg-green-100/60",
  cardAccent: "border-l-green-500 text-green-700",
  icon: "text-green-600",
  pulse: "bg-green-400",
  strongText: "text-green-700",
} as const;

export const DATE_INPUT_LOCALE = "de-DE";

export function isGermanDateInput(type?: string | null) {
  return type === "date" || type === "datetime-local";
}

export function getDateInputProps(type?: string | null) {
  if (!isGermanDateInput(type)) {
    return {};
  }

  return {
    lang: DATE_INPUT_LOCALE,
    dir: "ltr" as const,
  };
}
