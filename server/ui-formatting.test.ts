import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Input } from "../client/src/components/ui/input";
import { DATE_INPUT_LOCALE, PAID_TONE, getDateInputProps, isGermanDateInput } from "../client/src/lib/uiFormatting";

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

  it("keeps German handling scoped to date inputs without breaking other input types", () => {
    const emptyDateMarkup = renderToStaticMarkup(React.createElement(Input, { type: "date", value: "", readOnly: true }));
    const dateMarkup = renderToStaticMarkup(React.createElement(Input, { type: "date", value: "2026-04-15", readOnly: true }));
    const dateTimeMarkup = renderToStaticMarkup(React.createElement(Input, { type: "datetime-local", value: "2026-04-15T10:30", readOnly: true }));
    const textMarkup = renderToStaticMarkup(React.createElement(Input, { type: "text", value: "plain", readOnly: true }));

    expect(emptyDateMarkup).toContain('type="text"');
    expect(emptyDateMarkup).toContain('placeholder="TT.MM.JJJJ"');
    expect(dateMarkup).toContain('value="15.04.2026"');
    expect(dateMarkup).toContain('lang="de-DE"');
    expect(dateMarkup).toContain('dir="ltr"');
    expect(dateTimeMarkup).toContain('type="datetime-local"');
    expect(dateTimeMarkup).toContain('value="2026-04-15T10:30"');
    expect(dateTimeMarkup).toContain('lang="de-DE"');
    expect(dateTimeMarkup).toContain('dir="ltr"');
    expect(textMarkup).not.toContain('lang="de-DE"');
  });
});
