import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";
import { DATE_INPUT_LOCALE, PAID_TONE, getDateInputProps, isGermanDateInput } from "@/lib/uiFormatting";

describe("ui formatting", () => {
  it("returns German locale props for date-like inputs", () => {
    expect(isGermanDateInput("date")).toBe(true);
    expect(isGermanDateInput("datetime-local")).toBe(true);
    expect(isGermanDateInput("text")).toBe(false);
    expect(getDateInputProps("date")).toEqual({ lang: DATE_INPUT_LOCALE, dir: "ltr" });
    expect(getDateInputProps("datetime-local")).toEqual({ lang: DATE_INPUT_LOCALE, dir: "ltr" });
    expect(getDateInputProps("text")).toEqual({});
  });

  it("keeps paid states mapped to green shared classes", () => {
    expect(PAID_TONE.badge).toContain("bg-green-100");
    expect(PAID_TONE.badge).toContain("text-green-700");
    expect(PAID_TONE.surface).toContain("border-green-400");
    expect(PAID_TONE.icon).toContain("text-green-600");
  });

  it("renders date inputs with a German custom picker trigger instead of the native browser date field", () => {
    const dateMarkup = renderToStaticMarkup(
      createElement(Input, { type: "date", value: "2026-04-15", name: "pickupDate", readOnly: false }),
    );

    expect(dateMarkup).toContain('type="text"');
    expect(dateMarkup).toContain('value="15.04.2026"');
    expect(dateMarkup).toContain('lang="de-DE"');
    expect(dateMarkup).toContain('dir="ltr"');
    expect(dateMarkup).toContain('aria-haspopup="dialog"');
    expect(dateMarkup).toContain('type="hidden"');
    expect(dateMarkup).toContain('name="pickupDate"');
    expect(dateMarkup).not.toContain('type="date"');
  });

  it("keeps datetime-local inputs on direct input markup with German locale attributes", () => {
    const dateTimeMarkup = renderToStaticMarkup(
      createElement(Input, { type: "datetime-local", value: "2026-04-15T10:30", readOnly: true }),
    );
    const textMarkup = renderToStaticMarkup(createElement(Input, { type: "text", value: "plain", readOnly: true }));

    expect(dateTimeMarkup).toContain('lang="de-DE"');
    expect(dateTimeMarkup).toContain('dir="ltr"');
    expect(dateTimeMarkup).toContain('value="2026-04-15T10:30"');
    expect(textMarkup).not.toContain('lang="de-DE"');
  });
});
