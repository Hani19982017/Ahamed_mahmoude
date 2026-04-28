export type BranchFormValues = {
  name: string;
  city: string;
  address: string;
  phone: string;
};

export const emptyBranchForm: BranchFormValues = {
  name: "",
  city: "",
  address: "",
  phone: "",
};

export function normalizeBranchForm(values: BranchFormValues) {
  return {
    name: values.name.trim(),
    city: values.city.trim(),
    address: values.address.trim() || undefined,
    phone: values.phone.trim() || undefined,
  };
}

export async function invalidateBranchesList(utils: {
  branches: {
    list: {
      invalidate: () => Promise<unknown> | unknown;
    };
  };
}) {
  await utils.branches.list.invalidate();
}
