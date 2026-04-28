// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changeManagerPassword: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      changeManagerPassword: {
        useMutation: () => ({
          mutateAsync: mocks.changeManagerPassword,
          isPending: false,
        }),
      },
    },
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

import ManagerPasswordDialog from "./ManagerPasswordDialog";

describe("ManagerPasswordDialog", () => {
  beforeEach(() => {
    mocks.changeManagerPassword.mockReset();
  });

  it("prevents submission when the new passwords do not match", async () => {
    render(<ManagerPasswordDialog open={true} onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText("Aktuelles Passwort"), { target: { value: "old-pass" } });
    fireEvent.change(screen.getByLabelText("Neues Passwort"), { target: { value: "new-pass-1" } });
    fireEvent.change(screen.getByLabelText("Neues Passwort wiederholen"), { target: { value: "new-pass-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Passwort speichern" }));

    expect(screen.getByText("Die neuen Passwörter stimmen nicht überein.")).toBeTruthy();
    expect(mocks.changeManagerPassword).not.toHaveBeenCalled();
  });

  it("submits the manager password change mutation and shows success feedback", async () => {
    mocks.changeManagerPassword.mockResolvedValue({ success: true });

    render(<ManagerPasswordDialog open={true} onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText("Aktuelles Passwort"), { target: { value: "old-pass" } });
    fireEvent.change(screen.getByLabelText("Neues Passwort"), { target: { value: "new-pass-123" } });
    fireEvent.change(screen.getByLabelText("Neues Passwort wiederholen"), { target: { value: "new-pass-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Passwort speichern" }));

    await waitFor(() => {
      expect(mocks.changeManagerPassword).toHaveBeenCalledWith({
        currentPassword: "old-pass",
        newPassword: "new-pass-123",
      });
    });

    expect(screen.getByText("Das Manager-Passwort wurde erfolgreich aktualisiert.")).toBeTruthy();
  });
});
