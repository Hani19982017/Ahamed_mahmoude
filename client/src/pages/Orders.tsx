import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Package, ArrowLeft, RefreshCw, Plus,
  MapPin, Calendar, Euro, Truck, Eye, Edit2, Trash2, Image, Building2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import MoveDetailDialog from "@/components/MoveDetailDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCustomerNumber } from "@shared/customerNumber";

// ── شارات الحالة ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed:   { label: "مؤكد",         cls: "bg-[#eaf2f7] text-[#1a4d6d] border-[#1a4d6d]/20" },
    pending:     { label: "قيد الانتظار", cls: "bg-[#fff2e8] text-[#bd682b] border-[#d97e3a]/20" },
    in_progress: { label: "قيد التنفيذ",  cls: "bg-[#eaf2f7] text-[#1a4d6d] border-[#1a4d6d]/20" },
    completed:   { label: "مكتمل",        cls: "bg-gray-100 text-gray-700 border-gray-200" },
    cancelled:   { label: "ملغى",         cls: "bg-red-100 text-red-800 border-red-200" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function PayBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid:    { label: "مدفوع",      cls: "bg-green-100 text-green-700 border-green-200" },
    unpaid:  { label: "غير مدفوع", cls: "bg-red-100 text-red-800 border-red-200" },
    partial: { label: "جزئي",       cls: "bg-[#fff2e8] text-[#bd682b] border-[#d97e3a]/20" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── بطاقة إحصاء ───────────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: string | number; sub: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon size={20} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── نموذج التعديل ─────────────────────────────────────────────────────────────
function EditMoveDialog({
  move,
  open,
  onClose,
  onSaved,
}: {
  move: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pickupAddress, setPickupAddress]   = useState(move?.pickupAddress ?? "");
  const [pickupFloor, setPickupFloor]       = useState(move?.pickupFloor ?? "");
  const [pickupElev, setPickupElev]         = useState(move?.pickupElevatorCapacity ?? "");
  const [pickupPark, setPickupPark]         = useState(move?.pickupParkingDistance ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(move?.deliveryAddress ?? "");
  const [deliveryFloor, setDeliveryFloor]   = useState(move?.deliveryFloor ?? "");
  const [deliveryElev, setDeliveryElev]     = useState(move?.deliveryElevatorCapacity ?? "");
  const [deliveryPark, setDeliveryPark]     = useState(move?.deliveryParkingDistance ?? "");
  const [pickupDate, setPickupDate]         = useState(
    move?.pickupDate ? new Date(move.pickupDate).toISOString().slice(0, 16) : ""
  );
  const [deliveryDate, setDeliveryDate]     = useState(
    move?.deliveryDate ? new Date(move.deliveryDate).toISOString().slice(0, 16) : ""
  );
  const [grossPrice, setGrossPrice]         = useState(
    move?.grossPrice ? String(Number(move.grossPrice)) : ""
  );
  const [volume, setVolume]                 = useState(move?.volume ? String(move.volume) : "");
  const [distance, setDistance]             = useState(move?.distance ? String(move.distance) : "");
  const [numTrips, setNumTrips]             = useState(move?.numTrips ? String(move.numTrips) : "");
  const [status, setStatus]                 = useState(move?.status ?? "pending");
  const [paymentStatus, setPaymentStatus]   = useState(move?.paymentStatus ?? "unpaid");

  const utils = trpc.useUtils();
  const updateMove = trpc.moves.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الطلب بنجاح");
      utils.moves.list.invalidate();
      onSaved();
      onClose();
    },
    onError: (err) => {
      toast.error("فشل التحديث: " + err.message);
    },
  });

  const handleSave = () => {
    updateMove.mutate({
      moveId: move.id,
      pickupAddress,
      pickupFloor,
      pickupElevatorCapacity: pickupElev,
      pickupParkingDistance: pickupPark,
      deliveryAddress,
      deliveryFloor,
      deliveryElevatorCapacity: deliveryElev,
      deliveryParkingDistance: deliveryPark,
      pickupDate: pickupDate ? new Date(pickupDate).toISOString() : undefined,
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
      grossPrice: grossPrice ? parseFloat(grossPrice) : undefined,
      volume: volume ? parseInt(volume) : undefined,
      distance: distance ? parseInt(distance) : undefined,
      numTrips: numTrips ? parseInt(numTrips) : undefined,
      status: status as any,
      paymentStatus: paymentStatus as any,
    });
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            تعديل الطلب — <span className="text-[#1a4d6d]">{formatCustomerNumber(move?.customerId) || move?.moveCode}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* الحالة والدفع */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="حالة الطلب">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pending">قيد الانتظار</option>
                <option value="confirmed">مؤكد</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغى</option>
              </select>
            </Field>
            <Field label="حالة الدفع">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="unpaid">غير مدفوع</option>
                <option value="partial">مدفوع جزئياً</option>
                <option value="paid">مدفوع بالكامل</option>
              </select>
            </Field>
          </div>

          {/* التواريخ والسعر */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="تاريخ الاستلام">
              <Input
                type="datetime-local"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="text-sm"
              />
            </Field>
            <Field label="تاريخ التسليم">
              <Input
                type="datetime-local"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="السعر الإجمالي (€)">
              <Input
                type="number"
                value={grossPrice}
                onChange={(e) => setGrossPrice(e.target.value)}
                placeholder="0.00"
                className="text-sm"
              />
            </Field>
            <Field label="الحجم (m³)">
              <Input
                type="number"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </Field>
            <Field label="المسافة (km)">
              <Input
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </Field>
          </div>

          {/* عنوان الاستلام */}
          <div className="rounded-lg border bg-[#f4f8fb] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1a4d6d]">
              <MapPin size={14} /> عنوان الاستلام (Auszug)
            </p>
            <div className="space-y-3">
              <Field label="العنوان الكامل">
                <Input
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Straße, Hausnummer, PLZ, Stadt"
                  className="text-sm"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="الطابق">
                  <Input
                    value={pickupFloor}
                    onChange={(e) => setPickupFloor(e.target.value)}
                    placeholder="z.B. 2.Etage"
                    className="text-sm"
                  />
                </Field>
                <Field label="المصعد">
                  <Input
                    value={pickupElev}
                    onChange={(e) => setPickupElev(e.target.value)}
                    placeholder="Aufzug"
                    className="text-sm"
                  />
                </Field>
                <Field label="المسافة للشاحنة">
                  <Input
                    value={pickupPark}
                    onChange={(e) => setPickupPark(e.target.value)}
                    placeholder="z.B. 20-30m"
                    className="text-sm"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* عنوان التسليم */}
          <div className="rounded-lg border bg-[#fff7f1] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#bd682b]">
              <MapPin size={14} /> عنوان التسليم (Einzug)
            </p>
            <div className="space-y-3">
              <Field label="العنوان الكامل">
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Straße, Hausnummer, PLZ, Stadt"
                  className="text-sm"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="الطابق">
                  <Input
                    value={deliveryFloor}
                    onChange={(e) => setDeliveryFloor(e.target.value)}
                    placeholder="z.B. 3.Etage"
                    className="text-sm"
                  />
                </Field>
                <Field label="المصعد">
                  <Input
                    value={deliveryElev}
                    onChange={(e) => setDeliveryElev(e.target.value)}
                    placeholder="Aufzug"
                    className="text-sm"
                  />
                </Field>
                <Field label="المسافة للشاحنة">
                  <Input
                    value={deliveryPark}
                    onChange={(e) => setDeliveryPark(e.target.value)}
                    placeholder="z.B. 10-20m"
                    className="text-sm"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* عدد الرحلات */}
          <Field label="عدد الرحلات">
            <Input
              type="number"
              value={numTrips}
              onChange={(e) => setNumTrips(e.target.value)}
              placeholder="0"
              className="text-sm w-32"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={updateMove.isPending}>
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMove.isPending}
            className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
          >
            {updateMove.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── الصفحة الرئيسية ───────────────────────────────────────────────────────────
export default function Orders() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  // branch_manager is read-only — they can view everything in their branch
  // but cannot edit, delete, or create moves.
  const isReadOnly = user?.role === "branch_manager";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editMove, setEditMove] = useState<any>(null);
  const [viewMoveId, setViewMoveId] = useState<number | null>(null);
  const [editMoveId, setEditMoveId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const deleteMove = trpc.moves.delete.useMutation({
    onSuccess: () => {
      toast.success("✅ تم حذف الطلب بنجاح");
      utils.moves.list.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error("❌ فشل الحذف: " + e.message),
  });

  // جلب الفروع (للمدير فقط)
  const branchesQuery = trpc.branches.list.useQuery(undefined, {
    enabled: !!user && user.role === 'admin',
  });
  const branches = branchesQuery.data ?? [];

  // جلب البيانات
  const movesQuery = trpc.moves?.list?.useQuery
    ? trpc.moves.list.useQuery(
        user?.role === 'admin' ? { branchId: selectedBranchId } : undefined,
        { enabled: !!user }
      )
    : { data: undefined, isLoading: false, refetch: () => {} };

  const moves = (movesQuery as any).data ?? [];

  // تصفية
  const filtered = moves.filter((m: any) => {
    const q = searchTerm.toLowerCase();
    const kundenummer = formatCustomerNumber(m.customerId)?.toLowerCase();
    const matchSearch =
      kundenummer?.includes(q) ||
      m.pickupAddress?.toLowerCase().includes(q) ||
      m.deliveryAddress?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // إحصاءات
  const total = moves.length;
  const active = moves.filter((m: any) =>
    ["pending", "confirmed", "in_progress"].includes(m.status)
  ).length;
  const completed = moves.filter((m: any) => m.status === "completed").length;
  const unpaid = moves.filter((m: any) => m.paymentStatus === "unpaid").length;
  const handleRefreshAll = () => {
    (movesQuery as any).refetch?.();
    toast.success("تم تحديث البيانات");
  };

  const statusOptions = [   { value: "all",         label: "جميع الحالات" },
    { value: "pending",     label: "قيد الانتظار" },
    { value: "confirmed",   label: "مؤكد" },
    { value: "in_progress", label: "قيد التنفيذ" },
    { value: "completed",   label: "مكتمل" },
    { value: "cancelled",   label: "ملغى" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* شريط العنوان */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} /> الرئيسية
          </button>
          <h1 className="text-lg font-bold text-gray-900">إدارة الطلبات</h1>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && branches.length > 0 && (
            <Select
              value={selectedBranchId === null ? 'all' : String(selectedBranchId)}
              onValueChange={(v) => setSelectedBranchId(v === 'all' ? null : Number(v))}
            >
              <SelectTrigger className="w-44 h-8 text-sm">
                <Building2 size={14} className="mr-1 text-gray-400" />
                <SelectValue placeholder="كل الفروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفروع</SelectItem>
                {branches.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="flex items-center gap-1"
          >
            <RefreshCw size={14} /> تحديث
          </Button>
          {!isReadOnly && (
            <Button
              size="sm"
              onClick={() => navigate("/new-customer")}
              className="flex items-center gap-1 bg-[#1a4d6d] text-white hover:bg-[#14394f]"
            >
              <Plus size={14} /> طلب جديد
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* إحصاءات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="إجمالي الطلبات" value={total}     sub="جميع الطلبات"     icon={Package}  color="bg-[#1a4d6d]" />
          <StatCard title="الطلبات النشطة" value={active}    sub="قيد التنفيذ"      icon={Truck}    color="bg-orange-500" />
          <StatCard title="مكتملة"          value={completed} sub="تم تسليمها"       icon={Package}  color="bg-[#d97e3a]" />
          <StatCard title="غير مدفوعة"      value={unpaid}    sub="تحتاج متابعة"     icon={Euro}     color="bg-red-500" />
        </div>

        {/* شريط البحث والتصفية */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="بحث بـ Kundennummer أو العنوان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === opt.value
                    ? "border-[#1a4d6d] bg-[#1a4d6d] text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-[#1a4d6d] hover:text-[#1a4d6d]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* قائمة الطلبات */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">قائمة الطلبات</CardTitle>
                <CardDescription>
                  {filtered.length} طلب{filtered.length !== total ? ` من ${total}` : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(movesQuery as any).isLoading ? (
              <div className="text-center py-16 text-gray-400">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-[#1a4d6d]" />
                جاري التحميل...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Package size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 mb-4">
                  {searchTerm || statusFilter !== "all"
                    ? "لا توجد نتائج تطابق البحث"
                    : "لا توجد طلبات بعد"}
                </p>
                {!searchTerm && statusFilter === "all" && !isReadOnly && (
                  <Button
                    onClick={() => navigate("/new-customer")}
                    className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
                  >
                    <Plus size={14} className="mr-1" /> أضف أول طلب
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* جدول للشاشات الكبيرة */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Kundennummer</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><MapPin size={13} /> من</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><MapPin size={13} /> إلى</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><Calendar size={13} /> التاريخ</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">الحالة</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">الدفع</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><Euro size={13} /> السعر</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">
                          <span className="flex items-center gap-1"><Image size={13} /> صور</span>
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((move: any) => (
                        <tr key={move.id} className={`border-b transition-colors ${move.istBezahlt ? 'border-green-200 bg-green-50 hover:bg-green-100/60' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-3 font-semibold text-[#1a4d6d]">{formatCustomerNumber(move.customerId) || move.moveCode || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                            <span className="block truncate" title={move.pickupAddress}>
                              {move.pickupAddress || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                            <span className="block truncate" title={move.deliveryAddress}>
                              {move.deliveryAddress || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {move.pickupDate
                              ? new Date(move.pickupDate).toLocaleDateString("de-DE")
                              : "—"}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={move.status} /></td>
                          <td className="px-4 py-3"><PayBadge status={move.paymentStatus} /></td>
                          <td className="px-4 py-3 font-semibold text-gray-800">
                            {move.grossPrice ? `${Number(move.grossPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {move.customerPhotoCount > 0 ? (
                              <span
                                title={`${move.customerPhotoCount} صورة مرفوعة`}
                                className="inline-flex items-center gap-1 rounded-full border border-[#1a4d6d]/20 bg-[#eaf2f7] px-2 py-0.5 text-xs font-semibold text-[#1a4d6d]"
                              >
                                <Image size={11} />{move.customerPhotoCount}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewMoveId(move.id)}
                                title="مشاهدة الطلب كاملاً"
                                className="hover:bg-gray-100"
                              >
                                <Eye size={13} />
                              </Button>
                              {!isReadOnly && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditMoveId(move.id)}
                                    title="تعديل الطلب كاملاً"
                                    className="hover:border-[#1a4d6d] hover:bg-[#1a4d6d]/10 hover:text-[#1a4d6d]"
                                  >
                                    <Edit2 size={13} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteConfirmId(move.id)}
                                    title="حذف الطلب"
                                    className="hover:bg-red-50 hover:border-red-400 hover:text-red-600"
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* بطاقات للموبايل */}
                <div className="md:hidden space-y-3">
                  {filtered.map((move: any) => (
                    <div key={move.id} className={`rounded-lg border p-4 ${move.istBezahlt ? 'border-green-200 bg-green-50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1a4d6d]">{formatCustomerNumber(move.customerId) || move.moveCode || "—"}</span>
                          {move.customerPhotoCount > 0 && (
                            <span
                              title={`${move.customerPhotoCount} صورة مرفوعة`}
                              className="inline-flex items-center gap-1 rounded-full border border-[#1a4d6d]/20 bg-[#eaf2f7] px-1.5 py-0.5 text-xs font-semibold text-[#1a4d6d]"
                            >
                              <Image size={10} />{move.customerPhotoCount}
                            </span>
                          )}
                        </div>
                        <StatusBadge status={move.status} />
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-start gap-2">
                          <MapPin size={13} className="mt-0.5 shrink-0 text-[#1a4d6d]" />
                          <span className="truncate">{move.pickupAddress || "—"}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin size={13} className="mt-0.5 shrink-0 text-[#d97e3a]" />
                          <span className="truncate">{move.deliveryAddress || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-gray-400" />
                            <span className="text-xs">
                              {move.pickupDate
                                ? new Date(move.pickupDate).toLocaleDateString("de-DE")
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <PayBadge status={move.paymentStatus} />
                            <span className="font-semibold text-gray-800">
                              {move.grossPrice ? `${Number(move.grossPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setViewMoveId(move.id)}
                        >
                          <Eye size={13} className="mr-1" /> مشاهدة
                        </Button>
                        {!isReadOnly && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 hover:border-[#1a4d6d] hover:bg-[#1a4d6d]/10 hover:text-[#1a4d6d]"
                              onClick={() => setEditMoveId(move.id)}
                            >
                              <Edit2 size={13} className="mr-1" /> تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-red-50 hover:border-red-400 hover:text-red-600"
                              onClick={() => setDeleteConfirmId(move.id)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* نافذة تعديل الطلب القديمة - محتفظ بها للتوافق */}
      {editMove && (
        <EditMoveDialog
          move={editMove}
          open={!!editMove}
          onClose={() => setEditMove(null)}
          onSaved={() => (movesQuery as any).refetch?.()}
        />
      )}

      {/* نافذة المشاهدة الكاملة */}
      {viewMoveId !== null && (
        <MoveDetailDialog
          moveId={viewMoveId}
          mode="view"
          onClose={() => setViewMoveId(null)}
        />
      )}

      {/* نافذة التعديل الكامل */}
      {editMoveId !== null && (
        <MoveDetailDialog
          moveId={editMoveId}
          mode="edit"
          onClose={() => setEditMoveId(null)}
          onSaved={() => { (movesQuery as any).refetch?.(); }}
        />
      )}

      {/* نافذة تأكيد الحذف */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 size={18} /> تأكيد حذف الطلب
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>إلغاء</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMove.isPending}
              onClick={() => deleteConfirmId && deleteMove.mutate({ moveId: deleteConfirmId })}
            >
              {deleteMove.isPending ? "جاري الحذف..." : "حذف الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
