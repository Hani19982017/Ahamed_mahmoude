import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, AlertTriangle, MessageSquare, Euro, Package,
  CheckCircle, XCircle, BarChart2, AlertCircle, ChevronDown, ChevronUp, Image,
  Download, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";

// ── PDF Export ───────────────────────────────────────────────────────────────
async function exportReportPDF(params: {
  year: number;
  month: number;
  filterAll: boolean;
  summary: any;
  monthly: any[];
  schaden: any[];
  beschwerde: any[];
  monthNames: string[];
}) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const { year, month, filterAll, summary: s, monthly, schaden, beschwerde, monthNames } = params;
  const periodLabel = filterAll ? `Jahr ${year}` : `${monthNames[month - 1]} ${year}`;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // ── Header ──
  doc.setFillColor(0, 170, 187);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Verwaltungsbericht", margin, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Zeitraum: ${periodLabel}`, margin, 21);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-DE")}`, pageW - margin, 21, { align: "right" });

  let y = 36;

  // ── KPI Summary ──
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Finanzübersicht", margin, y);
  y += 5;

  const fmtEur = (n: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Kennzahl", "Wert"]],
    body: [
      ["Gesamtumsatz (Brutto)", fmtEur(s.totalRevenue)],
      ["Davon bezahlt", fmtEur(s.paidRevenue ?? 0)],
      ["Offene Zahlungen", `${s.unpaidMoves} Aufträge`],
      ["Schadenskosten", fmtEur(s.schadenKosten)],
      ["Nettoumsatz", fmtEur(s.netRevenue)],
      ["Gesamtaufträge", `${s.totalMoves} (${s.completedMoves} abgeschlossen)`],
      ["Schadensfälle", String(s.schadenCount)],
      ["Beschwerden", String(s.beschwerdeCount)],
    ],
    headStyles: { fillColor: [0, 170, 187], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 250, 251] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 }, 1: { halign: "right" } },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Monthly Table ──
  const monthsWithData = monthly.filter(m => m.totalMoves > 0);
  if (monthsWithData.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(`Monatliche Übersicht ${year}`, margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Monat", "Aufträge", "Umsatz (Brutto)", "Bezahlt", "Schadenskosten", "Nettoumsatz"]],
      body: monthsWithData.map(m => [
        m.monthName,
        `${m.totalMoves} (${m.paidMoves} bez.)`,
        fmtEur(m.totalRevenue),
        fmtEur(m.paidRevenue ?? 0),
        m.schadenKosten > 0 ? fmtEur(m.schadenKosten) : "—",
        fmtEur(m.netRevenue),
      ]),
      foot: [[
        "Gesamt",
        String(monthly.reduce((a, m) => a + m.totalMoves, 0)),
        fmtEur(monthly.reduce((a, m) => a + m.totalRevenue, 0)),
        fmtEur(monthly.reduce((a, m) => a + (m.paidRevenue ?? 0), 0)),
        fmtEur(monthly.reduce((a, m) => a + m.schadenKosten, 0)),
        fmtEur(monthly.reduce((a, m) => a + m.netRevenue, 0)),
      ]],
      headStyles: { fillColor: [0, 170, 187], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [230, 248, 250], textColor: [0, 100, 110], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 252, 253] },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: "bold" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Schaden Table ──
  if (schaden.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 30, 30);
    doc.text(`Schadensfälle (${schaden.length})`, margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Auftrag", "Kunde", "Beschreibung", "Status", "Kosten"]],
      body: schaden.map(r => [
        r.kundenummer || r.moveCode,
        r.customerName || "—",
        (r.schadenDescription ?? "").substring(0, 50) + ((r.schadenDescription ?? "").length > 50 ? "..." : ""),
        r.schadenStatus ?? "Gemeldet",
        r.schadenKosten != null ? fmtEur(r.schadenKosten) : "—",
      ]),
      foot: [["Gesamt", "", "", "", fmtEur(schaden.reduce((a, r) => a + (r.schadenKosten ?? 0), 0))]],
      headStyles: { fillColor: [200, 50, 50], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [255, 240, 240], textColor: [150, 20, 20], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 250, 250] },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 4: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Beschwerde Table ──
  if (beschwerde.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 100, 0);
    doc.text(`Beschwerden (${beschwerde.length})`, margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Auftrag", "Kunde", "Beschreibung", "Schweregrad", "Datum"]],
      body: beschwerde.map(r => [
        r.kundenummer || r.moveCode,
        r.customerName || "—",
        (r.beschwerdeDescription ?? "").substring(0, 50) + ((r.beschwerdeDescription ?? "").length > 50 ? "..." : ""),
        r.beschwerdeSchweregard ?? "—",
        new Date(r.createdAt).toLocaleDateString("de-DE"),
      ]),
      headStyles: { fillColor: [200, 120, 0], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 252, 245] },
      styles: { fontSize: 8, cellPadding: 2.5 },
    });
  }

  // ── Footer on all pages ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.setFont("helvetica", "normal");
    doc.text(`Seite ${i} von ${totalPages}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
    doc.text("Check Umzug — Verwaltungsbericht", margin, doc.internal.pageSize.getHeight() - 8);
  }

  const fileName = `Bericht_${filterAll ? year : `${monthNames[month - 1]}_${year}`}.pdf`;
  doc.save(fileName);
}

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const SEVERITY_MAP: Record<string, { label: string; cls: string }> = {
  Hoch:     { label: "Hoch",     cls: "bg-red-100 text-red-800 border-red-200" },
  Mittel:   { label: "Mittel",   cls: "bg-orange-100 text-orange-800 border-orange-200" },
  Niedrig:  { label: "Niedrig",  cls: "bg-[#fff2e8] text-[#8f4f1f] border-[#e7b18a]" },
  high:     { label: "Hoch",     cls: "bg-red-100 text-red-800 border-red-200" },
  medium:   { label: "Mittel",   cls: "bg-orange-100 text-orange-800 border-orange-200" },
  low:      { label: "Niedrig",  cls: "bg-[#fff2e8] text-[#8f4f1f] border-[#e7b18a]" },
  critical: { label: "Kritisch", cls: "bg-[#eaf2f7] text-[#1a4d6d] border-[#9fc0d2]" },
};

function SeverityBadge({ severity }: { severity: string | null }) {
  const cfg = SEVERITY_MAP[severity ?? ""] ?? { label: severity ?? "—", cls: "bg-gray-100 text-gray-700 border-gray-200" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>{cfg.label}</span>;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, sub, icon: Icon, color, trend,
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; color: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon size={20} className="text-white" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend === "up" && <ChevronUp size={13} className="text-[#d97e3a]" />}
            {trend === "down" && <ChevronDown size={13} className="text-red-500" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Bar chart (pure CSS) ──────────────────────────────────────────────────────
function RevenueBar({ data }: { data: { monthName: string; totalRevenue: number; schadenKosten: number; netRevenue: number }[] }) {
  const max = Math.max(...data.map(d => d.totalRevenue), 1);
  const hasAnyRevenue = data.some((d) => d.totalRevenue > 0 || d.schadenKosten > 0);

  if (!hasAnyRevenue) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#d7e5ee] bg-[#f8fbfd] text-sm text-slate-500">
        لا توجد بيانات إيرادات أو أضرار للشهور المختارة بعد.
      </div>
    );
  }

  return (
    <div className="flex h-56 items-end gap-2 w-full rounded-xl border border-[#e3edf3] bg-white/80 px-3 pb-6 pt-4">
      {data.map((d) => {
        const revenueHeight = d.totalRevenue > 0 ? Math.max((d.totalRevenue / max) * 100, 6) : 0;
        const damageHeight = d.schadenKosten > 0 ? Math.max((d.schadenKosten / max) * 100, 3) : 0;

        return (
          <div key={d.monthName} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="relative flex h-full w-full items-end justify-center">
              {damageHeight > 0 && (
                <div
                  className="absolute bottom-0 w-[72%] rounded-t-md bg-red-400/75"
                  style={{ height: `${damageHeight}%` }}
                  title={`Schäden: ${fmt(d.schadenKosten)}`}
                />
              )}
              <div
                className="relative z-10 w-[72%] rounded-t-md bg-[#1a4d6d] opacity-90 transition-all cursor-pointer hover:opacity-100"
                style={{ height: `${revenueHeight}%` }}
                title={`${d.monthName}: ${fmt(d.totalRevenue)}`}
              />
            </div>
            <span className="text-[11px] font-medium text-gray-500">{d.monthName}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminReports() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [filterAll, setFilterAll] = useState(false); // false = الشهر الحالي, true = السنة كاملة
  const [isExporting, setIsExporting] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null); // null = كل الفروع

  // جلب قائمة الفروع (للمدير العام فقط)
  const branchesQuery = trpc.branches.list.useQuery(undefined, {
    enabled: user?.role === 'admin',
  });

  useEffect(() => {
    if (!loading && isAuthenticated && !["admin", "branch_manager"].includes(user?.role ?? "")) {
      navigate("/");
    }
  }, [loading, isAuthenticated, user, navigate]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const isAdmin = user?.role === 'admin';
  const effectiveBranchId = isAdmin ? selectedBranchId : null;

  const summaryQuery = trpc.admin.financialSummary.useQuery(
    { year: selectedYear, month: filterAll ? 0 : selectedMonth, branchId: effectiveBranchId },
    { enabled: ["admin", "branch_manager"].includes(user?.role ?? "") }
  );

  const monthlyQuery = trpc.admin.monthlyRevenue.useQuery(
    { year: selectedYear, branchId: effectiveBranchId },
    { enabled: ["admin", "branch_manager"].includes(user?.role ?? "") }
  );

  const schadenQuery = trpc.admin.schadenList.useQuery(
    { year: selectedYear, month: filterAll ? 0 : selectedMonth, branchId: effectiveBranchId },
    { enabled: ["admin", "branch_manager"].includes(user?.role ?? "") }
  );

  const beschwerdeQuery = trpc.admin.beschwerdeList.useQuery(
    { year: selectedYear, month: filterAll ? 0 : selectedMonth, branchId: effectiveBranchId },
    { enabled: ["admin", "branch_manager"].includes(user?.role ?? "") }
  );

  const updateSchadenMutation = trpc.admin.updateSchaden.useMutation({
    onSuccess: () => schadenQuery.refetch(),
  });

  const handleExport = useCallback(async () => {
    if (!summaryQuery.data || !monthlyQuery.data) return;
    setIsExporting(true);
    try {
      await exportReportPDF({
        year: selectedYear,
        month: selectedMonth,
        filterAll,
        summary: summaryQuery.data,
        monthly: monthlyQuery.data,
        schaden: schadenQuery.data ?? [],
        beschwerde: beschwerdeQuery.data ?? [],
        monthNames: MONTHS_DE,
      });
    } finally {
      setIsExporting(false);
    }
  }, [summaryQuery.data, monthlyQuery.data, schadenQuery.data, beschwerdeQuery.data, selectedYear, selectedMonth, filterAll]);

  if (!["admin", "branch_manager"].includes(user?.role ?? "")) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              غير مصرح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">هذا القسم متاح فقط للمديرين</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = summaryQuery.data;
  const monthly = monthlyQuery.data ?? [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Verwaltungsberichte</h1>
            <p className="text-sm text-gray-500">Finanzen · Schäden · Beschwerden</p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Branch Selector - للمدير العام فقط */}
            {isAdmin && (
              <Select
                value={selectedBranchId === null ? "all" : String(selectedBranchId)}
                onValueChange={v => setSelectedBranchId(v === "all" ? null : Number(v))}
              >
                <SelectTrigger className="h-9 w-44 border-[#1a4d6d] text-sm font-medium text-[#1a4d6d]">
                  <SelectValue placeholder="Alle Filialen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏢 Alle Filialen</SelectItem>
                  {(branchesQuery.data ?? []).map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      📍 {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-28 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAll ? "0" : String(selectedMonth)} onValueChange={v => {
              if (v === "0") { setFilterAll(true); }
              else { setFilterAll(false); setSelectedMonth(Number(v)); }
            }}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Ganzes Jahr</SelectItem>
                {MONTHS_DE.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              onClick={() => { summaryQuery.refetch(); monthlyQuery.refetch(); schadenQuery.refetch(); beschwerdeQuery.refetch(); }}
              className="h-9"
            >
              Aktualisieren
            </Button>

            <Button
              size="sm"
              onClick={handleExport}
              disabled={isExporting || !summaryQuery.data}
              className="h-9 gap-1.5 bg-[#1a4d6d] text-white hover:bg-[#14394f]"
            >
              {isExporting ? (
                <><Loader2 size={14} className="animate-spin" /> Exportieren...</>
              ) : (
                <><Download size={14} /> Bericht exportieren</>
              )}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        {summaryQuery.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 h-24" />
              </Card>
            ))}
          </div>
        ) : s ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Gesamtumsatz (Brutto)" value={fmt(s.totalRevenue)} sub={`${s.totalMoves} Aufträge gesamt`} icon={Euro} color="bg-[#1a4d6d]" />
            <KpiCard title="Davon bezahlt" value={fmt(s.paidRevenue ?? 0)} sub={`${s.paidMoves} bezahlte Aufträge`} icon={CheckCircle} color="bg-green-600" />
            <KpiCard title="Gesamtaufträge" value={String(s.totalMoves)} sub={`${s.completedMoves} abgeschlossen`} icon={Package} color="bg-[#1a4d6d]" />
            <KpiCard title="Offene Zahlungen" value={String(s.unpaidMoves)} sub={`Aufträge unbezahlt`} icon={XCircle} color="bg-amber-500" />
            <KpiCard title="Schadensfälle" value={String(s.schadenCount)} sub={s.schadenKosten > 0 ? `Kosten: ${fmt(s.schadenKosten)}` : "Keine Kosten erfasst"} icon={AlertTriangle} color="bg-red-500" />
            <KpiCard title="Schadenskosten" value={fmt(s.schadenKosten)} sub="Entschädigungen gezahlt" icon={Euro} color="bg-red-400" />
            <KpiCard title="Beschwerden" value={String(s.beschwerdeCount)} sub="Kundenbeschwerden" icon={MessageSquare} color="bg-orange-500" />
            <KpiCard title="Abgeschlossen" value={String(s.completedMoves)} sub={`von ${s.totalMoves} Aufträgen`} icon={CheckCircle} color="bg-[#d97e3a]" />
          </div>
        ) : null}

        {/* Tabs */}
        <Tabs defaultValue="revenue" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="revenue" className="flex items-center gap-1.5">
              <BarChart2 size={14} /> Umsatz
            </TabsTrigger>
            <TabsTrigger value="schaden" className="flex items-center gap-1.5">
              <AlertTriangle size={14} /> Schäden
              {s && s.schadenCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{s.schadenCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="beschwerde" className="flex items-center gap-1.5">
              <MessageSquare size={14} /> Beschwerden
              {s && s.beschwerdeCount > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{s.beschwerdeCount}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Revenue Tab ── */}
          <TabsContent value="revenue">
            <div className="space-y-4">
              {/* Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monatlicher Umsatz {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyQuery.isLoading ? (
                    <div className="h-40 animate-pulse bg-gray-100 rounded" />
                  ) : (
                    <>
                      <RevenueBar data={monthly} />
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-[#1a4d6d]" /> Umsatz</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Schäden</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Jahresübersicht {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Monat</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Aufträge</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Umsatz (bezahlt)</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Schadenskosten</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Nettoumsatz</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Beschwerden</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyQuery.isLoading ? (
                          <tr><td colSpan={6} className="text-center py-8 text-gray-400">Laden...</td></tr>
                        ) : monthly.every(m => m.totalMoves === 0) ? (
                          <tr><td colSpan={6} className="text-center py-8 text-gray-400">Keine Daten für {selectedYear}</td></tr>
                        ) : monthly.filter(m => m.totalMoves > 0).map(m => (
                          <tr key={m.month} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-700">{m.monthName}</td>
                            <td className="px-4 py-3 text-gray-600">{m.totalMoves} <span className="text-xs text-gray-400">({m.paidMoves} bez.)</span></td>
                            <td className="px-4 py-3 font-semibold text-[#1a4d6d]">{fmt(m.totalRevenue)}</td>
                            <td className="px-4 py-3 text-red-600">{m.schadenKosten > 0 ? fmt(m.schadenKosten) : "—"}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600">{fmt(m.netRevenue)}</td>
                            <td className="px-4 py-3 text-orange-600">{m.beschwerdeCount > 0 ? m.beschwerdeCount : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      {monthly.some(m => m.totalMoves > 0) && (
                        <tfoot className="bg-gray-50 border-t-2">
                          <tr>
                            <td className="px-4 py-3 font-bold text-gray-700">Gesamt</td>
                            <td className="px-4 py-3 font-bold">{monthly.reduce((a, m) => a + m.totalMoves, 0)}</td>
                            <td className="px-4 py-3 font-bold text-[#1a4d6d]">{fmt(monthly.reduce((a, m) => a + m.totalRevenue, 0))}</td>
                            <td className="px-4 py-3 font-bold text-red-600">{fmt(monthly.reduce((a, m) => a + m.schadenKosten, 0))}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600">{fmt(monthly.reduce((a, m) => a + m.netRevenue, 0))}</td>
                            <td className="px-4 py-3 font-bold text-orange-600">{monthly.reduce((a, m) => a + m.beschwerdeCount, 0) || "—"}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Schaden Tab ── */}
          <TabsContent value="schaden">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  Schadensfälle
                  <span className="text-sm font-normal text-gray-500">
                    — {filterAll ? `Jahr ${selectedYear}` : MONTHS_DE[selectedMonth - 1] + " " + selectedYear}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {schadenQuery.isLoading ? (
                  <div className="p-8 text-center text-gray-400">Laden...</div>
                ) : !schadenQuery.data?.length ? (
                  <div className="p-10 text-center text-gray-500 space-y-4">
                    <AlertTriangle size={32} className="mx-auto mb-2 text-gray-300" />
                    <div>
                      <p className="font-medium text-gray-700">Keine Schadensfälle im gewählten Zeitraum</p>
                      <p className="text-sm text-gray-500 mt-1">بمجرد تسجيل ضرر داخل الطلب سيظهر هنا تلقائيًا مع الحالة والتكلفة.</p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Button variant="outline" onClick={() => navigate('/orders')} className="border-[#1a4d6d] text-[#1a4d6d] hover:bg-[#eaf2f7]">
                        Zu den Aufträgen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Auftrag</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Kunde</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Beschreibung</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Status</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Kosten (€)</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Fotos</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Datum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schadenQuery.data.map(row => {
                          const imgs = (() => { try { return JSON.parse(row.schadenImages ?? "[]"); } catch { return []; } })();
                          return (
                            <tr key={row.id} className="border-b hover:bg-red-50/30">
                              <td className="px-4 py-3 font-semibold text-[#1a4d6d]">{row.kundenummer || row.moveCode}</td>
                              <td className="px-4 py-3 text-gray-700">{row.customerName}</td>
                              <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                                <span className="block truncate" title={row.schadenDescription ?? ""}>{row.schadenDescription}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                  row.schadenStatus === "Behoben" ? "bg-[#fff2e8] text-[#8f4f1f] border-[#e7b18a]" :
                                  row.schadenStatus === "In Bearbeitung" ? "bg-[#eaf2f7] text-[#1a4d6d] border-[#9fc0d2]" :
                                  "bg-[#fff2e8] text-[#8f4f1f] border-[#e7b18a]"
                                }`}>
                                  {row.schadenStatus ?? "Gemeldet"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <SchadenKostenCell
                                  moveId={row.id}
                                  kosten={row.schadenKosten}
                                  status={row.schadenStatus}
                                  readOnly={user?.role === "branch_manager"}
                                  onSave={(moveId, kosten, status) => updateSchadenMutation.mutate({ moveId, schadenKosten: kosten, schadenStatus: status })}
                                />
                              </td>
                              <td className="px-4 py-3">
                                {imgs.length > 0 ? (
                                  <div className="flex gap-1">
                                    {imgs.slice(0, 2).map((url: string, i: number) => (
                                      <a key={i} href={url} target="_blank" rel="noreferrer">
                                        <img src={url} alt="" className="w-8 h-8 object-cover rounded border hover:scale-110 transition-transform" />
                                      </a>
                                    ))}
                                    {imgs.length > 2 && <span className="text-xs text-gray-400 self-center">+{imgs.length - 2}</span>}
                                  </div>
                                ) : <span className="text-gray-300 text-xs flex items-center gap-1"><Image size={12} /> —</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                {new Date(row.createdAt).toLocaleDateString("de-DE")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 font-bold text-gray-700">Gesamt Schadenskosten</td>
                          <td className="px-4 py-3 font-bold text-red-600">
                            {fmt(schadenQuery.data.reduce((a, r) => a + (r.schadenKosten ?? 0), 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Beschwerde Tab ── */}
          <TabsContent value="beschwerde">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare size={16} className="text-orange-500" />
                  Kundenbeschwerden
                  <span className="text-sm font-normal text-gray-500">
                    — {filterAll ? `Jahr ${selectedYear}` : MONTHS_DE[selectedMonth - 1] + " " + selectedYear}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {beschwerdeQuery.isLoading ? (
                  <div className="p-8 text-center text-gray-400">Laden...</div>
                ) : !beschwerdeQuery.data?.length ? (
                  <div className="p-10 text-center text-gray-500 space-y-4">
                    <MessageSquare size={32} className="mx-auto mb-2 text-gray-300" />
                    <div>
                      <p className="font-medium text-gray-700">Keine Beschwerden im gewählten Zeitraum</p>
                      <p className="text-sm text-gray-500 mt-1">عند إدخال شكوى ضمن تفاصيل الطلب ستظهر هنا مباشرة مع الشدة والمرفقات.</p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Button variant="outline" onClick={() => navigate('/orders')} className="border-[#d97e3a] text-[#8f4f1f] hover:bg-[#fff2e8]">
                        Beschwerden über Aufträge pflegen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Auftrag</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Kunde</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Beschreibung</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Schweregrad</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Fotos</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Datum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beschwerdeQuery.data.map(row => {
                          const imgs = (() => { try { return JSON.parse(row.beschwerdeImages ?? "[]"); } catch { return []; } })();
                          return (
                            <tr key={row.id} className="border-b hover:bg-orange-50/30">
                              <td className="px-4 py-3 font-semibold text-[#1a4d6d]">{row.kundenummer || row.moveCode}</td>
                              <td className="px-4 py-3 text-gray-700">{row.customerName}</td>
                              <td className="px-4 py-3 text-gray-600 max-w-[220px]">
                                <span className="block truncate" title={row.beschwerdeDescription ?? ""}>{row.beschwerdeDescription}</span>
                              </td>
                              <td className="px-4 py-3">
                                <SeverityBadge severity={row.beschwerdeSchweregard} />
                              </td>
                              <td className="px-4 py-3">
                                {imgs.length > 0 ? (
                                  <div className="flex gap-1">
                                    {imgs.slice(0, 2).map((url: string, i: number) => (
                                      <a key={i} href={url} target="_blank" rel="noreferrer">
                                        <img src={url} alt="" className="w-8 h-8 object-cover rounded border hover:scale-110 transition-transform" />
                                      </a>
                                    ))}
                                    {imgs.length > 2 && <span className="text-xs text-gray-400 self-center">+{imgs.length - 2}</span>}
                                  </div>
                                ) : <span className="text-gray-300 text-xs flex items-center gap-1"><Image size={12} /> —</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                {new Date(row.createdAt).toLocaleDateString("de-DE")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Inline editable Schaden cost cell ────────────────────────────────────────
function SchadenKostenCell({
  moveId, kosten, status, onSave, readOnly = false,
}: {
  moveId: number;
  kosten: number | null;
  status: string | null;
  onSave: (moveId: number, kosten: number, status: string) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(kosten ?? ""));
  const [st, setSt] = useState(status ?? "Gemeldet");

  // In read-only mode, just render the value without making it clickable.
  if (readOnly) {
    return (
      <span className="text-red-600 font-semibold">
        {kosten != null ? fmt(kosten) : <span className="text-gray-300 font-normal">—</span>}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left hover:underline text-red-600 font-semibold"
        title="Klicken zum Bearbeiten"
      >
        {kosten != null ? fmt(kosten) : <span className="text-gray-300 font-normal">— erfassen</span>}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <input
        type="number"
        className="border rounded px-2 py-1 text-xs w-full"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Betrag €"
        autoFocus
      />
      <select
        className="border rounded px-2 py-1 text-xs w-full"
        value={st}
        onChange={e => setSt(e.target.value)}
      >
        <option value="Gemeldet">Gemeldet</option>
        <option value="In Bearbeitung">In Bearbeitung</option>
        <option value="Behoben">Behoben</option>
        <option value="Entschädigt">Entschädigt</option>
      </select>
      <div className="flex gap-1">
        <button
          onClick={() => { onSave(moveId, parseFloat(val) || 0, st); setEditing(false); }}
          className="flex-1 rounded bg-[#1a4d6d] px-2 py-1 text-xs text-white hover:bg-[#14394f]"
        >
          ✓
        </button>
        <button
          onClick={() => setEditing(false)}
          className="flex-1 bg-gray-100 text-gray-600 text-xs rounded px-2 py-1 hover:bg-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
