import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Minus, Copy, Check, Upload, X, ImageIcon, Pencil } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { KUNDENNUMMER_PLACEHOLDER, formatCustomerNumber } from "@shared/customerNumber";

// ─── Image Compression Utility ────────────────────────────────────────────────
// يضغط الصورة باستخدام Canvas API قبل الرفع
// الجودة: 0.75 (75%) - جودة مقبولة مع تقليل كبير في الحجم
async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<{ base64: string; name: string; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // حساب الأبعاد الجديدة مع الحفاظ على النسبة
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve({
          base64,
          name: file.name.replace(/\.[^.]+$/, ".jpg"),
          originalSize: file.size,
          compressedSize: Math.round((base64.length * 3) / 4),
        });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function Section({
  title,
  defaultOpen = false,
  teal = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  teal?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left font-semibold text-sm ${
          teal
            ? "bg-[#1a4d6d] text-white hover:bg-[#14394f]"
            : "bg-gray-50 text-gray-800 hover:bg-gray-100"
        }`}
      >
        {open ? <Minus size={14} /> : <Plus size={14} />}
        {title}
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="block mb-1 text-xs text-gray-600">{label}</Label>
      {children}
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      {label && <Label className="block mb-1 text-xs text-gray-600">{label}</Label>}
      <div className="flex gap-4 mt-1">
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="radio" checked={value} onChange={() => onChange(true)} />
          Ja
        </label>
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="radio" checked={!value} onChange={() => onChange(false)} />
          Nein
        </label>
      </div>
    </div>
  );
}

const etageOptions = [
  "Erdgeschoss","1.Etage","2.Etage","3.Etage","4.Etage","5.Etage","6.Etage+",
];
const fahrstuhlOptions = [
  "kein Aufzug vorhanden","Aufzug klein","Aufzug mittel","Aufzug groß",
];
const laufwegOptions = [
  "0 - 10 m","10 - 20 m","20 - 30 m","30 - 40 m","40 - 50 m","50 m+",
];

// ─── Message Item ─────────────────────────────────────────────────────────────
function MessageItem({
  label,
  message,
  copied,
  onCopy,
}: {
  label: string;
  message: string;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(message);

  // تحديث النص عند تغيير البيانات من الفورم
  useEffect(() => {
    if (!editing) setEditedText(message);
  }, [message, editing]);

  return (
    <div className="border border-gray-200 rounded">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100"
      >
        {open ? <Minus size={12} /> : <Plus size={12} />}
        <span className="flex-1">{label}</span>
        {open && (
          <span
            onClick={e => { e.stopPropagation(); setEditing(!editing); }}
            className="flex items-center gap-1 px-2 text-xs text-gray-400 hover:text-[#1a4d6d]"
          >
            {editing ? <><X size={11} /> Schließen</> : <><Pencil size={11} /> Bearbeiten</>}
          </span>
        )}
      </button>
      {open && (
        <div className="p-3">
          {editing ? (
            <>
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                rows={12}
                className="w-full resize-y rounded border border-[#1a4d6d]/25 bg-white p-3 text-xs font-sans leading-relaxed text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1a4d6d]"
                dir="ltr"
              />
              <div className="flex gap-2 mt-2">
                <Button type="button" onClick={() => onCopy(editedText)}
                  className="bg-[#1a4d6d] text-xs text-white hover:bg-[#14394f]" size="sm">
                  {copied ? <><Check size={12} className="mr-1" /> Kopiert!</> : <><Copy size={12} className="mr-1" /> Nachricht kopieren</>}
                </Button>
                <Button type="button" variant="outline" size="sm"
                  className="text-xs" onClick={() => setEditedText(message)}>
                  Zurücksetzen
                </Button>
              </div>
            </>
          ) : (
            <>
              <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 rounded p-3 border font-sans leading-relaxed">
                {editedText}
              </pre>
              <Button type="button" onClick={() => onCopy(editedText)}
                className="mt-2 bg-[#1a4d6d] text-xs text-white hover:bg-[#14394f]" size="sm">
                {copied ? <><Check size={12} className="mr-1" /> Kopiert!</> : <><Copy size={12} className="mr-1" /> Nachricht kopieren</>}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NachverfolgenGroup Component ───────────────────────────────────────────
function NachverfolgenGroup({
  keys,
  labels,
  buildMessage,
  copied,
  setCopied,
}: {
  keys: string[];
  labels: string[];
  buildMessage: (key: string) => string;
  copied: string | null;
  setCopied: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100"
      >
        {open ? <Minus size={12} /> : <Plus size={12} />}
        <span className="flex-1 font-medium">Nachverfolgen</span>
        <span className="text-xs text-gray-400">4 Nachrichten</span>
      </button>
      {open && (
        <div className="p-2 space-y-2">
          {keys.map((key, i) => (
            <MessageItem
              key={key}
              label={labels[i]}
              message={buildMessage(key)}
              copied={copied === key}
              onCopy={(text) => {
                navigator.clipboard.writeText(text);
                setCopied(key);
                setTimeout(() => setCopied(null), 2000);
                toast.success("Nachricht kopiert!");
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NewCustomer() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  const [branches, setBranches] = useState<Array<{id: number; name: string; city: string; isActive: number}>>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  // تحميل الفروع النشطة من قاعدة البيانات
  const { data: branchesData } = trpc.branches.list.useQuery();
  
  useEffect(() => {
    if (branchesData) {
      // تصفية الفروع النشطة فقط
      const activeBranches = branchesData.filter((b: any) => b.isActive === 1);
      setBranches(activeBranches);
      setLoadingBranches(false);
      
      // إذا كان المستخدم مدير فرع، قم بتعيين فرعه تلقائياً
      if (user?.role === 'branch_manager' && user?.branchId) {
        const userBranch = activeBranches.find((b: any) => b.id === user.branchId);
        if (userBranch) {
          setSitz(userBranch.name);
          setSelectedBranchId(userBranch.id);
        }
      } else if (activeBranches.length > 0) {
        setSelectedBranchId((current) => {
          const matchingBranch = current ? activeBranches.find((b: any) => b.id === current) : null;
          const branchToUse = matchingBranch ?? activeBranches[0];
          setSitz(branchToUse.name);
          return branchToUse.id;
        });
      }
    }
  }, [branchesData, user]);

  // ── Kunde ──
  const [anrede, setAnrede] = useState("Herr");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [sitz, setSitz] = useState("");
  const [status, setStatus] = useState("Registriert auf Apex");
  const [versuch, setVersuch] = useState("Versuch 1");
  const [moveType, setMoveType] = useState("Umzug");
  const [mitFotos, setMitFotos] = useState(true);
  const [terminVon, setTerminVon] = useState("");
  const [terminBis, setTerminBis] = useState("");
  const [kundenummer, setKundenummer] = useState("");
  const [savedCustomerId, setSavedCustomerId] = useState<number | null>(null);
  const [savedMoveId, setSavedMoveId] = useState<number | null>(null);
  const [bezahlt, setBezahlt] = useState(false);
  const [callCheck, setCallCheck] = useState("Nein");
  const [shaden, setShaden] = useState("Nein");
  const [angebotPerPost, setAngebotPerPost] = useState(false);
  const [priceBrutto, setPriceBrutto] = useState("");
  const [m3, setM3] = useState("");

  // ── Address ──
  const [distanz, setDistanz] = useState("");
  const [anfahrt, setAnfahrt] = useState("0");
  const [auszugsort, setAuszugsort] = useState("");
  const [auszugEtage, setAuszugEtage] = useState("Erdgeschoss");
  const [auszugFahrstuhl, setAuszugFahrstuhl] = useState("kein Aufzug vorhanden");
  const [auszugLaufweg, setAuszugLaufweg] = useState("10 - 20 m");
  const [einzugsort, setEinzugsort] = useState("");
  const [einzugEtage, setEinzugEtage] = useState("Erdgeschoss");
  const [einzugFahrstuhl, setEinzugFahrstuhl] = useState("kein Aufzug vorhanden");
  const [einzugLaufweg, setEinzugLaufweg] = useState("10 - 20 m");

  // ── Immobilien ──
  const [auszugFlaeche, setAuszugFlaeche] = useState("");
  const [auszugZimmer, setAuszugZimmer] = useState("");
  const [einzugFlaeche, setEinzugFlaeche] = useState("");
  const [einzugZimmer, setEinzugZimmer] = useState("");

  // ── Services Auszug ──
  const [einpackservice, setEinpackservice] = useState(false);
  const [einpackKartons, setEinpackKartons] = useState("0");
  const [abbauMoebeln, setAbbauMoebeln] = useState(false);
  const [abbauMoebelnM3, setAbbauMoebelnM3] = useState("0");
  const [abbauKueche, setAbbauKueche] = useState(false);
  const [abbauKuecheM3, setAbbauKuecheM3] = useState("0");
  const [parkzoneAuszug, setParkzoneAuszug] = useState(true);
  // Services Einzug
  const [auspackservice, setAuspackservice] = useState(false);
  const [auspackKartons, setAuspackKartons] = useState("0");
  const [aufbauMoebeln, setAufbauMoebeln] = useState(false);
  const [aufbauMoebelnM3, setAufbauMoebelnM3] = useState("0");
  const [aufbauKueche, setAufbauKueche] = useState(false);
  const [aufbauKuecheM3, setAufbauKuecheM3] = useState("0");
  const [parkzoneEinzug, setParkzoneEinzug] = useState(true);
  // Kartons
  const [umzugskartons, setUmzugskartons] = useState("0");
  const [kleiderkartons, setKleiderkartons] = useState("0");
  const [kartonDelivery, setKartonDelivery] = useState("");
  const [kartonGeliefert, setKartonGeliefert] = useState("");
  const [parkzoneDatum, setParkzoneDatum] = useState("");
  const [parkzoneGeliefert, setParkzoneGeliefert] = useState("");
  // Additional
  const [klaviertransport, setKlaviertransport] = useState(false);
  const [klavierGross, setKlavierGross] = useState("Nein");
  const [schwerTransport, setSchwerTransport] = useState("Kein");
  const [lampen, setLampen] = useState(false);
  const [lampenOrt, setLampenOrt] = useState("Kein");
  const [lampenStueck, setLampenStueck] = useState("0");
  const [einlagerung, setEinlagerung] = useState(false);
  const [einlagerungPrice, setEinlagerungPrice] = useState("0");
  const [endreinigung, setEndreinigung] = useState(false);
  const [bohrarbeit, setBohrarbeit] = useState(false);
  const [bohrarbeitPunkt, setBohrarbeitPunkt] = useState("0");
  const [entsorgung, setEntsorgung] = useState(false);
  const [entsorgungType, setEntsorgungType] = useState("Normal");
  const [entsorgungM3, setEntsorgungM3] = useState("0");
  const [aussenlift, setAussenlift] = useState("Nein");
  const [aussenliftStunde, setAussenliftStunde] = useState("0");
  const [anschlussWaschmaschine, setAnschlussWaschmaschine] = useState(false);
  const [sonstigeLeistung, setSonstigeLeistung] = useState("");
  const [sonstigePrice, setSonstigePrice] = useState("");

  // ── Note ──
  const [summary, setSummary] = useState("");
  const [anmerkungen, setAnmerkungen] = useState("");
  const [serviceanmerkungen, setServiceanmerkungen] = useState("");
  const [moebelListe, setMoebelListe] = useState("");
  const [kundenNote, setKundenNote] = useState("");
  const [kontaktinfo, setKontaktinfo] = useState("");

  // ── Finanzen ──
  const [anzahlung, setAnzahlung] = useState("");
  const [restbetrag, setRestbetrag] = useState("");
  const [zahlungsart, setZahlungsart] = useState("Überweisung");
  const [rechnungNr, setRechnungNr] = useState("");

  // ── Audits ──
  const [bezahltVon, setBezahltVon] = useState("Kunde");
  const [betzhalKunde, setBetzhalKunde] = useState("");
  const [istBezahlt, setIstBezahlt] = useState(false);
  const [paymentWay, setPaymentWay] = useState("Bank");
  const [auditTotalPrice, setAuditTotalPrice] = useState("");
  const [bezahltDatum, setBezahltDatum] = useState("");
  const [bankBetrag, setBankBetrag] = useState("");
  const [barBetrag, setBarBetrag] = useState("");
  const [rechnungAusgestellt, setRechnungAusgestellt] = useState(false);
  const [rechnungBetrag, setRechnungBetrag] = useState("");
  const [rechnungNummer, setRechnungNummer] = useState("");

  // ── Photos ──
  const [photos, setPhotos] = useState<Array<{
    name: string;
    base64: string;
    preview: string;
    originalSize: number;
    compressedSize: number;
  }>>([]);
  const [compressing, setCompressing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCompressing(true);
    const newPhotos: typeof photos = [];
    let totalSaved = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const result = await compressImage(file);
        newPhotos.push({
          name: result.name,
          base64: result.base64,
          preview: result.base64,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
        });
        totalSaved += result.originalSize - result.compressedSize;
      } catch (err) {
        console.error("Compression error:", err);
        toast.error(`Fehler beim Komprimieren: ${file.name}`);
      }
    }
    setPhotos(prev => [...prev, ...newPhotos]);
    setCompressing(false);
    if (newPhotos.length > 0) {
      const savedKB = Math.round(totalSaved / 1024);
      toast.success(`${newPhotos.length} Foto(s) komprimiert${savedKB > 0 ? ` (${savedKB} KB gespart)` : ""}`);
    }
  }, []);

  const removePhoto = useCallback((idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Build messages ──
  const buildMessage = (type: string) => {
    const n = name || "[Name]";
    const code = kundenummer || KUNDENNUMMER_PLACEHOLDER;
    const date = terminVon || "[Datum]";
    const price = priceBrutto || "[Preis]";
    const vol = m3 || "[m³]";
    const from = auszugsort || "[Auszugsort]";
    const to = einzugsort || "[Einzugsort]";
    const dist = distanz || "[km]";

    const templates: Record<string, string> = {
      willkommen: `Hallo ${anrede} ${n},\n\nvielen Dank für Ihre Anfrage zu Ihrem geplanten Umzug von ${from} nach ${to}.\n\nGerne erstellen wir Ihnen ein verbindliches Festpreisangebot für Ihren Umzug. Unser Ziel ist es, Ihren Umzug transparent, zuverlässig und stressfrei zu planen.\n\nDamit wir Ihr Angebot korrekt kalkulieren und Ihren Wunschtermin vormerken können, benötigen wir noch einige kurze Informationen.\n\nWie möchten Sie die Details Ihres Umzugs klären?\n📞 Telefonische Beratung\nGerne besprechen wir alle Details direkt mit Ihnen. Bitte senden Sie uns hierfür Ihre Rufnummer, damit wir Sie kurzfristig kontaktieren können.\n📹 Online-Besichtigung / Videotermin\nBei einem kurzen Termin können wir Ihr Umzugsgut gemeinsam durchgehen. Bitte senden Sie uns zwei Terminvorschläge sowie Ihre Rufnummer.\n✉️ Schriftliche Abstimmung\nAlternativ senden wir Ihnen gerne eine strukturierte Umzugsliste mit allen Fragen, damit wir Ihr Angebot schnell und präzise erstellen können.\nHinweis: Ihre Kundennummer lautet ${code}. Bitte geben Sie diese Nummer bei Rückfragen oder weiterer Korrespondenz immer an.\n\nWir freuen uns darauf, Sie bei Ihrem Umzug zu unterstützen und stehen Ihnen bei Fragen jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\n\n\nUmzugsberater\n\n📞 WhatsApp: 0234 60142460\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,

      ersteNachricht: `Hallo ${anrede} ${n} ,\n\nVielen Dank für Ihr Interesse an unseren Umzugsdienstleistungen! Wir freuen uns, Sie bei Ihrem Umzug unterstützen zu dürfen und möchten Ihnen ein maßgeschneidertes Angebot erstellen.\n\nDamit wir Ihre Anfrage optimal bearbeiten können, bitten wir Sie, uns noch einige weitere Informationen mitzuteilen:\n\n1️⃣ Eine Liste oder Fotos Ihrer Möbelstücke\n2️⃣ Die Anzahl der Umzugskartons, die Sie packen möchten\n3️⃣ Benötigen Sie Umzugskartons von uns? Falls ja, wie viele?\n4️⃣ Sollen wir Ihre Möbel für Sie ab- und wieder aufbauen?\n5️⃣ Gibt es sperrige oder besonders schwere Möbelstücke, die besondere Aufmerksamkeit erfordern?\n6️⃣ Ihr gewünschtes Umzugsdatum\n7️⃣ Ihre Rufnummer für Rückfragen\n8️⃣ Ihre E-Mail-Adresse für die Angebotserstellung\nSobald wir diese Informationen erhalten haben, erstellen wir Ihnen gerne ein unverbindliches Angebot.\nFalls Sie Fragen haben, stehe ich Ihnen jederzeit gerne zur Verfügung. Ich freue mich auf Ihre Rückmeldung!\n\nHinweis: Ihre Kundennummer lautet ${code}. Bitte nutzen Sie diese Nummer bei Rückfragen oder für weitere Korrespondenz.\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 0234 60142460\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,

      angebotSchicken: `Hallo ${anrede} ${n},\n\nanbei erhalten Sie Ihr individuelles Umzugsangebot mit der Kundennummer (${code}).\n\nZusammenfassung der Angebotsdetails:\n📅 Umzugsdatum: ${date}\n📦 Berechnetes Volumen: ${vol} m³\n💰 Brutto-Preis: ${price} €\n📍 Auszugsort: ${from}\n🏠 Einzugsort: ${to}\n🚛 Distanz: ${dist} km\n🔧 Leistungen: (laut Angebot)\nWarum sollten Sie sich für uns entscheiden?\n✅ Zuverlässigkeit & Erfahrung: Jahrelange Erfahrung im Umzugsbereich – wir wissen, worauf es ankommt!\n✅ Pünktliches Erscheinen: Unsere Teams sind zuverlässig und erscheinen zur vereinbarten Zeit.\n✅ Genügend Einsatzkräfte: Wir stellen sicher, dass ausreichend Personal für einen schnellen und reibungslosen Umzug vorhanden ist.\n✅ Faire Preise: Transparente und wettbewerbsfähige Preise ohne versteckte Kosten.\n✅ Sorgfältiger Umgang mit Ihrem Eigentum: Unsere geschulten Mitarbeiter behandeln Ihr Umzugsgut mit höchster Sorgfalt.\n✅ Flexibilität: Sie können Ihr Umzugsdatum und viele weitere Details später kostenlos anpassen!\n✅ Festpreis-Garantie: Keine versteckten Kosten – Sie zahlen genau den vereinbarten Preis!\n✅ Zufriedenheitsgarantie: Ihre Zufriedenheit steht an erster Stelle – wir arbeiten professionell und zuverlässig, damit Ihr Umzug stressfrei verläuft!\nSo können Sie uns beauftragen:\n✔ Zur Reservierung Ihres Umzugstermins reicht eine schriftliche Bestätigung hier im Chat.\n✔ Später können Sie uns das unterschriebene Angebot zukommen lassen.\n🔹 Zahlungsinformationen:\n💳 Überweisung: (vorab, spätestens 7 Tage vor dem Umzugstag)\n💵 Barzahlung: am Umzugstag (vor der Entladung)\nBitte prüfen Sie das Angebot und geben Sie uns eine Rückmeldung, ob Sie den Umzug mit uns durchführen möchten. Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 0234 60142460\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,

      angebotBestaetigt: `Hallo ${anrede} ${n},\n\nvielen Dank, dass Sie sich für uns entschieden haben! Wir freuen uns, Ihren Umzug durchführen zu dürfen und bestätigen hiermit Ihre Buchung.\n\n📦 Auftragsdetails:\n📅 Umzugsdatum: ${date}\n📍 Auszugsadresse: ${from}\n🏠 Einzugsadresse: ${to}\n⏰ Beginn des Umzugs: Zwischen 08:30 und 09:00 Uhr am Auszugsort\n💰 Gesamtbetrag: ${price} €\n💳 Zahlungsinformationen:\nSie können die Zahlung wie folgt vornehmen:\n\n💵 Barzahlung: am Umzugstag vor der Entladung.\n🏦 Banküberweisung: mindestens 7 Tage vor dem Umzug auf folgendes Konto:\nEmpfänger: Fadel Almohammad\nBankinstitut: Sparkasse Frankfurt\nIBAN: DE63 5019 0000 6000 4589 60\nVerwendungszweck: (Ihre Kundennummer ${code})\n\n🔔 Zusätzlicher Service: Planen Sie, Ihre alte Wohnung zu vermieten oder zu verkaufen? Wir unterstützen Sie gerne dabei, einen passenden Mieter oder Käufer gemäß Ihren individuellen Anforderungen zu finden.\nWenn Sie unsere zusätzlichen Dienstleistungen in Anspruch nehmen, gewähren wir Ihnen einen Rabatt von 10 % auf Ihre Umzugskosten – teilen Sie uns einfach mit, wenn Sie Interesse an diesem Service haben.\n\nWir freuen uns auf eine erfolgreiche Zusammenarbeit und einen reibungslosen Umzug!\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 0234 60142460\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,

      absage: `Hallo ${anrede} ${n},\n\nvielen Dank für Ihre Rückmeldung zu unserem Angebot. Wir bedauern es natürlich, dass Sie sich aktuell gegen eine Zusammenarbeit mit uns entschieden haben.\n\nGleichzeitig möchten wir betonen, dass uns Ihr Auftrag sehr am Herzen liegt und wir weiterhin überzeugt sind, Ihnen die beste Lösung bieten zu können – sowohl in Qualität als auch in Konditionen.\n\nFalls es an preislichen Aspekten liegt, sind wir gerne bereit, Ihnen entgegenzukommen und eine attraktive Ermäßigung anzubieten.\n\nLassen Sie uns gerne noch einmal ins Gespräch kommen, um gemeinsam eine Lösung zu finden, die Ihren Erwartungen bestmöglich entspricht. Wir freuen uns, von Ihnen zu hören!\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 0234 60142460\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,

      nachverfolgen1: `Hallo ${anrede} ${n},\nich hoffe, Sie konnten unser Angebot mit der Kundennummer ${code} inzwischen in Ruhe prüfen.\nGibt es Punkte, die wir für Sie erläutern oder anpassen dürfen? Gerne unterstütze ich Sie dabei, die für Sie passende Lösung zu finden.\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 015560030641\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,
      nachverfolgen2: `Hallo ${anrede} ${n},\nunser Ziel ist es, dass unser Angebot mit der Kundennummer ${code} exakt Ihren Vorstellungen entspricht.\nFalls Sie Änderungen wünschen oder zusätzliche Leistungen aufnehmen möchten, lassen Sie es mich bitte wissen – ich setze dies gerne für Sie um.\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 015560030641\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,
      nachverfolgen3: `Hallo ${anrede} ${n},\nda ich bislang noch keine Rückmeldung von Ihnen erhalten habe, möchte ich freundlich nachfragen, ob weiterhin Interesse an unserem Angebot mit der Kundennummer ${code} besteht.\nWir stehen bereit, Ihren Umzug zuverlässig und professionell umzusetzen.\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 015560030641\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,
      nachverfolgen4: `Hallo ${anrede} ${n},\ndies ist meine abschließende Nachfrage zu unserem Angebot mit der Kundennummer ${code}.\nSollten Sie sich bereits entschieden haben, wäre ich Ihnen für eine kurze Rückmeldung sehr dankbar.\nNatürlich stehe ich Ihnen weiterhin jederzeit gerne zur Verfügung, falls Sie unser Angebot doch noch in Anspruch nehmen möchten.\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 015560030641\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,

      rechnungDaten: `Ange Number\t${code}\nTermin\t${date}\nPrice\t${price}\nServices List\tUmzug Volumen von (${vol} m³) Von: ${from} Nach: ${to} • Umzugsversicherung • Ab/Anfahrt • Be- und Entladung • Bereitstellung von Luftpolsterfolie und Umzugsfolienrollen • Einrichtung eine Parkzone am Auszugsort • Aufbau von Möbeln • Einrichtung einer Parkzone am Einzugsort • Bereitstellung von Umzugskartons (x40)`,

      angepassteAngebot: `Hallo ${anrede} ${n},\n\nanbei erhalten Sie das angepasste Angebot mit der Kundennummer ${code} für Ihren Umzug im PDF-Format.\n\nWir haben die Änderungen gemäß Ihrer Rückmeldung berücksichtigt, um das Angebot optimal auf Ihre Wünsche und Anforderungen abzustimmen.\n\nBitte prüfen Sie das Dokument in Ruhe. Falls noch Fragen bestehen oder weitere Anpassungen gewünscht sind, stehe ich Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nFür Rückfragen geben Sie bitte wie gewohnt die Kundennummer ${code} an, damit wir schnell auf Ihr Anliegen reagieren können.\n\nWir freuen uns darauf, Sie bei Ihrem Umzug bestmöglich zu unterstützen.\n\nMit freundlichen Grüßen,\n\n\nUmzugsberater\n\n📞 WhatsApp: 015560030641\n✉️ E-Mail: info@frankfurtcheckumzug.de\n🌍 Web: www.checkumzug.de\n📠 Fax: 02343 6714070`,
    };
    return templates[type] || "";
  };

  const copyMessage = (type: string) => {
    navigator.clipboard.writeText(buildMessage(type));
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Nachricht kopiert!");
  };

  // ── tRPC mutation ──
  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: (result) => {
      setKundenummer(result.kundenummer);
      setSavedCustomerId(result.customerId);
      setSavedMoveId(result.moveId);
      toast.success(`Kunde erfolgreich gespeichert! Kundennummer: ${result.kundenummer}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const generateOffer = trpc.customers.generateOfferPdf.useMutation({
    onSuccess: (result) => {
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
    },
    onError: (err) => toast.error(err.message),
  });

  const canGenerateOffer = !!savedCustomerId && !!savedMoveId;

  const handleGenerateOffer = () => {
    if (!canGenerateOffer) {
      toast.error("Bitte speichern Sie den Kunden zuerst, bevor Sie das Umzug Angebot erstellen.");
      return;
    }

    generateOffer.mutate({
      customerId: savedCustomerId,
      moveId: savedMoveId,
    });
  };

  const handleSubmit = () => {
    if (createCustomer.isPending) return;
    if (savedCustomerId) {
      toast.info("Der Kunde wurde bereits gespeichert. Sie können jetzt das Umzug Angebot herunterladen.");
      return;
    }

    const branchId = selectedBranchId ?? user?.branchId ?? null;
    const branchName = branches.find((b) => b.id === branchId)?.name ?? sitz;

    createCustomer.mutate({
      branchId,
      title: anrede,
      firstName: name.split(" ")[0] || name || "Unbekannt",
      lastName: name.split(" ").slice(1).join(" ") || "-",
      email: email || undefined,
      phone: phone || undefined,

      moveCode: kundenummer || undefined,
      pickupAddress: auszugsort || "-",
      pickupFloor: auszugEtage || undefined,
      pickupElevatorCapacity: auszugFahrstuhl || undefined,
      pickupParkingDistance: auszugLaufweg || undefined,
      deliveryAddress: einzugsort || "-",
      deliveryFloor: einzugEtage || undefined,
      deliveryElevatorCapacity: einzugFahrstuhl || undefined,
      deliveryParkingDistance: einzugLaufweg || undefined,
      pickupDate: terminVon || new Date().toISOString().split("T")[0],
      deliveryDate: terminBis || terminVon || new Date().toISOString().split("T")[0],
      volume: m3 ? parseFloat(m3) : undefined,
      grossPrice: priceBrutto ? parseFloat(priceBrutto) : undefined,
      distance: distanz ? parseFloat(distanz) : undefined,
      moveType: moveType || undefined,
      services: [summary, anmerkungen, serviceanmerkungen].filter(Boolean).join("\n---\n") || undefined,
      servicesJson: JSON.stringify({
        // Auszugsort
        auszugsortEmpfangsservice: einpackservice,
        auszugsortEmpfangsserviceKartons: einpackKartons,
        auszugsortAbbauMoebel: abbauMoebeln,
        auszugsortAbbauMoebelM3: abbauMoebelnM3,
        auszugsortAbbauKueche: abbauKueche,
        auszugsortAbbauKuecheM3: abbauKuecheM3,
        auszugsortParkzone: parkzoneAuszug,
        auszugsortKartons: einpackKartons,
        // Einzugsort
        einzugsortAuspacksservice: auspackservice,
        einzugsortAuspacksserviceKartons: auspackKartons,
        einzugsortAufbauMoebel: aufbauMoebeln,
        einzugsortAufbauMoebelM3: aufbauMoebelnM3,
        einzugsortAufbauKueche: aufbauKueche,
        einzugsortAufbauKuecheM3: aufbauKuecheM3,
        einzugsortParkzone: parkzoneEinzug,
        einzugsortKartons: auspackKartons,
        // Kartons
        umzugskartons,
        kleiderkartons,
        deliveryDate: kartonDelivery,
        kartonGeliefert,
        datumParkzone: parkzoneDatum,
        parkzoneGeliefert,
        // Additional Services
        klaviertransport,
        klavierGross,
        schwerTransport,
        lampen,
        lampenOrt,
        lampenStueck,
        einlagerungMoebel: einlagerung,
        einlagerungPrice,
        endreinigung,
        bohrDuebel: bohrarbeit,
        bohrPunkt: bohrarbeitPunkt,
        entsorgungMoebel: entsorgung,
        entsorgungType,
        entsorgungM3,
        ausmist: aussenlift,
        ausmistStunde: aussenliftStunde,
        anschlussWaschmaschine,
        sonstigeLeistung,
        sonstigeLeistungPrice: sonstigePrice,
      }),
      // Audits
      bezahltVon,
      betzhalKunde: betzhalKunde || undefined,
      istBezahlt,
      paymentWay,
      auditTotalPrice: auditTotalPrice ? parseFloat(auditTotalPrice) : undefined,
      bezahltDatum: bezahltDatum || undefined,
      bankBetrag: bankBetrag ? parseFloat(bankBetrag) : undefined,
      barBetrag: barBetrag ? parseFloat(barBetrag) : undefined,
      rechnungAusgestellt,
      rechnungBetrag: rechnungBetrag ? parseFloat(rechnungBetrag) : undefined,
      rechnungNummer: rechnungNummer || undefined,
      images: photos.map(p => ({ name: p.name, data: p.base64 })),
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Zurück
          </button>
          <h1 className="text-lg font-bold text-gray-800">Neuer Kunde</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateOffer}
            disabled={createCustomer.isPending || generateOffer.isPending}
            className="border-[#d97706] text-[#d97706] hover:bg-[#fff7ed]"
          >
            {generateOffer.isPending ? "PDF wird erstellt..." : "Umzug Angebot"}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createCustomer.isPending || !!savedCustomerId}
            className="bg-[#1a4d6d] text-white hover:bg-[#14394f] disabled:opacity-100"
          >
            {savedCustomerId ? "Gespeichert" : createCustomer.isPending ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4">

        {/* ── 1. KUNDE ── */}
        <Section title="Kunde" defaultOpen teal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Anrede">
              <select className="w-full border rounded px-3 py-2 text-sm" value={anrede} onChange={(e) => setAnrede(e.target.value)}>
                <option>Herr</option><option>Frau</option><option>Firma</option>
              </select>
            </Field>

            <YesNo label="mit Fotos oder umzugsliste" value={mitFotos} onChange={setMitFotos} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" /></Field>

            <Field label="Umzug Termin Von"><Input type="date" value={terminVon} onChange={(e) => setTerminVon(e.target.value)} placeholder="Von Datum" /></Field>

            <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0175 0000000" /></Field>
            <Field label="Filiale">
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={selectedBranchId ?? ""}
                onChange={(e) => {
                  const nextBranchId = Number(e.target.value);
                  const nextBranch = branches.find((branch) => branch.id === nextBranchId);
                  setSelectedBranchId(Number.isNaN(nextBranchId) ? null : nextBranchId);
                  setSitz(nextBranch?.name ?? "");
                }}
                disabled={loadingBranches || (user?.role === 'branch_manager')}
              >
                {loadingBranches ? (
                  <option value="">جاري التحميل...</option>
                ) : branches.length === 0 ? (
                  <option value="">لا توجد فروع نشطة</option>
                ) : (
                  branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))
                )}
              </select>
            </Field>
            <Field label="Umzug Termin Bis"><Input type="date" value={terminBis} onChange={(e) => setTerminBis(e.target.value)} placeholder="Bis Datum" /></Field>

            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" /></Field>
            <Field label="Status">
              <select className="w-full border rounded px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option>Registriert auf Apex</option><option>Angebot gesendet</option>
                <option>Bestätigt</option><option>Abgesagt</option><option>Abgeschlossen</option>
              </select>
            </Field>
            <Field label="Kundennummer"><Input value={kundenummer} readOnly placeholder={KUNDENNUMMER_PLACEHOLDER} /></Field>

            <Field label="Price Brutto (€)"><Input type="number" value={priceBrutto} onChange={(e) => setPriceBrutto(e.target.value)} placeholder="0" /></Field>
            <Field label="Versuch">
              <select className="w-full border rounded px-3 py-2 text-sm" value={versuch} onChange={(e) => setVersuch(e.target.value)}>
                <option>Versuch 1</option><option>Versuch 2</option><option>Versuch 3</option>
                <option>Versuch 4</option><option>Versuch 5</option><option>Versuch 6</option>
              </select>
            </Field>
            {/* Bezahlt field with color and pulse effect - synced with Audits */}
            <div className={`col-span-1 rounded-lg border-2 p-3 transition-all duration-500 ${
              bezahlt
                ? 'border-green-400 bg-green-50 shadow-green-100 shadow-md'
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Bezahlt</span>
                {bezahlt && (
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                  </span>
                )}
                <div className="flex items-center gap-3 ml-2">
                  <label className={`flex items-center gap-1 cursor-pointer text-sm font-medium ${
                    bezahlt ? 'text-green-700' : 'text-gray-500'
                  }`}>
                    <input
                      type="radio"
                      name="bezahlt-new"
                      checked={bezahlt === true}
                      onChange={() => { setBezahlt(true); setIstBezahlt(true); }}
                      className="accent-green-500"
                    />
                    Ja
                  </label>
                  <label className={`flex items-center gap-1 cursor-pointer text-sm font-medium ${
                    !bezahlt ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="bezahlt-new"
                      checked={bezahlt === false}
                      onChange={() => { setBezahlt(false); setIstBezahlt(false); }}
                      className="accent-[#1a4d6d]"
                    />
                    Nein
                  </label>
                </div>
                {bezahlt && <span className="ml-auto text-xs font-bold text-green-600">✓ Bezahlt!</span>}
                {!bezahlt && <span className="text-red-500 text-xs font-medium ml-auto">✗ Ausstehend</span>}
              </div>
            </div>

            <Field label="m³"><Input type="number" value={m3} onChange={(e) => setM3(e.target.value)} placeholder="0" /></Field>
            <Field label="Type">
              <select className="w-full border rounded px-3 py-2 text-sm" value={moveType} onChange={(e) => setMoveType(e.target.value)}>
                <option>Umzug</option><option>Einlagerung</option><option>Transport</option><option>Entsorgung</option>
              </select>
            </Field>
            <div />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Field label="Call Check">
              <select className="w-full border rounded px-3 py-2 text-sm" value={callCheck} onChange={(e) => setCallCheck(e.target.value)}>
                <option>Nein</option><option>Ja</option>
              </select>
            </Field>
            <Field label="Shaden">
              <select className="w-full border rounded px-3 py-2 text-sm" value={shaden} onChange={(e) => setShaden(e.target.value)}>
                <option>Nein</option><option>Ja</option>
              </select>
            </Field>
            <YesNo label="Angebot per Post" value={angebotPerPost} onChange={setAngebotPerPost} />
          </div>
        </Section>

        {/* ── 2+3. ADDRESS + IMMOBILIEN ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Section title="Address">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Distanz (km)"><Input type="number" value={distanz} onChange={(e) => setDistanz(e.target.value)} placeholder="0" /></Field>
              <Field label="Anfahrt"><Input type="number" value={anfahrt} onChange={(e) => setAnfahrt(e.target.value)} placeholder="0" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-sm mb-2 text-gray-700">Auszugsort</p>
                <div className="space-y-2">
                  <Field label="Adresse"><Input value={auszugsort} onChange={(e) => setAuszugsort(e.target.value)} placeholder="Straße, PLZ Ort" /></Field>
                  <Field label="Etage">
                    <select className="w-full border rounded px-3 py-2 text-sm" value={auszugEtage} onChange={(e) => setAuszugEtage(e.target.value)}>
                      {etageOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Fahrstuhl">
                    <select className="w-full border rounded px-3 py-2 text-sm" value={auszugFahrstuhl} onChange={(e) => setAuszugFahrstuhl(e.target.value)}>
                      {fahrstuhlOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Laufweg">
                    <select className="w-full border rounded px-3 py-2 text-sm" value={auszugLaufweg} onChange={(e) => setAuszugLaufweg(e.target.value)}>
                      {laufwegOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm mb-2 text-gray-700">Einzugsort</p>
                <div className="space-y-2">
                  <Field label="Adresse"><Input value={einzugsort} onChange={(e) => setEinzugsort(e.target.value)} placeholder="Straße, PLZ Ort" /></Field>
                  <Field label="Etage">
                    <select className="w-full border rounded px-3 py-2 text-sm" value={einzugEtage} onChange={(e) => setEinzugEtage(e.target.value)}>
                      {etageOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Fahrstuhl">
                    <select className="w-full border rounded px-3 py-2 text-sm" value={einzugFahrstuhl} onChange={(e) => setEinzugFahrstuhl(e.target.value)}>
                      {fahrstuhlOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Laufweg">
                    <select className="w-full border rounded px-3 py-2 text-sm" value={einzugLaufweg} onChange={(e) => setEinzugLaufweg(e.target.value)}>
                      {laufwegOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Immobilien">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-sm mb-2 text-gray-700">Auszugsort</p>
                <div className="space-y-2">
                  <Field label="Wohnfläche (m²)"><Input type="number" value={auszugFlaeche} onChange={(e) => setAuszugFlaeche(e.target.value)} placeholder="0" /></Field>
                  <Field label="Anzahl Zimmer"><Input type="number" value={auszugZimmer} onChange={(e) => setAuszugZimmer(e.target.value)} placeholder="0" /></Field>
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm mb-2 text-gray-700">Einzugsort</p>
                <div className="space-y-2">
                  <Field label="Wohnfläche (m²)"><Input type="number" value={einzugFlaeche} onChange={(e) => setEinzugFlaeche(e.target.value)} placeholder="0" /></Field>
                  <Field label="Anzahl Zimmer"><Input type="number" value={einzugZimmer} onChange={(e) => setEinzugZimmer(e.target.value)} placeholder="0" /></Field>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── 4. SERVICESS ── */}
        <Section title="Servicess">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="border rounded p-3">
              <p className="font-semibold text-sm mb-3 text-gray-700">Auszugsort</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <YesNo label="Einpackservice" value={einpackservice} onChange={setEinpackservice} />
                  <Field label="Kartons"><Input type="number" value={einpackKartons} onChange={(e) => setEinpackKartons(e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <YesNo label="Abbau von Möbeln" value={abbauMoebeln} onChange={setAbbauMoebeln} />
                  <Field label="M3"><Input type="number" value={abbauMoebelnM3} onChange={(e) => setAbbauMoebelnM3(e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <YesNo label="Abbau von Küche" value={abbauKueche} onChange={setAbbauKueche} />
                  <Field label="M3"><Input type="number" value={abbauKuecheM3} onChange={(e) => setAbbauKuecheM3(e.target.value)} /></Field>
                </div>
                <YesNo label="Einrichtung einer Parkzone am Auszugsort" value={parkzoneAuszug} onChange={setParkzoneAuszug} />
              </div>
            </div>
            <div className="border rounded p-3">
              <p className="font-semibold text-sm mb-3 text-gray-700">Einzugsort</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <YesNo label="Auspackservice" value={auspackservice} onChange={setAuspackservice} />
                  <Field label="Kartons"><Input type="number" value={auspackKartons} onChange={(e) => setAuspackKartons(e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <YesNo label="Aufbau von Möbeln" value={aufbauMoebeln} onChange={setAufbauMoebeln} />
                  <Field label="M3"><Input type="number" value={aufbauMoebelnM3} onChange={(e) => setAufbauMoebelnM3(e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <YesNo label="Aufbau von Küche" value={aufbauKueche} onChange={setAufbauKueche} />
                  <Field label="M3"><Input type="number" value={aufbauKuecheM3} onChange={(e) => setAufbauKuecheM3(e.target.value)} /></Field>
                </div>
                <YesNo label="Einrichtung einer Parkzone am Einzugsort" value={parkzoneEinzug} onChange={setParkzoneEinzug} />
              </div>
            </div>
          </div>

          <div className="border rounded p-3 mb-4">
            <p className="font-semibold text-sm mb-3 text-gray-700">Kartons</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Umzugskartons"><Input type="number" value={umzugskartons} onChange={(e) => setUmzugskartons(e.target.value)} /></Field>
              <Field label="Kleiderkartons"><Input type="number" value={kleiderkartons} onChange={(e) => setKleiderkartons(e.target.value)} /></Field>
              <Field label="Delivery Date"><Input type="datetime-local" value={kartonDelivery} onChange={(e) => setKartonDelivery(e.target.value)} /></Field>
              <Field label="Karton geliefert?">
                <select className="w-full border rounded px-3 py-2 text-sm" value={kartonGeliefert} onChange={(e) => setKartonGeliefert(e.target.value)}>
                  <option value=""></option><option>Ja</option><option>Nein</option>
                </select>
              </Field>
              <Field label="Datum Parkzone"><Input type="date" value={parkzoneDatum} onChange={(e) => setParkzoneDatum(e.target.value)} /></Field>
              <Field label="Parkzone geliefert?">
                <select className="w-full border rounded px-3 py-2 text-sm" value={parkzoneGeliefert} onChange={(e) => setParkzoneGeliefert(e.target.value)}>
                  <option value=""></option><option>Ja</option><option>Nein</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="border rounded p-3">
            <p className="font-semibold text-sm mb-3 text-gray-700">Additonal services</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <YesNo label="Klaviertransport" value={klaviertransport} onChange={setKlaviertransport} />
              <Field label="Klavier Gross">
                <div className="flex flex-wrap gap-2 mt-1">
                  {["Nein","Klavier 250","Klavier Gross 650"].map((o) => (
                    <label key={o} className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="radio" checked={klavierGross === o} onChange={() => setKlavierGross(o)} /> {o}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Schwer Transport">
                <select className="w-full border rounded px-3 py-2 text-sm" value={schwerTransport} onChange={(e) => setSchwerTransport(e.target.value)}>
                  <option>Kein</option><option>1 Stück</option><option>2 Stück</option><option>3+ Stück</option>
                </select>
              </Field>

              <YesNo label="Lampen" value={lampen} onChange={setLampen} />
              <Field label="Lampen Ort">
                <div className="flex flex-wrap gap-2 mt-1">
                  {["Kein","Abmontieren","Anbringen","Beide"].map((o) => (
                    <label key={o} className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="radio" checked={lampenOrt === o} onChange={() => setLampenOrt(o)} /> {o}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Lampen Stück"><Input type="number" value={lampenStueck} onChange={(e) => setLampenStueck(e.target.value)} /></Field>

              <YesNo label="Einlagerung von Möbeln" value={einlagerung} onChange={setEinlagerung} />
              <Field label="Einlagerung Price (€)"><Input type="number" value={einlagerungPrice} onChange={(e) => setEinlagerungPrice(e.target.value)} /></Field>
              <YesNo label="Endreinigung" value={endreinigung} onChange={setEndreinigung} />

              <YesNo label="Bohr- und Dübelarbeit" value={bohrarbeit} onChange={setBohrarbeit} />
              <Field label="Bohrarbeit Punkt"><Input type="number" value={bohrarbeitPunkt} onChange={(e) => setBohrarbeitPunkt(e.target.value)} /></Field>
              <div />

              <YesNo label="Entsorgung von Möbeln" value={entsorgung} onChange={setEntsorgung} />
              <Field label="Entsorgung Type">
                <div className="flex gap-3 mt-1">
                  {["Normal","Gemischt"].map((o) => (
                    <label key={o} className="flex items-center gap-1 text-sm cursor-pointer">
                      <input type="radio" checked={entsorgungType === o} onChange={() => setEntsorgungType(o)} /> {o}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Entsorgung M3"><Input type="number" value={entsorgungM3} onChange={(e) => setEntsorgungM3(e.target.value)} /></Field>

              <Field label="Außenlift">
                <select className="w-full border rounded px-3 py-2 text-sm" value={aussenlift} onChange={(e) => setAussenlift(e.target.value)}>
                  <option>Nein</option><option>Ja</option>
                </select>
              </Field>
              <Field label="Außenlift Stunde"><Input type="number" value={aussenliftStunde} onChange={(e) => setAussenliftStunde(e.target.value)} /></Field>
              <YesNo label="Anschluss der Waschmaschine" value={anschlussWaschmaschine} onChange={setAnschlussWaschmaschine} />

              <Field label="Sonstige Leistung"><Input value={sonstigeLeistung} onChange={(e) => setSonstigeLeistung(e.target.value)} placeholder="Beschreibung" /></Field>
              <Field label="Sonstige Leistung Price (€)"><Input type="number" value={sonstigePrice} onChange={(e) => setSonstigePrice(e.target.value)} /></Field>
            </div>
          </div>
        </Section>

        {/* ── 5. NOTE ── */}
        <Section title="NOTE">
          <div className="space-y-4">
            <Field label={<span className="text-red-600 font-semibold">Sammary</span>}>
              <textarea className="w-full border rounded p-2 text-sm h-20 resize-y" value={summary} onChange={(e) => setSummary(e.target.value)} />
            </Field>
            <Field label={<span className="text-red-600 font-semibold">Die sehr wichtigen Anmerkungen, die keine Angaben zu Dienstleistungen oder Zahlungsinformationen enthalten</span>}>
              <textarea className="w-full border rounded p-2 text-sm h-20 resize-y" value={anmerkungen} onChange={(e) => setAnmerkungen(e.target.value)} />
            </Field>
            <Field label={<span className="text-red-600 font-semibold">Die kundenbezogenen Serviceanmerkungen</span>}>
              <textarea className="w-full border rounded p-2 text-sm h-20 resize-y" value={serviceanmerkungen} onChange={(e) => setServiceanmerkungen(e.target.value)} />
            </Field>
            <Field label={<span className="text-red-600 font-semibold">Nur die Möbelliste und die dazugehörigen Anmerkungen werden hier eingetragen.</span>}>
              <textarea className="w-full border rounded p-2 text-sm h-20 resize-y" value={moebelListe} onChange={(e) => setMoebelListe(e.target.value)} />
            </Field>
            <Field label={<span className="text-red-600 font-semibold">Kunden Note (Bitte geben Sie in diesem Feld keine Preise an.)</span>}>
              <textarea className="w-full border rounded p-2 text-sm h-20 resize-y" value={kundenNote} onChange={(e) => setKundenNote(e.target.value)} />
            </Field>
            <Field label={<span className="text-red-600 font-semibold">Kontaktinformationen des Kunden, seine Anmerkungen, die gewählte Zahlungsmethode sowie die Information, ob der Kunde vor dem Umzugstermin kontaktiert wurde oder nicht.</span>}>
              <textarea className="w-full border rounded p-2 text-sm h-20 resize-y" value={kontaktinfo} onChange={(e) => setKontaktinfo(e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ── 6+7. PHOTOS + WEB BEWERTUNG ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Section title={`Photos and Docs${photos.length > 0 ? ` (${photos.length})` : ""}`}>
            {/* Hidden file input */}
            <input
              ref={photoInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoSelect(e.target.files)}
            />

            {/* Drop zone */}
            <div
              className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-[#1a4d6d] hover:bg-[#eaf2f7]"
              onClick={() => photoInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#1a4d6d]", "bg-[#eaf2f7]"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#1a4d6d]", "bg-[#eaf2f7]"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-[#1a4d6d]", "bg-[#eaf2f7]");
                handlePhotoSelect(e.dataTransfer.files);
              }}
            >
              {compressing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#1a4d6d]" />
                  <p className="text-sm font-medium text-[#1a4d6d]">Komprimiere Fotos...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={28} className="text-gray-400" />
                  <p className="text-gray-600 text-sm font-medium">Fotos hier ablegen oder klicken</p>
                  <p className="text-gray-400 text-xs">Automatische Komprimierung — Qualität erhalten, Größe reduziert</p>
                  <Button type="button" variant="outline" size="sm" className="mt-1">
                    <Upload size={14} className="mr-1" /> Fotos auswählen
                  </Button>
                </div>
              )}
            </div>

            {/* Photo previews */}
            {photos.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-600">{photos.length} Foto(s) ausgewählt</p>
                  <button
                    type="button"
                    onClick={() => setPhotos([])}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Alle entfernen
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={photo.preview}
                        alt={photo.name}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1 py-0.5 rounded-b truncate">
                        {Math.round(photo.compressedSize / 1024)}KB
                        {photo.originalSize > photo.compressedSize && (
                          <span className="ml-1 text-[#f3c6a1]">
                            (-{Math.round((1 - photo.compressedSize / photo.originalSize) * 100)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
          <Section title="Web Bewertung">
            <div className="space-y-3">
              <Field label="Bewertungsplattform">
                <select className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Keine</option><option>Google</option><option>Trustpilot</option><option>Yelp</option>
                </select>
              </Field>
              <Field label="Bewertung (1-5)"><Input type="number" min="1" max="5" placeholder="0" /></Field>
              <Field label="Bewertungslink"><Input type="url" placeholder="https://..." /></Field>
            </div>
          </Section>
        </div>

        {/* ── 8. PLAN ── */}
        <Section title="Plan">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Geplante Mitarbeiter"><Input type="number" placeholder="0" /></Field>
            <Field label="Geplante Fahrzeuge"><Input type="number" placeholder="0" /></Field>
            <Field label="Startzeit"><Input type="time" /></Field>
            <Field label="Endzeit (geschätzt)"><Input type="time" /></Field>
            <div className="md:col-span-2">
              <Field label="Bemerkungen zum Plan"><textarea className="w-full border rounded p-2 text-sm h-16 resize-y" /></Field>
            </div>
          </div>
        </Section>

        {/* ── 9. FINANZEN ── */}
        <Section title="Finanzen">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Anzahlung (€)"><Input type="number" value={anzahlung} onChange={(e) => setAnzahlung(e.target.value)} placeholder="0" /></Field>
            <Field label="Restbetrag (€)"><Input type="number" value={restbetrag} onChange={(e) => setRestbetrag(e.target.value)} placeholder="0" /></Field>
            <Field label="Zahlungsart">
              <select className="w-full border rounded px-3 py-2 text-sm" value={zahlungsart} onChange={(e) => setZahlungsart(e.target.value)}>
                <option>Überweisung</option><option>Barzahlung</option><option>PayPal</option><option>Kreditkarte</option>
              </select>
            </Field>
            <Field label="Rechnungsnummer"><Input value={rechnungNr} onChange={(e) => setRechnungNr(e.target.value)} placeholder="RE-00000" /></Field>
            <div className="md:col-span-2 bg-gray-50 rounded p-3 border">
              <p className="text-sm font-semibold text-gray-700 mb-2">Zusammenfassung</p>
              <div className="flex gap-6 text-sm text-gray-600">
                <span>Brutto-Preis: <strong>{priceBrutto || 0} €</strong></span>
                <span>Anzahlung: <strong>{anzahlung || 0} €</strong></span>
                <span>Restbetrag: <strong>{restbetrag || 0} €</strong></span>
              </div>
              <p className="mt-1 text-sm">Status: <span className={`font-bold ${bezahlt ? "text-green-700" : "text-[#1a4d6d]"}`}>{bezahlt ? "Bezahlt ✓" : "Ausstehend"}</span></p>
            </div>
          </div>
        </Section>

        {/* ── 10. BESCHWERDE, SCHADEN ── */}
        <Section title="Beschwerde, Schaden und Extra volume protocols">
          <div className="space-y-4">
            <div className="border rounded p-3">
              <p className="font-semibold text-sm mb-3 text-red-600">Schaden (Damage Report)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Schadensbeschreibung"><textarea className="w-full border rounded p-2 text-sm h-16 resize-y" placeholder="Beschreibung des Schadens..." /></Field>
                <Field label="Geschätzte Kosten (€)"><Input type="number" placeholder="0" /></Field>
                <Field label="Schadenstatus">
                  <select className="w-full border rounded px-3 py-2 text-sm">
                    <option>Gemeldet</option><option>In Bearbeitung</option><option>Abgeschlossen</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="border rounded p-3">
              <p className="font-semibold text-sm mb-3 text-orange-600">Beschwerde (Complaint)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Beschwerdebeschreibung"><textarea className="w-full border rounded p-2 text-sm h-16 resize-y" placeholder="Beschreibung der Beschwerde..." /></Field>
                <Field label="Schweregrad">
                  <select className="w-full border rounded px-3 py-2 text-sm">
                    <option>Niedrig</option><option>Mittel</option><option>Hoch</option><option>Kritisch</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="border rounded p-3">
              <p className="mb-3 text-sm font-semibold text-[#1a4d6d]">Extra Volume Protocol</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Extra Volumen (m³)"><Input type="number" placeholder="0" /></Field>
                <Field label="Extra Preis (€)"><Input type="number" placeholder="0" /></Field>
                <div className="md:col-span-2"><Field label="Bemerkungen"><textarea className="w-full border rounded p-2 text-sm h-16 resize-y" /></Field></div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 11. AUDITS ── */}
        <Section title="Zahlungsstatuts">
          <div className="space-y-4">
            {/* صف المعلومات الأساسية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Betzhlt von">
                <select className="w-full border rounded px-3 py-2 text-sm" value={bezahltVon} onChange={e => setBezahltVon(e.target.value)}>
                  <option>Kunde</option>
                  <option>Firma</option>
                </select>
              </Field>
              <Field label="Betzhal kunde">
                <Input value={betzhalKunde} onChange={e => setBetzhalKunde(e.target.value)} placeholder="Name des Zahlers" />
              </Field>
            </div>

            <div className={`flex items-center gap-6 rounded-lg px-4 py-3 transition-all duration-500 ${istBezahlt ? 'border border-green-300 bg-green-50' : 'border border-gray-200 bg-gray-50'}`}>
              <span className={`text-sm font-semibold transition-colors duration-500 ${istBezahlt ? 'text-green-700' : 'text-gray-700'}`}>Ist bezahlt</span>
              {istBezahlt && (
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                </span>
              )}
              <label className="flex items-center gap-1.5 text-sm cursor-pointer font-medium">
                <input type="radio" name="istBezahlt" checked={istBezahlt} onChange={() => { setIstBezahlt(true); setBezahlt(true); }} className="accent-green-500" />
                <span className={istBezahlt ? 'font-bold text-green-700' : 'text-gray-600'}>Ja</span>
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer font-medium">
                <input type="radio" name="istBezahlt" checked={!istBezahlt} onChange={() => { setIstBezahlt(false); setBezahlt(false); }} className="accent-[#1a4d6d]" />
                <span className={!istBezahlt ? 'text-red-600 font-bold' : 'text-gray-600'}>Nein</span>
              </label>
              {istBezahlt && <span className="ml-2 animate-pulse rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">✓ Bezahlt!</span>}
            </div>

            {/* Data – Payment & Rechnung */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-semibold text-sm text-gray-700">Data</div>
              <div className="p-4 space-y-4">

                {/* Payment */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 font-semibold text-sm text-gray-700">Payment</div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="Payment way">
                        <div className="flex items-center gap-4 pt-1">
                          {["Bank", "Bank and Bar", "Bar"].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input type="radio" name="paymentWay" value={opt} checked={paymentWay === opt} onChange={() => setPaymentWay(opt)} className="accent-[#1a4d6d]" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </Field>
                      <Field label="Total Price">
                        <Input type="number" value={auditTotalPrice} onChange={e => setAuditTotalPrice(e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="Betzhlt Datum">
                        <Input type="date" value={bezahltDatum} onChange={e => setBezahltDatum(e.target.value)} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Bank">
                        <Input type="number" value={bankBetrag} onChange={e => setBankBetrag(e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="Bar">
                        <Input type="number" value={barBetrag} onChange={e => setBarBetrag(e.target.value)} placeholder="0" />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* Rechnung */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 font-semibold text-sm text-gray-700">Rechnung</div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="Rechnung">
                        <div className="flex items-center gap-4 pt-1">
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="radio" name="rechnungAusgestellt" checked={rechnungAusgestellt} onChange={() => setRechnungAusgestellt(true)} className="accent-[#1a4d6d]" />
                            Ja
                          </label>
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="radio" name="rechnungAusgestellt" checked={!rechnungAusgestellt} onChange={() => setRechnungAusgestellt(false)} className="accent-[#1a4d6d]" />
                            Nein
                          </label>
                        </div>
                      </Field>
                      <Field label="Rechnung Betrag">
                        <Input type="number" value={rechnungBetrag} onChange={e => setRechnungBetrag(e.target.value)} placeholder="0" />
                      </Field>
                      <Field label="Rechnung Nummer">
                        <Input value={rechnungNummer} onChange={e => setRechnungNummer(e.target.value)} placeholder="RE-00000" />
                      </Field>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </Section>

        {/* ── 12. NACHRICHTEN ── */}
        <Section title="Nachrichten">
          <p className="text-xs text-gray-500 mb-3">
            Klicken Sie auf eine Nachricht, um sie zu öffnen und zu kopieren. Die Daten werden automatisch aus dem Kundenformular übernommen.
          </p>
          <div className="space-y-2">
            {[
              { key: "willkommen", label: "Willkommen Nachricht Frankfurt" },
              { key: "ersteNachricht", label: "Erste Nachricht Frankfurt" },
              { key: "angebotSchicken", label: "Angebot schicken Frankfurt" },
              { key: "angebotBestaetigt", label: "Angebot Bestätigt Frankfurt" },
              { key: "absage", label: "Absage Frankfurt" },
              { key: "rechnungDaten", label: "Rechnung daten" },
              { key: "angepassteAngebot", label: "Das angepasste Angebot" },
            ].map(({ key, label }) => (
              <MessageItem
                key={key}
                label={label}
                message={buildMessage(key)}
                copied={copied === key}
                onCopy={(text) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); toast.success("Nachricht kopiert!"); }}
              />
            ))}

            {/* ── مجموعة Nachverfolgen ── */}
            <NachverfolgenGroup
              keys={["nachverfolgen1", "nachverfolgen2", "nachverfolgen3", "nachverfolgen4"]}
              labels={["Nachverfolgen 1", "Nachverfolgen 2", "Nachverfolgen 3", "Nachverfolgen 4"]}
              buildMessage={buildMessage}
              copied={copied}
              setCopied={setCopied}
            />
          </div>
        </Section>

        {/* ── Save ── */}
        <div className="flex justify-end gap-3 pt-4 pb-10">
          <Button type="button" variant="outline" onClick={() => navigate("/")}>Abbrechen</Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateOffer}
            disabled={createCustomer.isPending || generateOffer.isPending}
            className="border-[#d97706] text-[#d97706] hover:bg-[#fff7ed]"
          >
            {generateOffer.isPending ? "PDF wird erstellt..." : "Umzug Angebot"}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createCustomer.isPending || !!savedCustomerId}
            className="bg-[#1a4d6d] px-8 text-white hover:bg-[#14394f] disabled:opacity-100"
          >
            {savedCustomerId ? "Gespeichert" : createCustomer.isPending ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
