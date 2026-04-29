import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

// ── تعريف البطاقات حسب الدور ──────────────────────────────────────────────────
// admin: كل شيء
const ADMIN_CARDS = [
  { href: "/new-customer",  emoji: "👥", title: "العملاء و إدارتها",          desc: "إضافة بيانات العملاء" },
  { href: "/orders",        emoji: "📦", title: "متابعة العملاء و إدارتها",    desc: "متابعة الإستحواذ على العميل" },
  { href: "/reminders",     emoji: "⏰", title: "Erinnerungen & Kontaktstatus", desc: "Kunden, die nachverfolgt werden müssen" },
  { href: "/rechnungen",    emoji: "🧾", title: "الفواتير",                    desc: "عرض وإدارة الفواتير والمدفوعات" },
  { href: "/admin",         emoji: "📊", title: "لوحة التحكم",                 desc: "إدارة العملاء والطلبات والمدفوعات" },
  { href: "/worker",        emoji: "👷", title: "مهام العمال اليومية",          desc: "عرض المهام والعناوين والصور" },
  { href: "/admin-reports", emoji: "📈", title: "التقارير المالية الإدارية",    desc: "التلف والشكاوى والإيرادات" },
  { href: "/branches",      emoji: "🏢", title: "إدارة الفروع",                desc: "إضافة الفروع وتعطيلها وإعادة تفعيلها" },
  { href: "/users",         emoji: "🔐", title: "إدارة المستخدمين",            desc: "الصلاحيات والأدوار والحذف", adminOnly: true },
];

// sales: لا يرى الصفحة الرئيسية (admin) ولا إدارة المستخدمين ولا التقارير الإدارية
const SALES_CARDS = [
  { href: "/new-customer", emoji: "👥", title: "العملاء و إدارتها",          desc: "إضافة بيانات العملاء" },
  { href: "/orders",       emoji: "📦", title: "متابعة العملاء و إدارتها",             desc: "متابعة الإستحواذ على العميل" },
   { href: "/new-customer", emoji: "👥", title: "العملاء و إدارتها",          desc: "إضافة بيانات العملاء" },
  { href: "/orders",       emoji: "📦", title: "متابعة العملاء و إدارتها",             desc: "متابعة الإستحواذ على العميل" },
  { href: "/reminders",    emoji: "⏰", title: "Erinnerungen & Kontaktstatus", desc: "Kunden, die nachverfolgt werden müssen" },
  { href: "/rechnungen",   emoji: "🧾", title: "الفواتير",            desc: "عرض وإدارة الفواتير والمدفوعات" },
  { href: "/worker",       emoji: "👷", title: "مهام العمال اليومية",         desc: "عرض المهام والعناوين" },
];

// worker / supervisor: فقط لوحة العامل
const WORKER_CARDS = [
  { href: "/worker",       emoji: "👷", title: "مهامي اليوم",         desc: "عرض المهام والعناوين والصور" },
];

// branch_manager: read-only view of orders, invoices, worker tasks, and reports.
// Cannot add customers, cannot manage branch users.
const BRANCH_MANAGER_CARDS = [
  { href: "/orders",       emoji: "📦", title: "متابعة العملاء و إدارتها",             desc: "متابعة الإستحواذ على العميل" },
  { href: "/rechnungen",   emoji: "🧾", title: "الفواتير",            desc: "عرض فواتير الفرع" },
  { href: "/worker",       emoji: "👷", title: "مهام العمال اليومية",         desc: "عرض المهام والعناوين" },
  { href: "/admin-reports",emoji: "📈", title: "التقارير المالية الإدارية",             desc: "التلف والشكاوى والإيرادات" },
];

function getCardsForRole(role: string) {
  switch (role) {
    case "admin":          return ADMIN_CARDS;
    case "sales":          return SALES_CARDS;
    case "worker":
    case "supervisor":     return WORKER_CARDS;
    case "branch_manager": return BRANCH_MANAGER_CARDS;
    default:               return SALES_CARDS; // user عادي = مثل sales
  }
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    admin:          "مدير / صاحب شركة",
    sales:          "فريق المبيعات",
    worker:         "عامل",
    supervisor:     "مشرف",
    branch_manager: "مدير فرع",
  };
  return map[role] ?? role;
}

function getRoleBadgeColor(role: string) {
  const map: Record<string, string> = {
    admin:          "border-[#d97e3a]/30 bg-[#fff2e8] text-[#bd682b]",
    sales:          "border-[#1a4d6d]/20 bg-[#eaf2f7] text-[#1a4d6d]",
    worker:         "border-[#1a4d6d]/20 bg-[#eaf2f7] text-[#1a4d6d]",
    supervisor:     "border-[#1a4d6d]/20 bg-[#eaf2f7] text-[#1a4d6d]",
    branch_manager: "border-[#d97e3a]/30 bg-[#fff2e8] text-[#bd682b]",
  };
  return map[role] ?? "border-[#1a4d6d]/20 bg-[#eaf2f7] text-[#1a4d6d]";
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const role = user?.role ?? "sales";
  const cards = getCardsForRole(role);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(26,77,109,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(217,126,58,0.18),transparent_24%),linear-gradient(135deg,#0f2f44_0%,#1a4d6d_52%,#14394f_100%)] text-white">
        <div className="container flex min-h-screen items-center justify-center py-12">
          <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-6 text-right arabic">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm text-white/90 backdrop-blur-sm">
                Umzug Profis · Management System
              </span>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold leading-tight sm:text-5xl">إدارة العملاء والطلبات والعمال والفواتير</h1>
                <p className="max-w-2xl text-lg leading-8 text-white/80">
                  اختر نوع الدخول الصحيح من البداية: المدير يدخل عبر البريد الإلكتروني الثابت وكلمة سر خاصة، بينما يدخل العمال وبقية المستخدمين عبر اسم المستخدم وكلمة السر.
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-md">
              <div className="mb-6 flex flex-col items-center text-center">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/98724221/dRc3boRSBaEdddsbQmhM9N/move-profis-logo_c64616b7.webp"
                  alt="Move Profis"
                  className="mb-4 h-24 w-auto rounded-2xl border border-[#d97e3a]/40 bg-white px-6 py-4 shadow-lg"
                />
                <h2 className="text-2xl font-semibold">أهلاً بك في Umzug Profis</h2>
                <p className="mt-2 text-sm leading-7 text-white/75">اختر القسم المناسب لك: المدير له دخول مستقل عبر البريد الإلكتروني الثابت مع كلمة سر خاصة، والعمال وبقية المستخدمين لهم صفحة دخول مستقلة عبر اسم المستخدم وكلمة السر.</p>
              </div>
              <div className="space-y-3">
                <Button asChild size="lg" className="w-full bg-[#d97e3a] text-white hover:bg-[#bd682b]">
                  <a href="/login#manager">دخول المدير عبر البريد الإلكتروني وكلمة السر</a>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <a href="/login#staff">دخول العمال وبقية المستخدمين</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container py-8">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-[#1a4d6d]/12 bg-white/90 shadow-[0_18px_55px_rgba(26,77,109,0.12)] backdrop-blur-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:p-8">
            <div className="space-y-5 arabic">
              <span className="inline-flex items-center rounded-full border border-[#d97e3a]/30 bg-[#fff2e8] px-4 py-1 text-sm font-medium text-[#bd682b]">
                Umzug Profis Dashboard
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-[#1a4d6d] sm:text-4xl">مرحباً {user?.name}، إدارة العمليات أصبحت في مكان واحد</h1>
                <p className="max-w-3xl text-base leading-8 text-slate-600">
                  استخدم البطاقات التالية للوصول السريع إلى إدارة العملاء، متابعة الطلبات، مهام العمال، التقارير، الفواتير، والفروع ضمن واجهة موحّدة تحمل الهوية البصرية الخاصة بـ Umzug Profis.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex text-xs px-3 py-1 rounded-full border font-medium ${getRoleBadgeColor(role)}`}>
                  {getRoleLabel(role)}
                </span>
                <span className="inline-flex rounded-full border border-[#1a4d6d]/15 bg-[#eaf2f7] px-3 py-1 text-xs font-medium text-[#1a4d6d]">
                  اسم المستخدم: {user?.username || "—"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-4 lg:items-end">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/98724221/dRc3boRSBaEdddsbQmhM9N/move-profis-logo_c64616b7.webp"
                alt="Move Profis"
                className="h-auto w-full max-w-[260px] rounded-[1.75rem] border border-[#d97e3a]/35 bg-white px-5 py-4 shadow-lg"
              />
              <p className="text-right text-sm text-slate-500">نظام إدارة عمليات النقل والشحن</p>
              <Button
                onClick={() => logout()}
                className="bg-[#1a4d6d] text-white hover:bg-[#14394f]"
              >
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, idx) => (
            <a
              key={card.href}
              href={card.href}
              className={`relative overflow-hidden rounded-[1.6rem] border bg-white/95 p-6 shadow-[0_14px_40px_rgba(26,77,109,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(26,77,109,0.16)] animate-fade-in ${
                (card as any).adminOnly ? "border-orange-200" : "border-[#1a4d6d]/10"
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1a4d6d] via-[#245f86] to-[#d97e3a]" />
              {(card as any).adminOnly && (
                <span className="absolute left-4 top-4 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                  للمدير فقط
                </span>
              )}
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf2f7] text-3xl shadow-inner">
                {card.emoji}
              </div>
              <h2 className="mb-2 text-xl font-semibold text-[#1a4d6d]">{card.title}</h2>
              <p className="leading-7 text-slate-600">{card.desc}</p>
              <div className="mt-5 inline-flex items-center text-sm font-medium text-[#d97e3a]">
                فتح القسم
              </div>
            </a>
          ))}
        </div>

        {(role === "worker" || role === "supervisor") && (
          <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center shadow-sm">
            <p className="text-sm text-orange-800">
              مرحباً {user?.name}! يمكنك الوصول إلى مهامك اليومية من خلال لوحة العامل أعلاه.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
