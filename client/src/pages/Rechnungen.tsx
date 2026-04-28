import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, FileText, CheckCircle, XCircle, Euro, Building2 } from "lucide-react";

export default function Rechnungen() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [isPaidFilter, setIsPaidFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  // جلب الفروع (للمدير فقط)
  const branchesQuery = trpc.branches.list.useQuery(undefined, {
    enabled: !!user && user.role === 'admin',
  });
  const branches = branchesQuery.data ?? [];

  // جلب الإحصائيات
  const { data: stats, isLoading: statsLoading } = trpc.invoices.getStats.useQuery(
    user?.role === 'admin' ? { branchId: selectedBranchId } : undefined
  );

  // جلب قائمة الفواتير
  const { data: invoicesList, isLoading: listLoading, refetch } = trpc.invoices.getAll.useQuery({
    search,
    isPaid: isPaidFilter,
    limit: 100,
    ...(user?.role === 'admin' ? { branchId: selectedBranchId } : {}),
  });

  // إعادة توليد PDF
  const regenerateMutation = trpc.invoices.regenerate.useMutation({
    onSuccess: (data) => {
      const linkSource = `data:application/pdf;base64,${data.base64}`;
      const downloadLink = document.createElement("a");
      downloadLink.href = linkSource;
      downloadLink.download = data.filename;
      downloadLink.click();
    },
    onError: (error) => {
      alert(`Fehler: ${error.message}`);
    },
  });

  const handleDownload = (moveId: number) => {
    regenerateMutation.mutate({ moveId });
  };

  const formatCurrency = (amount: string | number | null) => {
    if (!amount) return "0,00 €";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(num);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rechnungen</h1>
          <p className="text-muted-foreground">Übersicht aller generierten Rechnungen</p>
        </div>
        {/* Branch Selector للمدير */}
        {user?.role === 'admin' && branches.length > 0 && (
          <Select
            value={selectedBranchId === null ? 'all' : String(selectedBranchId)}
            onValueChange={(v) => setSelectedBranchId(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="w-48 h-9">
              <Building2 size={14} className="mr-1 text-gray-400" />
              <SelectValue placeholder="Alle Filialen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Filialen</SelectItem>
              {branches.map((b: any) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* الإحصائيات */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[#1a4d6d] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{formatCurrency(stats?.totalAmount || 0)}</p>
              </div>
              <FileText className="h-8 w-8 text-[#1a4d6d]" />
            </div>
          </Card>

          <Card className="border-l-4 border-l-green-500 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bezahlt</p>
                <p className="text-2xl font-bold text-green-700">{stats?.paidCount || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{formatCurrency(stats?.paidAmount || 0)}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-l-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unbezahlt</p>
                <p className="text-2xl font-bold text-red-600">{stats?.unpaidCount || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{formatCurrency(stats?.unpaidAmount || 0)}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ausstehend</p>
                <p className="text-2xl font-bold text-amber-600">
                  {((stats?.unpaidCount || 0) / (stats?.total || 1) * 100).toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">der Rechnungen</p>
              </div>
              <Euro className="h-8 w-8 text-amber-500" />
            </div>
          </Card>
        </div>
      )}

      {/* البحث والتصفية */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Rechnungsnummer oder Kundenname..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={isPaidFilter} onValueChange={(v: any) => setIsPaidFilter(v)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="paid">Bezahlt</SelectItem>
              <SelectItem value="unpaid">Unbezahlt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* جدول الفواتير */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-semibold">Rechnungsnr.</th>
                <th className="text-left p-4 font-semibold">Kunde</th>
                <th className="text-left p-4 font-semibold">Betrag</th>
                <th className="text-left p-4 font-semibold">Status</th>
                <th className="text-left p-4 font-semibold">Zahlungsart</th>
                <th className="text-left p-4 font-semibold">Datum</th>
                <th className="text-left p-4 font-semibold">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Lädt...
                  </td>
                </tr>
              ) : !invoicesList || invoicesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Keine Rechnungen gefunden
                  </td>
                </tr>
              ) : (
                invoicesList.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={`border-b hover:bg-muted/30 transition-colors ${
                      invoice.isPaid === 1 ? "bg-green-50/70" : ""
                    }`}
                  >
                    <td className="p-4 font-mono text-sm">{invoice.invoiceNumber}</td>
                    <td className="p-4">{invoice.customerName || "—"}</td>
                    <td className="p-4 font-semibold">{formatCurrency(invoice.amount)}</td>
                    <td className="p-4">
                      {invoice.isPaid === 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          <CheckCircle className="h-3 w-3" />
                          Bezahlt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          <XCircle className="h-3 w-3" />
                          Unbezahlt
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm">{invoice.paymentMethod || "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td className="p-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(invoice.moveId)}
                        disabled={regenerateMutation.isPending}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
