// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestReset: vi.fn(),
  resetManagerPassword: vi.fn(),
  invalidateAuth: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      auth: {
        me: {
          invalidate: mocks.invalidateAuth,
        },
      },
    }),
    auth: {
      requestManagerPasswordReset: {
        useMutation: () => ({
          mutateAsync: mocks.requestReset,
        }),
      },
      resetManagerPassword: {
        useMutation: () => ({
          mutateAsync: mocks.resetManagerPassword,
        }),
      },
    },
  },
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<any>("wouter");
  return {
    ...actual,
    useLocation: () => ["/login", mocks.navigate],
  };
});

import LocalLogin from "./LocalLogin";

describe("LocalLogin manager reset flow", () => {
  beforeEach(() => {
    mocks.requestReset.mockReset();
    mocks.resetManagerPassword.mockReset();
    mocks.invalidateAuth.mockReset();
    mocks.navigate.mockReset();
    window.history.replaceState({}, "", "/login");
  });

  it("requests a manager reset link using the fixed email and current origin", async () => {
    mocks.requestReset.mockResolvedValue({ success: true, delivered: true });

    render(<LocalLogin />);
    fireEvent.click(screen.getByRole("button", { name: "Passwort vergessen? Reset-Link anfordern" }));

    await waitFor(() => {
      expect(mocks.requestReset).toHaveBeenCalledWith({
        email: "info.fr@move-profis.de",
        origin: window.location.origin,
      });
    });

    expect(screen.getByText("Ein Reset-Link wurde an den Systeminhaber gesendet.")).toBeTruthy();
  });

  it("consumes the reset token from the URL and submits the new password", async () => {
    mocks.resetManagerPassword.mockResolvedValue({ success: true });
    window.history.replaceState({}, "", "/login?adminResetToken=test-reset-token");

    render(<LocalLogin />);

    fireEvent.change(screen.getByLabelText("Neues Passwort"), { target: { value: "Move2027#@" } });
    fireEvent.change(screen.getByLabelText("Neues Passwort wiederholen"), { target: { value: "Move2027#@" } });
    fireEvent.click(screen.getByRole("button", { name: "Neues Manager-Passwort speichern" }));

    await waitFor(() => {
      expect(mocks.resetManagerPassword).toHaveBeenCalledWith({
        token: "test-reset-token",
        newPassword: "Move2027#@",
      });
    });

    expect(screen.getByText("Das Manager-Passwort wurde erfolgreich neu gesetzt. Sie können sich jetzt anmelden.")).toBeTruthy();
  });
});
