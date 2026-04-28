import { describe, expect, it, vi } from "vitest";
import { emptyBranchForm, invalidateBranchesList, normalizeBranchForm } from "./branchSync";

describe("branch sync helpers", () => {
  it("normalizes branch form values and removes empty optional fields", () => {
    const payload = normalizeBranchForm({
      ...emptyBranchForm,
      name: "  Move Frankfurt  ",
      city: "  Frankfurt ",
      address: "   ",
      phone: " +49 69 000000 ",
    });

    expect(payload).toEqual({
      name: "Move Frankfurt",
      city: "Frankfurt",
      address: undefined,
      phone: "+49 69 000000",
    });
  });

  it("invalidates the shared branches list cache after mutations", async () => {
    const invalidate = vi.fn().mockResolvedValue(undefined);

    await invalidateBranchesList({
      branches: {
        list: {
          invalidate,
        },
      },
    });

    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
