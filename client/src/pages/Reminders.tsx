/**
 * Customer reminders page (v2 — manual-date model).
 *
 * Shows ONLY customers whose reminderDate is today or in the past.
 * Customers without a scheduled reminder are hidden — section appears
 * empty when there's no follow-up to do.
 *
 * Click a customer → dialog opens with:
 *   - Date picker for the next reminder
 *   - Versuch dropdown (1-6)
 *   - Save button (updates reminderDate + versuch)
 *   - "Erinnerung entfernen" button (clears reminderDate, keeps the record)
 *   - Cancel button
 *
 * All visible items render with a single green dot (no yellow).
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Bell, AlertCircle, RefreshCw, Save, Trash2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

const formatGermanDate = (d: Date | string | null | undefined): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const toInputDate = (d: Date | string | null | undefined): string => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const VERSUCH_OPTIONS = ["Versuch 1", "Versuch 2", "Versuch 3", "Versuch 4", "Versuch 5", "Versuch 6"];

type ReminderRow = {
  id: number;
  customerId: number;
  branchId: number;
  customerName: string;
  kundennummer: string;
  versuch: string | null;
  reminderDate: string | null;
  lastUpdatedAt: string;
  hoursSinceUpdate: number;
};

export default function Reminders() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<ReminderRow | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editVersuch, setEditVersuch] = useState<string>("Versuch 1");

  const isAllowed = user?.role === "admin" || user?.role === "sales";

  const remindersQuery = trpc.reminders.list.useQuery(undefined, {
    enabled: isAllowed,
    refetchInterval: 60_000,
  });

  const utils = trpc.useUtils();

  const updateReminder = trpc.reminders.update.useMutation({
    onSuccess: () => {
      toast.success("✓ تم حفظ التذكير");
      utils.reminders.list.invalidate();
      setEditing(null);
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  const clearReminder = trpc.reminders.clear.useMutation({
    onSuccess: () => {
      toast.success("✓ تم إلغاء التذكير");
      utils.reminders.list.invalidate();
      setEditing(null);
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  if (!isAllowed) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
          <h2 className="text-lg font-bold mb-1">ليس لديك صلاحية</h2>
          <p className="text-sm text-gray-600">
            هذا القسم متاح فقط لمدير النظام وفريق المبيعات.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const reminders = (remindersQuery.data ?? []) as ReminderRow[];

  const openEditDialog = (r: ReminderRow) => {
    setEditing(r);
    setEditDate(toInputDate(r.reminderDate));
    setEditVersuch(r.versuch || "Versuch 1");
  };

  const handleSave = () => {
    if (!editing) return;
    updateReminder.mutate({
      id: editing.id,
      reminderDate: editDate || null,
      versuch: editVersuch,
    });
  };

  const handleClear = () => {
    if (!editing) return;
    if (!confirm("هل أنت متأكد من إلغاء التذكير؟ سيختفي العميل من القائمة.")) {
      return;
    }
    clearReminder.mutate({ id: editing.id });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-6 w-6 text-emerald-600" />
              تذكير المراسلة والحالة
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              العملاء الذين يحتاجون متابعة اليوم
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => remindersQuery.refetch()}
            className="flex items-center gap-1"
          >
            <RefreshCw size={14} /> تحديث
          </Button>
        </div>

        {/* Loading */}
        {remindersQuery.isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              جاري التحميل...
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!remindersQuery.isLoading && reminders.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500">لا توجد تذكيرات اليوم</p>
              <p className="text-xs text-gray-400 mt-1">
                التذكيرات تظهر هنا تلقائياً عندما يحين موعدها
              </p>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {reminders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>قائمة التذكيرات المستحقة</span>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  {reminders.length} تذكير
                </Badge>
              </CardTitle>
              <CardDescription>اضغط على أي عميل لتعديل التذكير</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {reminders.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openEditDialog(r)}
                    className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-right"
                  >
                    {/* Always green — every visible item is "due" */}
                    <span
                      className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-200 shrink-0"
                      aria-label="تذكير مستحق"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="font-semibold text-gray-900">{r.customerName}</span>
                        <span className="text-xs text-gray-500 font-mono">{r.kundennummer}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {r.versuch && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            {r.versuch}
                          </Badge>
                        )}
                        <span>التذكير: {formatGermanDate(r.reminderDate)}</span>
                      </div>
                    </div>

                    <ChevronLeft className="h-4 w-4 text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إدارة التذكير</DialogTitle>
            <DialogDescription>
              {editing && (
                <>
                  <span className="block">{editing.customerName}</span>
                  <span className="block text-xs font-mono text-gray-500 mt-1">
                    {editing.kundennummer}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reminderDate">موعد التذكير القادم</Label>
              <Input
                id="reminderDate"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                اترك الحقل فارغاً واحفظ لإلغاء التذكير
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="versuch">رقم المحاولة (1 - 6)</Label>
              <select
                id="versuch"
                value={editVersuch}
                onChange={(e) => setEditVersuch(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {VERSUCH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {editVersuch === "Versuch 6" && (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> هذه هي المحاولة الأخيرة
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 flex-row-reverse">
            <Button
              onClick={handleSave}
              disabled={updateReminder.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="h-4 w-4 ml-1" />
              {updateReminder.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={clearReminder.isPending}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 ml-1" />
              إلغاء التذكير
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
