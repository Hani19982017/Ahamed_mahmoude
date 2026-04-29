import { useState } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

/**
 * Erinnerungen & Kontaktstatus page.
 *
 * Shows a compact list of customers that need to be followed up on
 * (called / messaged via WhatsApp). Each row is colour-coded:
 *  - 🟢 green  : ≥ 48 h since last update — time to reach out again
 *  - 🟡 yellow : < 48 h, still too early
 *
 * The list does NOT contain full customer data — only name, kundennummer
 * and current Versuch attempt. A trash icon lets the user permanently
 * remove a reminder when work with the customer is complete.
 *
 * Permissions:
 *  - admin → sees reminders from all branches
 *  - sales → sees only their own branch's reminders
 *  - everyone else → blocked at the API layer (we still render a
 *    friendly message so they know what's happening)
 */

interface ReminderRow {
  id: number;
  customerId: number;
  branchId: number;
  customerName: string;
  kundennummer: string;
  versuch: string | null;
  lastUpdatedAt: string | Date;
  createdAt: string | Date;
  colorState: "green" | "yellow";
  hoursSinceUpdate: number;
}

function formatHoursAgo(hours: number): string {
  if (hours < 1) return "vor wenigen Minuten";
  if (hours < 24) return `vor ${hours} Stunde${hours === 1 ? "" : "n"}`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days === 1 ? "" : "en"}`;
}

function ColorDot({ state }: { state: "green" | "yellow" }) {
  const color = state === "green" ? "bg-emerald-500" : "bg-amber-400";
  const ring = state === "green" ? "ring-emerald-200" : "ring-amber-200";
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${color} ring-4 ${ring}`}
      aria-label={state === "green" ? "Bereit zum Kontaktieren" : "Noch zu früh"}
    />
  );
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  bg,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: React.ElementType;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
          </div>
          <div className={`p-2 rounded-lg ${bg}`}>
            <Icon size={20} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reminders() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const allowed = role === "admin" || role === "sales";

  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ReminderRow | null>(null);

  const utils = trpc.useUtils();
  const remindersQuery = trpc.reminders.list.useQuery(undefined, {
    enabled: allowed,
    refetchInterval: 60_000, // refresh once per minute so colors flip live
  });

  const deleteMutation = trpc.reminders.delete.useMutation({
    onSuccess: () => {
      toast.success("Erinnerung gelöscht.");
      utils.reminders.list.invalidate();
      setConfirmDelete(null);
    },
    onError: err => {
      toast.error(err.message || "Löschen fehlgeschlagen.");
    },
  });

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle size={20} />
              Keine Berechtigung
            </CardTitle>
            <CardDescription>
              Diese Seite ist nur für Admin- und Vertriebsbenutzer verfügbar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="gap-2"
            >
              <ArrowLeft size={16} />
              Zurück zur Startseite
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allRows: ReminderRow[] = (remindersQuery.data ?? []) as ReminderRow[];

  const filtered = allRows.filter(r => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.kundennummer.toLowerCase().includes(q) ||
      (r.versuch ?? "").toLowerCase().includes(q)
    );
  });

  const greenCount = allRows.filter(r => r.colorState === "green").length;
  const yellowCount = allRows.filter(r => r.colorState === "yellow").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="gap-2"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Zurück</span>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-[#1a4d6d] flex items-center gap-2">
                <Bell size={20} className="text-[#d97e3a]" />
                Erinnerungen & Kontaktstatus
              </h1>
              <p className="text-xs text-gray-500">
                Liste der Kunden, die nachverfolgt werden müssen
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => remindersQuery.refetch()}
            disabled={remindersQuery.isFetching}
            className="gap-2"
          >
            <RefreshCw
              size={14}
              className={remindersQuery.isFetching ? "animate-spin" : ""}
            />
            Aktualisieren
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Gesamt"
            value={allRows.length}
            hint="alle Erinnerungen"
            icon={Bell}
            bg="bg-[#1a4d6d]"
          />
          <StatCard
            title="Bereit"
            value={greenCount}
            hint="≥ 48 h — jetzt kontaktieren"
            icon={CheckCircle2}
            bg="bg-emerald-500"
          />
          <StatCard
            title="Wartend"
            value={yellowCount}
            hint="< 48 h — noch zu früh"
            icon={Clock}
            bg="bg-amber-400"
          />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Suche nach Name, Kundennummer, Versuch …"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Kundenliste{" "}
              <span className="text-sm font-normal text-gray-500">
                ({filtered.length} {filtered.length === 1 ? "Eintrag" : "Einträge"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {remindersQuery.isLoading ? (
              <p className="text-center py-12 text-gray-500">
                Erinnerungen werden geladen …
              </p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Bell size={32} className="mx-auto text-gray-300" />
                <p className="text-gray-500">
                  {allRows.length === 0
                    ? "Noch keine Erinnerungen vorhanden."
                    : "Keine Treffer für die aktuelle Suche."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 w-10"></th>
                      <th className="text-left p-3">Name</th>
                      <th className="text-left p-3">Kundennummer</th>
                      <th className="text-left p-3">Versuch</th>
                      <th className="text-left p-3">Letzte Aktualisierung</th>
                      <th className="text-right p-3 w-20">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr
                        key={r.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-3">
                          <ColorDot state={r.colorState} />
                        </td>
                        <td className="p-3 font-medium text-gray-900">
                          {r.customerName}
                        </td>
                        <td className="p-3 font-mono text-gray-700">
                          {r.kundennummer}
                        </td>
                        <td className="p-3">
                          {r.versuch ? (
                            <span className="inline-flex items-center rounded-full border border-[#1a4d6d]/20 bg-[#eaf2f7] px-2 py-0.5 text-xs font-medium text-[#1a4d6d]">
                              {r.versuch}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-gray-600">
                          {formatHoursAgo(r.hoursSinceUpdate)}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(r)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <ColorDot state="green" />
            <span>Mehr als 2 Tage seit der letzten Aktualisierung</span>
          </div>
          <div className="flex items-center gap-2">
            <ColorDot state="yellow" />
            <span>Noch zu früh für eine erneute Kontaktaufnahme</span>
          </div>
        </div>
      </main>

      {/* Delete confirmation */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={open => !open && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erinnerung löschen?</DialogTitle>
            <DialogDescription>
              {confirmDelete && (
                <>
                  Erinnerung für <strong>{confirmDelete.customerName}</strong>{" "}
                  ({confirmDelete.kundennummer}) wird permanent entfernt. Diese
                  Aktion kann nicht rückgängig gemacht werden.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmDelete &&
                deleteMutation.mutate({ id: confirmDelete.id })
              }
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              <Trash2 size={16} />
              {deleteMutation.isPending ? "Löschen …" : "Endgültig löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
