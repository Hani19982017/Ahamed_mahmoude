import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";
import { DATE_INPUT_LOCALE, getDateInputProps, isGermanDateInput } from "@/lib/uiFormatting";

describe("date input locale regression", () => {
  it("keeps German locale metadata for date-like inputs", () => {
    expect(isGermanDateInput("date")).toBe(true);
    expect(isGermanDateInput("datetime-local")).toBe(true);
    expect(getDateInputProps("date")).toEqual({ lang: DATE_INPUT_LOCALE, dir: "ltr" });
  });

  it("renders date fields as German text inputs with a custom picker trigger", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Input, {
        type: "date",
        value: "2026-04-15",
        name: "pickupDate",
        readOnly: false,
      }),
    );

    expect(markup).toContain('type="text"');
    expect(markup).toContain('value="15.04.2026"');
    expect(markup).toContain('lang="de-DE"');
    expect(markup).toContain('dir="ltr"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('type="hidden"');
    expect(markup).toContain('name="pickupDate"');
    expect(markup).not.toContain('type="date"');
  });

  it("keeps non-date inputs unchanged so typing stays functional", () => {
    const textMarkup = renderToStaticMarkup(
      React.createElement(Input, {
        type: "text",
        value: "12345",
        name: "customerPhone",
        readOnly: false,
      }),
    );

    const numberMarkup = renderToStaticMarkup(
      React.createElement(Input, {
        type: "number",
        value: "42",
        name: "workers",
        readOnly: false,
      }),
    );

    expect(textMarkup).toContain('type="text"');
    expect(textMarkup).toContain('value="12345"');
    expect(textMarkup).toContain('name="customerPhone"');
    expect(textMarkup).not.toContain('15.04.2026');
    expect(numberMarkup).toContain('type="number"');
    expect(numberMarkup).toContain('value="42"');
    expect(numberMarkup).toContain('name="workers"');
  });
});
