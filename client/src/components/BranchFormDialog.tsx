import { useEffect, useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  emptyBranchForm,
  invalidateBranchesList,
  normalizeBranchForm,
  type BranchFormValues,
} from "@/lib/branchSync";

type BranchRecord = {
  id: number;
  name: string;
  city: string;
  address?: string | null;
  phone?: string | null;
};

type BranchFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: BranchRecord | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSuccess?: () => void;
};

export function BranchFormDialog({
  open,
  onOpenChange,
  branch,
  title,
  description,
  submitLabel,
  onSuccess,
}: BranchFormDialogProps) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<BranchFormValues>(emptyBranchForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setForm(
        branch
          ? {
              name: branch.name ?? "",
              city: branch.city ?? "",
              address: branch.address ?? "",
              phone: branch.phone ?? "",
            }
          : emptyBranchForm
      );
      return;
    }

    setForm(emptyBranchForm);
    setError("");
  }, [open, branch]);

  const createMutation = trpc.branches.create.useMutation({
    onSuccess: async () => {
      await invalidateBranchesList(utils);
      toast.success("تم حفظ الفرع بنجاح");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => setError(err.message || "فشل حفظ الفرع"),
  });

  const updateMutation = trpc.branches.update.useMutation({
    onSuccess: async () => {
      await invalidateBranchesList(utils);
      toast.success("تم تحديث بيانات الفرع بنجاح");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => setError(err.message || "فشل تحديث الفرع"),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    setError("");

    const payload = normalizeBranchForm(form);
    if (!payload.name || !payload.city) {
      setError("اسم الفرع والمدينة مطلوبان");
      return;
    }

    if (branch?.id) {
      updateMutation.mutate({ branchId: branch.id, ...payload });
      return;
    }

    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-[#1a4d6d]" />
            {title ?? (branch ? `تعديل: ${branch.name}` : "إضافة فرع جديد")}
          </DialogTitle>
          <DialogDescription>
            {description ??
              (branch
                ? "عدّل بيانات الفرع ثم احفظ التغييرات. تعطيل الفرع يبقي كل البيانات محفوظة."
                : "أدخل بيانات الفرع الجديد. سيتم مزامنة القائمة مباشرةً في إدارة الفروع وإدارة المستخدمين.")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="branch-name">اسم الفرع *</Label>
              <Input
                id="branch-name"
                placeholder="Move Frankfurt"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="branch-city">المدينة *</Label>
              <Input
                id="branch-city"
                placeholder="Frankfurt"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="branch-address">العنوان الكامل</Label>
            <Input
              id="branch-address"
              placeholder="Move Center, Berliner Straße 12, Frankfurt"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="branch-phone">رقم الهاتف</Label>
            <Input
              id="branch-phone"
              placeholder="+49 69 000000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              dir="ltr"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              className="flex-1 bg-[#1a4d6d] text-white hover:bg-[#14394f]"
              disabled={isSaving}
              onClick={handleSubmit}
            >
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> جاري الحفظ...
                </span>
              ) : (
                submitLabel ?? (branch ? "حفظ التغييرات" : "إضافة الفرع")
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
