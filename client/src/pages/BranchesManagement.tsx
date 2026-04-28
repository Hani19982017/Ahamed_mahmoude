import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { BranchFormDialog } from "@/components/BranchFormDialog";
import { invalidateBranchesList } from "@/lib/branchSync";
import {
  Plus,
  Edit2,
  MapPin,
  Phone,
  Building2,
  ArrowLeft,
  Info,
  Power,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

function EmptyBranches({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-20 text-center">
      <Building2 size={56} className="mx-auto mb-4 text-gray-300" />
      <h3 className="mb-2 text-lg font-semibold text-gray-700">لا توجد فروع بعد</h3>
      <p className="mx-auto mb-6 max-w-sm text-sm text-gray-500">
        أضف أول فرع فعّال لشركتك لتتمكن من توزيع العملاء والطلبات والمستخدمين حسب المدينة.
      </p>
      <Button onClick={onAdd} className="bg-[#1a4d6d] text-white hover:bg-[#14394f]">
        <Plus size={15} className="mr-1" /> إضافة أول فرع
      </Button>
    </div>
  );
}

export default function BranchesManagement() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [showInfo, setShowInfo] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!loading && isAuthenticated && !isAdmin) {
      navigate("/");
    }
  }, [loading, isAuthenticated, isAdmin, navigate]);

  const branchesQuery = trpc.branches.list.useQuery(undefined, {
    enabled: !!user,
  });

  const deactivateMutation = trpc.branches.deactivate.useMutation({
    onSuccess: async () => {
      await invalidateBranchesList(utils);
      toast.success("تم تعطيل الفرع مع الاحتفاظ بجميع بياناته");
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  const reactivateMutation = trpc.branches.reactivate.useMutation({
    onSuccess: async () => {
      await invalidateBranchesList(utils);
      toast.success("تمت إعادة تفعيل الفرع بنجاح");
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  const branches = useMemo(() => (branchesQuery.data as any[] | undefined) ?? [], [branchesQuery.data]);
  const activeBranches = useMemo(() => branches.filter((branch) => branch.isActive), [branches]);
  const inactiveBranches = useMemo(() => branches.filter((branch) => !branch.isActive), [branches]);

  const openNew = () => {
    setEditingBranch(null);
    setDialogOpen(true);
  };

  const openEdit = (branch: any) => {
    setEditingBranch(branch);
    setDialogOpen(true);
  };

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingBranch(null);
    }
  };

  const handleToggleActive = (branch: any) => {
    if (branch.isActive) {
      const confirmed = confirm(
        `هل تريد تعطيل فرع "${branch.name}"؟\nسيبقى الفرع محفوظاً داخل النظام ولن تُحذف البيانات المرتبطة به.`
      );
      if (confirmed) {
        deactivateMutation.mutate({ branchId: branch.id });
      }
      return;
    }

    const confirmed = confirm(`هل تريد إعادة تفعيل فرع "${branch.name}"؟`);
    if (confirmed) {
      reactivateMutation.mutate({ branchId: branch.id });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#1a4d6d]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Button onClick={() => (window.location.href = getLoginUrl())}>تسجيل الدخول</Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert size={42} className="mx-auto mb-4 text-red-500" />
          <h1 className="mb-2 text-lg font-bold text-gray-900">هذا القسم مخصص للمدير فقط</h1>
          <p className="text-sm leading-7 text-gray-600">
            لا يمكن لأي مستخدم غير المدير الوصول إلى إدارة الفروع أو تعديل حالتها.
          </p>
          <Button onClick={() => navigate("/")} className="mt-5 bg-[#1a4d6d] text-white hover:bg-[#14394f]">
            العودة للرئيسية
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={16} /> الرئيسية
          </button>
          <h1 className="text-lg font-bold text-gray-900">إدارة الفروع</h1>
          <span className="rounded-full border border-[#d97e3a]/25 bg-[#fff2e8] px-2 py-0.5 text-xs font-medium text-[#bd682b]">
            للمدير فقط
          </span>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-gray-400 transition-colors hover:text-[#1a4d6d]"
            title="شرح القسم"
          >
            <Info size={18} />
          </button>
        </div>
        <Button
          onClick={openNew}
          className="flex items-center gap-1 bg-[#1a4d6d] text-white hover:bg-[#14394f]"
          size="sm"
        >
          <Plus size={14} /> إضافة فرع جديد
        </Button>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {showInfo && (
          <div className="mb-6 rounded-xl border border-[#1a4d6d]/15 bg-[#eef4f8] p-5">
            <h2 className="mb-2 flex items-center gap-2 font-bold text-[#1a4d6d]">
              <Info size={18} /> كيف نستفيد من قسم الفروع؟
            </h2>
            <div className="space-y-2 text-sm leading-7 text-[#355d74]">
              <p>
                هذا القسم مخصص لضبط المدن أو المراكز التشغيلية مثل <strong>Move Frankfurt</strong> و<strong>Move Berlin</strong> مع الحفاظ على جميع البيانات حتى عند إيقاف الفرع.
              </p>
              <p>
                عندما تعطل فرعاً، تبقى بياناته محفوظة ولا تضيع العملاء أو المستخدمون أو السجلات المرتبطة به. ويمكنك لاحقاً إعادة تفعيله بضغطة واحدة.
              </p>
              <p className="font-medium text-[#d97e3a]">
                أفضل استخدام عملي لهذا القسم هو تنظيم الفروع النشطة، إيقاف الفروع المؤقتة بأمان، وربط المستخدمين والعملاء بالمدينة الصحيحة دون حذف نهائي.
              </p>
            </div>
          </div>
        )}

        {branches.length > 0 && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <Building2 size={22} className="mx-auto mb-1 text-[#1a4d6d]" />
                <p className="text-2xl font-bold">{branches.length}</p>
                <p className="text-xs text-gray-500">إجمالي الفروع</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <Power size={22} className="mx-auto mb-1 text-[#1a4d6d]" />
                <p className="text-2xl font-bold">{activeBranches.length}</p>
                <p className="text-xs text-gray-500">فروع نشطة</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <RotateCcw size={22} className="mx-auto mb-1 text-[#d97e3a]" />
                <p className="text-2xl font-bold">{inactiveBranches.length}</p>
                <p className="text-xs text-gray-500">فروع معطلة قابلة للإعادة</p>
              </CardContent>
            </Card>
          </div>
        )}

        {branchesQuery.isLoading ? (
          <div className="py-16 text-center text-gray-400">جاري التحميل...</div>
        ) : branches.length === 0 ? (
          <EmptyBranches onAdd={openNew} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch: any) => (
              <Card key={branch.id} className="border border-gray-200 transition-shadow hover:shadow-md">
                <CardContent className="pt-5 pb-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-0.5 flex items-center gap-2">
                        <Building2 size={16} className="text-[#1a4d6d]" />
                        <h3 className="text-base font-bold text-gray-900">{branch.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin size={12} />
                        <span>{branch.city}</span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        branch.isActive
                          ? "bg-[#fff2e8] text-[#bd682b]"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {branch.isActive ? "نشط" : "معطل"}
                    </span>
                  </div>

                  <div className="mb-4 space-y-1.5 text-sm text-gray-600">
                    {branch.address && (
                      <div className="flex items-start gap-2">
                        <MapPin size={13} className="mt-0.5 shrink-0 text-gray-400" />
                        <span className="line-clamp-2">{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-gray-400" />
                        <span dir="ltr">{branch.phone}</span>
                      </div>
                    )}
                    {!branch.address && !branch.phone && (
                      <p className="text-xs italic text-gray-400">لم تُضف تفاصيل إضافية بعد</p>
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-gray-100 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-1 items-center gap-1 text-xs"
                      onClick={() => openEdit(branch)}
                    >
                      <Edit2 size={12} /> تعديل
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`flex flex-1 items-center gap-1 text-xs ${
                        branch.isActive
                          ? "text-[#bd682b] hover:border-[#e7b18a] hover:bg-[#fff7f1]"
                          : "text-[#1a4d6d] hover:border-[#1a4d6d]/25 hover:bg-[#f4f8fb]"
                      }`}
                      onClick={() => handleToggleActive(branch)}
                      disabled={deactivateMutation.isPending || reactivateMutation.isPending}
                    >
                      {branch.isActive ? <Power size={12} /> : <RotateCcw size={12} />}
                      {branch.isActive ? "تعطيل" : "إعادة التفعيل"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BranchFormDialog
        open={dialogOpen}
        onOpenChange={closeDialog}
        branch={editingBranch}
      />
    </div>
  );
}
