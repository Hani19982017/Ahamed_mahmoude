import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Edit2, Eye, Users, Package, TrendingUp,
  AlertTriangle, BarChart2, ArrowLeft, RefreshCw, UserCog, Trash2,
  CheckCircle2, AlertOctagon, MessageSquareWarning, FileText,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { formatCustomerNumber } from "@shared/customerNumber";

// ── Status helpers ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed:   { label: "مؤكد",          cls: "bg-[#eaf2f7] text-[#1a4d6d]" },
    pending:     { label: "قيد الانتظار",  cls: "bg-[#fff2e8] text-[#bd682b]" },
    in_progress: { label: "قيد التنفيذ",   cls: "bg-[#eaf2f7] text-[#1a4d6d]" },
    completed:   { label: "مكتمل",         cls: "bg-gray-100 text-gray-800" },
    cancelled:   { label: "ملغى",          cls: "bg-red-100 text-red-800" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function PayBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid:    { label: "مدفوع",       cls: "bg-green-100 text-green-700" },
    unpaid:  { label: "غير مدفوع",   cls: "bg-red-100 text-red-800" },
    partial: { label: "جزئي",        cls: "bg-[#fff2e8] text-[#bd682b]" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
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

// ── Customer View Dialog ─────────────────────────────────────────────────────
function CustomerViewDialog({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const { data: customer, isLoading } = trpc.customers.getById.useQuery({ id: customerId });
  const generateOffer = trpc.customers.generateOfferPdf.useMutation();

  const handleGenerateOffer = async (moveId: number) => {
    try {
      const result = await generateOffer.mutateAsync({ customerId, moveId });
      const binary = atob(result.base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Umzug Angebot für ${result.kundenummer} wurde heruntergeladen.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Erstellen des Umzug Angebots");
    }
  };

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار", confirmed: "مؤكد", in_progress: "قيد التنفيذ",
    completed: "مكتمل", cancelled: "ملغى",
  };
  const payLabels: Record<string, string> = {
    unpaid: "غير مدفوع", partial: "جزئي", paid: "مدفوع بالكامل",
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            بيانات العميل
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-gray-400">جاري تحميل بيانات العميل...</div>
        ) : !customer ? (
          <div className="py-10 text-center text-red-400">لم يتم العثور على بيانات العميل</div>
        ) : (
          <div className="space-y-5">
            {/* بيانات العميل الأساسية */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm border-b pb-2">بيانات العميل</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">الاسم الكامل:</span> <span className="font-medium">{customer.title} {customer.firstName} {customer.lastName}</span></div>
                <div><span className="text-gray-500">البريد:</span> <span className="font-medium">{customer.email || "—"}</span></div>
                <div><span className="text-gray-500">الهاتف:</span> <span className="font-medium">{customer.phone || "—"}</span></div>
                <div><span className="text-gray-500">الشركة:</span> <span className="font-medium">{customer.company || "—"}</span></div>

                <div><span className="text-gray-500">Kundennummer:</span> <span className="font-medium">{customer.kundenummer || formatCustomerNumber(customer.id) || "—"}</span></div>
                <div><span className="text-gray-500">تاريخ التسجيل:</span> <span className="font-medium">{new Date(customer.createdAt).toLocaleDateString("de-DE")}</span></div>
                {customer.notes && (
                  <div className="col-span-2"><span className="text-gray-500">ملاحظات:</span> <span className="font-medium">{customer.notes}</span></div>
                )}
              </div>
            </div>

            {/* الطلبات */}
            {(customer as any).moves?.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">طلبات النقل ({(customer as any).moves.length})</h3>
                {(customer as any).moves.map((move: any) => {
                  let services: any[] = [];
                  try { services = move.services ? JSON.parse(move.services) : []; } catch {}
                  return (
                    <div key={move.id} className="border rounded-lg p-4 mb-3 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-[#1a4d6d]">{move.kundenummer || formatCustomerNumber(move.customerId) || move.moveCode}</span>
                        <div className="flex gap-2">
                          <StatusBadge status={move.status} />
                          <PayBadge status={move.paymentStatus} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <p className="text-gray-500 text-xs mb-1">عنوان الاستلام (Auszug)</p>
                          <p className="font-medium">{move.pickupAddress}</p>
                          {move.pickupFloor && <p className="text-gray-400 text-xs">طابق: {move.pickupFloor}</p>}
                          {move.pickupElevatorCapacity && <p className="text-gray-400 text-xs">مصعد: {move.pickupElevatorCapacity}</p>}
                          {move.pickupParkingDistance && <p className="text-gray-400 text-xs">مسافة: {move.pickupParkingDistance}</p>}
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs mb-1">عنوان التسليم (Einzug)</p>
                          <p className="font-medium">{move.deliveryAddress}</p>
                          {move.deliveryFloor && <p className="text-gray-400 text-xs">طابق: {move.deliveryFloor}</p>}
                          {move.deliveryElevatorCapacity && <p className="text-gray-400 text-xs">مصعد: {move.deliveryElevatorCapacity}</p>}
                          {move.deliveryParkingDistance && <p className="text-gray-400 text-xs">مسافة: {move.deliveryParkingDistance}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                        <div><span className="text-gray-500">تاريخ الاستلام:</span> <span className="font-medium">{new Date(move.pickupDate).toLocaleDateString("de-DE")}</span></div>
                        <div><span className="text-gray-500">الحجم:</span> <span className="font-medium">{move.volume ? `${move.volume} m³` : "—"}</span></div>
                        <div><span className="text-gray-500">السعر:</span> <span className="font-medium">{move.grossPrice ? `${Number(move.grossPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}</span></div>
                        <div><span className="text-gray-500">المسافة:</span> <span className="font-medium">{move.distance ? `${move.distance} km` : "—"}</span></div>
                        <div><span className="text-gray-500">عدد الرحلات:</span> <span className="font-medium">{move.numTrips ?? 0}</span></div>
                        <div><span className="text-gray-500">نوع النقل:</span> <span className="font-medium">{move.moveType || "—"}</span></div>
                      </div>
                      <div className="mb-3 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateOffer(move.id)}
                          disabled={generateOffer.isPending}
                          className="border-amber-500 text-amber-700 hover:bg-amber-50"
                        >
                          <FileText size={14} className="mr-1" />
                          {generateOffer.isPending ? "PDF wird erstellt..." : "Umzug Angebot"}
                        </Button>
                      </div>

                      {/* الخدمات */}
                      {services.length > 0 && (
                        <div className="mb-3">
                          <p className="text-gray-500 text-xs mb-1">الخدمات الإضافية:</p>
                          <div className="flex flex-wrap gap-1">
                            {services.map((s: any, i: number) => (
                              <span key={i} className="rounded bg-[#eaf2f7] px-2 py-0.5 text-xs text-[#1a4d6d]">
                                {typeof s === "string" ? s : `${s.name || s.label || JSON.stringify(s)}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* الصور */}
                      {move.images?.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-xs mb-2">الصور ({move.images.length}):</p>
                          <div className="flex flex-wrap gap-2">
                            {move.images.map((img: any) => (
                              <a key={img.id} href={img.imageUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={img.imageUrl}
                                  alt="صورة الطلب"
                                  className="w-16 h-16 object-cover rounded border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {(customer as any).moves?.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-sm">لا توجد طلبات نقل لهذا العميل</div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("customers");
  const [deleteCustomer, setDeleteCustomer] = useState<any>(null);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [viewCustomerId, setViewCustomerId] = useState<number | null>(null);
  // حقول نموذج التعديل
  const [editTitle, setEditTitle] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");

  const [editNotes, setEditNotes] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const branchesQuery = trpc.branches.list.useQuery(undefined, { enabled: !!user && user.role === 'admin' });
  const branches = branchesQuery.data ?? [];

  const openEditDialog = (customer: any) => {
    setEditCustomer(customer);
    setEditTitle(customer.title ?? "");
    setEditFirstName(customer.firstName ?? "");
    setEditLastName(customer.lastName ?? "");
    setEditEmail(customer.email ?? "");
    setEditPhone(customer.phone ?? "");
    setEditCompany(customer.company ?? "");

    setEditNotes(customer.notes ?? "");
  };

  // Access control: admin and branch_manager only.
  // branch_manager has read-only view (write actions are hidden via isReadOnly).
  const isReadOnly = user?.role === "branch_manager";
  useEffect(() => {
    if (!loading && isAuthenticated && user?.role !== "admin" && user?.role !== "branch_manager") {
      navigate("/");
    }
  }, [loading, isAuthenticated, user, navigate]);

  // ── Data queries ──
  const customersQuery = trpc.customers.list.useQuery(
    user?.role === 'admin' ? { branchId: selectedBranchId } : undefined,
    { enabled: !!user }
  );

  const movesQuery = trpc.moves?.list?.useQuery
    ? trpc.moves.list.useQuery(
        user?.role === 'admin' ? { branchId: selectedBranchId } : undefined,
        { enabled: !!user }
      )
    : { data: undefined, isLoading: false, refetch: () => {} };

  const customers = customersQuery.data ?? [];
  const moves = (movesQuery as any).data ?? [];

  // ── Filter ──
  const filteredCustomers = customers.filter((c: any) => {
    const q = searchTerm.toLowerCase();
    const kundenummer = (c.kundenummer || formatCustomerNumber(c.id) || "").toLowerCase();
    return (
      kundenummer.includes(q) ||
      c.firstName?.toLowerCase().includes(q) ||
      c.lastName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  });

  const filteredMoves = moves.filter((m: any) => {
    const q = searchTerm.toLowerCase();
    const kundenummer = formatCustomerNumber(m.customerId)?.toLowerCase();
    return (
      kundenummer?.includes(q) ||
      m.pickupAddress?.toLowerCase().includes(q) ||
      m.deliveryAddress?.toLowerCase().includes(q)
    );
  });


  // ── Stats ──
  const totalCustomers = customers.length;
  const activeMoves = moves.filter((m: any) =>
    ["pending", "confirmed", "in_progress"].includes(m.status)
  ).length;
  const unpaidMoves = moves.filter((m: any) => m.paymentStatus === "unpaid");
  const pendingAmount = unpaidMoves.reduce(
    (sum: number, m: any) => sum + parseFloat(m.grossPrice ?? 0),
    0
  );
  const completedMoves = moves.filter((m: any) => m.status === "completed");
  const monthlyRevenue = completedMoves.reduce(
    (sum: number, m: any) => sum + parseFloat(m.grossPrice ?? 0),
    0
  );

  const updateCustomerMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث بيانات العميل بنجاح");
      setEditCustomer(null);
      customersQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "فشل تحديث البيانات"),
  });

  const handleSaveEdit = () => {
    if (!editCustomer) return;
    updateCustomerMutation.mutate({
      customerId: editCustomer.id,
      data: {
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail || undefined,
        phone: editPhone || undefined,
        company: editCompany || undefined,

        notes: editNotes || undefined,
      },
    });
  };

  const deleteCustomerMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف العميل بنجاح");
      setDeleteCustomer(null);
      customersQuery.refetch();
      (movesQuery as any).refetch?.();
    },
    onError: (err) => toast.error(err.message || "فشل حذف العميل"),
  });

  const handleRefresh = () => {
    customersQuery.refetch();
    (movesQuery as any).refetch?.();
    toast.success("تم تحديث البيانات");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} /> الرئيسية
          </button>
          <h1 className="text-lg font-bold text-gray-900">لوحة تحكم المدير</h1>
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
            onClick={handleRefresh}
            className="flex items-center gap-1"
          >
            <RefreshCw size={14} /> تحديث
          </Button>
          {!isReadOnly && (
            <Button
              size="sm"
              onClick={() => navigate("/new-customer")}
              className="text-white flex items-center gap-1"
              style={{backgroundColor: '#1a4d6d'}}
            >
              <Plus size={14} /> عميل جديد
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="إجمالي العملاء"
            value={totalCustomers}
            sub={`${totalCustomers} عميل مسجل`}
            icon={Users}
            color="bg-[#1a4d6d]"
          />
          <StatCard
            title="الطلبات النشطة"
            value={activeMoves}
            sub="قيد التنفيذ الآن"
            icon={Package}
            color="bg-orange-500"
          />
          <StatCard
            title="المدفوعات المعلقة"
            value={`${pendingAmount.toLocaleString()} €`}
            sub={`من ${unpaidMoves.length} طلبات`}
            icon={AlertTriangle}
            color="bg-red-500"
          />
          <StatCard
            title="الإيرادات (مكتمل)"
            value={`${monthlyRevenue.toLocaleString()} €`}
            sub={`${completedMoves.length} طلب مكتمل`}
            icon={TrendingUp}
            color="bg-[#d97e3a]"
          />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {([
            { label: "عميل جديد",       icon: Plus,          path: "/new-customer",     color: "bg-[#1a4d6d] text-white hover:bg-[#14394f]", showFor: ["admin"] },
            { label: "التقارير الإدارية",icon: BarChart2,     path: "/admin-reports",    color: "bg-indigo-600 text-white hover:bg-indigo-700", showFor: ["admin", "branch_manager"] },
            { label: "إدارة الفروع",    icon: Users,         path: "/branches",         color: "bg-gray-700 text-white hover:bg-gray-800", showFor: ["admin"] },
            { label: "إدارة المستخدمين", icon: UserCog,       path: "/users",            color: "bg-red-600 text-white hover:bg-red-700", showFor: ["admin"] },
          ] as const)
            .filter(action => action.showFor.includes((user?.role ?? "") as any))
            .map(({ label, icon: Icon, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-semibold transition-colors ${color}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              <TabsTrigger value="customers">العملاء ({totalCustomers})</TabsTrigger>
              <TabsTrigger value="moves">الطلبات ({moves.length})</TabsTrigger>
              <TabsTrigger value="completed">
                <CheckCircle2 size={13} className="mr-1" />
                مكتملة ({completedMoves.length})
              </TabsTrigger>
              <TabsTrigger value="reports">
                <AlertOctagon size={13} className="mr-1" />
                تقارير ({moves.filter((m: any) => m.schadenDescription || m.beschwerdeDescription).length})
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="بحث بـ Kundennummer أو الاسم أو العنوان..."

                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* ── Customers Tab ── */}
          <TabsContent value="customers">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">إدارة العملاء</CardTitle>
                    <CardDescription>قائمة بجميع العملاء المسجلين</CardDescription>
                  </div>
                  {!isReadOnly && (
                    <Button
                      size="sm"
                      onClick={() => navigate("/new-customer")}
                      className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
                    >
                      <Plus size={14} className="mr-1" /> عميل جديد
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {customersQuery.isLoading ? (
                  <div className="text-center py-10 text-gray-400">جاري التحميل...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-10">
                    <Users size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 mb-4">
                      {searchTerm ? "لا توجد نتائج للبحث" : "لا يوجد عملاء بعد"}
                    </p>
                    {!searchTerm && !isReadOnly && (
                      <Button
                        onClick={() => navigate("/new-customer")}
                        className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
                      >
                        <Plus size={14} className="mr-1" /> أضف أول عميل
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">#</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">الاسم</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">البريد / الهاتف</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">الشركة</th>

                          <th className="px-4 py-2 text-right font-semibold text-gray-600">تاريخ التسجيل</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((customer: any, idx: number) => (
                          <tr key={customer.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium">
                              <div>{customer.title} {customer.firstName} {customer.lastName}</div>
                              <div className="text-xs text-[#1a4d6d]">Kundennummer: {customer.kundenummer || formatCustomerNumber(customer.id) || "—"}</div>
                            </td>

                            <td className="px-4 py-3 text-gray-500">
                              <div>{customer.email || "—"}</div>
                              <div className="text-xs">{customer.phone || "—"}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{customer.company || "—"}</td>

                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {customer.createdAt
                                ? new Date(customer.createdAt).toLocaleDateString("de-DE")
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {!isReadOnly && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditDialog(customer)}
                                    title="تعديل"
                                  >
                                    <Edit2 size={13} />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setViewCustomerId(customer.id)}
                                  title="عرض"
                                >
                                  <Eye size={13} />
                                </Button>
                                {!isReadOnly && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                                    onClick={() => setDeleteCustomer(customer)}
                                    title="حذف العميل"
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Moves Tab ── */}
          <TabsContent value="moves">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">إدارة الطلبات</CardTitle>
                <CardDescription>قائمة بجميع طلبات النقل</CardDescription>
              </CardHeader>
              <CardContent>
                {(movesQuery as any).isLoading ? (
                  <div className="text-center py-10 text-gray-400">جاري التحميل...</div>
                ) : filteredMoves.length === 0 ? (
                  <div className="text-center py-10">
                    <Package size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 mb-4">
                      {searchTerm ? "لا توجد نتائج للبحث" : "لا توجد طلبات بعد"}
                    </p>
                    {!searchTerm && !isReadOnly && (
                      <Button
                        onClick={() => navigate("/new-customer")}
                        className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
                      >
                        <Plus size={14} className="mr-1" /> أضف طلب جديد
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">الكود</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">من</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">إلى</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">التاريخ</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">الحالة</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">الدفع</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">السعر</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMoves.map((move: any) => (
                          <tr key={move.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-[#1a4d6d]">{move.kundenummer || formatCustomerNumber(move.customerId) || move.moveCode}</td>
                            <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{move.pickupAddress}</td>
                            <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{move.deliveryAddress}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {move.pickupDate
                                ? new Date(move.pickupDate).toLocaleDateString("de-DE")
                                : "—"}
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={move.status} /></td>
                            <td className="px-4 py-3"><PayBadge status={move.paymentStatus} /></td>
                            <td className="px-4 py-3 font-semibold">
                              {move.grossPrice ? `${Number(move.grossPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* ── Completed Moves Tab ── */}
          <TabsContent value="completed">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-[#d97e3a]" />
                  المهام المكتملة
                </CardTitle>
                <CardDescription>جميع طلبات النقل التي أنجزها العمال</CardDescription>
              </CardHeader>
              <CardContent>
                {completedMoves.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle2 size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">لا توجد مهام مكتملة بعد</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">الكود</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">من</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">إلى</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">تاريخ النقل</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">تاريخ الإنجاز</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">الدفع</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">السعر</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedMoves.map((move: any) => (
                          <tr key={move.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-[#bd682b]">{move.kundenummer || formatCustomerNumber(move.customerId) || move.moveCode}</td>
                            <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{move.pickupAddress}</td>
                            <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{move.deliveryAddress}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {move.pickupDate ? new Date(move.pickupDate).toLocaleDateString("de-DE") : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {move.completedAt ? new Date(move.completedAt).toLocaleDateString("de-DE") : "—"}
                            </td>
                            <td className="px-4 py-3"><PayBadge status={move.paymentStatus} /></td>
                            <td className="px-4 py-3 font-semibold">
                              {move.grossPrice ? `${Number(move.grossPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Reports Tab (Schaden & Beschwerde) ── */}
          <TabsContent value="reports">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertOctagon size={18} className="text-red-600" />
                  تقارير التلف والشكاوى
                </CardTitle>
                <CardDescription>جميع التقارير المسجلة من قبل العمال</CardDescription>
              </CardHeader>
              <CardContent>
                {moves.filter((m: any) => m.schadenDescription || m.beschwerdeDescription).length === 0 ? (
                  <div className="text-center py-10 space-y-4">
                    <AlertOctagon size={40} className="mx-auto text-gray-300 mb-3" />
                    <div>
                      <p className="text-gray-700 font-medium">لا توجد تقارير حتى الآن</p>
                      <p className="text-sm text-gray-500 mt-1">يمكن تسجيل التلف أو الشكوى من متابعة الطلبات أو من لوحة العامل، وستظهر هنا تلقائيًا بعد الحفظ.</p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Button variant="outline" onClick={() => navigate('/orders')} className="border-[#1a4d6d] text-[#1a4d6d] hover:bg-[#eaf2f7]">
                        الذهاب إلى الطلبات
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/worker')} className="border-[#d97e3a] text-[#8f4f1f] hover:bg-[#fff2e8]">
                        فتح لوحة العامل
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {moves
                      .filter((m: any) => m.schadenDescription || m.beschwerdeDescription)
                      .map((move: any) => (
                        <div key={move.id} className="border rounded-lg p-4 bg-white">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-gray-800">{move.kundenummer || formatCustomerNumber(move.customerId) || move.moveCode}</span>
                            <div className="flex gap-2">
                              <StatusBadge status={move.status} />
                              <span className="text-xs text-gray-400">
                                {move.pickupDate ? new Date(move.pickupDate).toLocaleDateString("de-DE") : "—"}
                              </span>
                            </div>
                          </div>
                          {move.schadenDescription && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                              <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-1">
                                <AlertTriangle size={14} /> تقرير تلف (Schaden)
                              </p>
                              <p className="text-sm text-red-600">{move.schadenDescription}</p>
                              {move.schadenImages && (() => {
                                try {
                                  const imgs = JSON.parse(move.schadenImages);
                                  return imgs.length > 0 ? (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                      {imgs.map((url: string, i: number) => (
                                        <a key={i} href={url} target="_blank" rel="noreferrer">
                                          <img src={url} alt="" className="w-16 h-16 object-cover rounded border" />
                                        </a>
                                      ))}
                                    </div>
                                  ) : null;
                                } catch { return null; }
                              })()}
                            </div>
                          )}
                          {move.beschwerdeDescription && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                              <p className="text-sm font-semibold text-orange-700 flex items-center gap-2 mb-1">
                                <MessageSquareWarning size={14} /> شكوى (Beschwerde)
                              </p>
                              <p className="text-sm text-orange-600">{move.beschwerdeDescription}</p>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {/* نافذة تعديل بيانات العميل */}
      <Dialog open={!!editCustomer} onOpenChange={(open) => !open && setEditCustomer(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات العميل</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">اللقب</label>
              <select
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
                <option value="Firma">Firma</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الأول *</label>
              <input
                type="text"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="الاسم الأول"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم العائلة *</label>
              <input
                type="text"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="اسم العائلة"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="+49 ..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الشركة</label>
              <input
                type="text"
                value={editCompany}
                onChange={(e) => setEditCompany(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="اسم الشركة"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                rows={3}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditCustomer(null)}>إلغاء</Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateCustomerMutation.isPending || !editFirstName || !editLastName}
              className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
            >
              {updateCustomerMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة عرض بيانات العميل الكاملة */}
      {viewCustomerId && (
        <CustomerViewDialog
          customerId={viewCustomerId}
          onClose={() => setViewCustomerId(null)}
        />
      )}

      {/* نافذة تأكيد حذف العميل */}
      <AlertDialog open={!!deleteCustomer} onOpenChange={() => setDeleteCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف العميل</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العميل{" "}
              <strong>{deleteCustomer?.title} {deleteCustomer?.firstName} {deleteCustomer?.lastName}</strong>؟
              <br />
              <span className="text-red-600 font-medium">
                سيتم حذف جميع طلباته وبياناته بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteCustomer) {
                  deleteCustomerMutation.mutate({ customerId: deleteCustomer.id });
                }
              }}
            >
              {deleteCustomerMutation.isPending ? "جاري الحذف..." : "حذف العميل نهائياً"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
