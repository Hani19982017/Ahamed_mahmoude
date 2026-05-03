import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X, Plus, Minus, Upload, Copy, Check, ImageIcon, FileText } from "lucide-react";

async function compressImage(file: File): Promise<{ base64: string; name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxW = 1200, maxH = 1200;
        if (width > maxW || height > maxH) {
          const r = Math.min(maxW / width, maxH / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve({ base64: canvas.toDataURL("image/jpeg", 0.75), name: file.name.replace(/\.[^.]+$/, ".jpg") });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Section({ title, defaultOpen = false, teal = false, children }: {
  title: string; defaultOpen?: boolean; teal?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded mb-2">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left font-semibold text-sm ${teal ? "bg-[#00aabb] text-white hover:bg-[#009aaa]" : "bg-gray-50 text-gray-800 hover:bg-gray-100"}`}>
        {open ? <Minus size={14} /> : <Plus size={14} />}{title}
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div><Label className="block mb-1 text-xs text-gray-600">{label}</Label>{children}</div>;
}

function YesNo({ label, value, onChange, ro }: { label: string; value: boolean; onChange: (v: boolean) => void; ro?: boolean }) {
  return (
    <div>
      {label && <Label className="block mb-1 text-xs text-gray-600">{label}</Label>}
      <div className="flex gap-4 mt-1">
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="radio" checked={value} onChange={() => !ro && onChange(true)} disabled={ro} /> Ja
        </label>
        <label className="flex items-center gap-1 text-sm cursor-pointer">
          <input type="radio" checked={!value} onChange={() => !ro && onChange(false)} disabled={ro} /> Nein
        </label>
      </div>
    </div>
  );
}

function MessageItem({ label, message, copied, onCopy }: { label: string; message: string; copied: boolean; onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100">
        {open ? <Minus size={12} /> : <Plus size={12} />} {label}
      </button>
      {open && <div className="p-3">
        <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 rounded p-3 border font-sans leading-relaxed">{message}</pre>
        <Button type="button" onClick={onCopy} className="mt-2 bg-[#00aabb] hover:bg-[#008899] text-white text-xs" size="sm">
          {copied ? <><Check size={12} className="mr-1" />Kopiert!</> : <><Copy size={12} className="mr-1" />Nachricht kopieren</>}
        </Button>
      </div>}
    </div>
  );
}

const etageOpts = ["Erdgeschoss","1.Etage","2.Etage","3.Etage","4.Etage","5.Etage","6.Etage+"];
const fahrstuhlOpts = ["kein Aufzug vorhanden","Aufzug klein","Aufzug mittel","Aufzug gross"];
const laufwegOpts = ["0 - 10 m","10 - 20 m","20 - 30 m","30 - 40 m","40 - 50 m","50 m+"];

interface Props { moveId: number; mode: "view" | "edit"; onClose: () => void; onSaved?: () => void; }

export default function MoveDetailDialog({ moveId, mode, onClose, onSaved }: Props) {
  const ro = mode === "view";
  const [copied, setCopied] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const generateInvoice = trpc.moves.generateInvoice.useMutation();
  const generateOffer = trpc.customers.generateOfferPdf.useMutation();
  const { data: branches = [] } = trpc.branches.list.useQuery();
  const { data: userData } = trpc.auth.me.useQuery();
  const activeBranches = branches.filter(b => b.isActive);
  const branchOptions = activeBranches.map(b => b.name);
  const isBranchManager = userData?.role === 'branch_manager';

  const handleGenerateOffer = async () => {
    if (!data?.move?.customerId) {
      toast.error('Kundendaten für das Angebot wurden nicht gefunden.');
      return;
    }

    try {
      const result = await generateOffer.mutateAsync({
        customerId: data.move.customerId,
        moveId,
      });
      const binary = atob(result.base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Umzug Angebot für ${result.kundenummer} wurde heruntergeladen.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen des Umzug Angebots');
    }
  };

  const handleGenerateInvoice = async () => {
    setGeneratingPdf(true);
    setInvoiceSaveMode(true);
    try {
      // حفظ البيانات أولاً لضمان أن الفاتورة تعكس التغييرات الحالية
      const servicesJson = JSON.stringify({
        einpackservice, einpackKartons, abbauMoebeln, abbauMoebelnM3, abbauKueche, abbauKuecheM3, parkzoneAuszug,
        auspackservice, auspackKartons, aufbauMoebeln, aufbauMoebelnM3, aufbauKueche, aufbauKuecheM3, parkzoneEinzug,
        umzugskartons, kleiderkartons, kartonDelivery, kartonGeliefert, parkzoneDatum, parkzoneGeliefert,
        klaviertransport, klavierGross, schwerTransport, lampen, lampenOrt, lampenStueck,
        einlagerung, einlagerungPrice, endreinigung, bohrarbeit, bohrarbeitPunkt,
        entsorgung, entsorgungType, entsorgungM3, aussenlift, aussenliftStunde,
        anschlussWaschmaschine, sonstigeLeistung, sonstigePrice,
      });
      await updateMove.mutateAsync({
        moveId, title: anrede, name, phone, email, sitz, status2, versuch,
        callCheck, shaden, angebotPerPost, bezahlt, mitFotos,
        moveCode: umzugscode, moveType,
        status: moveStatus as "pending" | "confirmed" | "in_progress" | "completed" | "cancelled",
        paymentStatus: paymentStatus as "unpaid" | "partial" | "paid",
        grossPrice: priceBrutto ? parseFloat(priceBrutto) : undefined,
        volume: m3 ? parseFloat(m3) : undefined, distance: distanz ? parseFloat(distanz) : undefined,
        anfahrt: anfahrt ? parseInt(anfahrt) : 0,
        pickupDate: terminVon, deliveryDate: terminBis,
        pickupAddress: auszugsort, pickupFloor: auszugEtage,
        pickupElevatorCapacity: auszugFahrstuhl, pickupParkingDistance: auszugLaufweg,
        deliveryAddress: einzugsort, deliveryFloor: einzugEtage,
        deliveryElevatorCapacity: einzugFahrstuhl, deliveryParkingDistance: einzugLaufweg,
        auszugFlaeche: auszugFlaeche ? parseInt(auszugFlaeche) : undefined,
        auszugZimmer: auszugZimmer ? parseInt(auszugZimmer) : undefined,
        einzugFlaeche: einzugFlaeche ? parseInt(einzugFlaeche) : undefined,
        einzugZimmer: einzugZimmer ? parseInt(einzugZimmer) : undefined,
        servicesJson, summary, anmerkungen, serviceanmerkungen, moebelListe, kundenNote, kontaktinfo,
        bewertungPlatform, bewertungScore: bewertungScore ? parseInt(bewertungScore) : undefined, bewertungLink,
        planMitarbeiter: planMitarbeiter ? parseInt(planMitarbeiter) : undefined,
        planFahrzeuge: planFahrzeuge ? parseInt(planFahrzeuge) : undefined,
        planStartzeit, planEndzeit, planBemerkungen,
        anzahlung: anzahlung ? parseInt(anzahlung) : undefined,
        restbetrag: restbetrag ? parseInt(restbetrag) : undefined,
        zahlungsart, rechnungNr,
        schadenDescription: schadenDesc,
        schadenKosten: schadenKosten ? parseInt(schadenKosten) : undefined,
        schadenStatus, beschwerdeDescription: beschwerdeDesc, beschwerdeSchweregard,
        extraVolumen: extraVolumen ? parseInt(extraVolumen) : undefined,
        extraPreis: extraPreis ? parseInt(extraPreis) : undefined, extraBemerkungen,
        // Audits
        bezahltVon: auditBezahltVon,
        betzhalKunde: auditBetzhalKunde,
        istBezahlt: auditIstBezahlt,
        paymentWay: auditPaymentWay,
        auditTotalPrice: auditTotalPrice ? parseFloat(auditTotalPrice) : undefined,
        bezahltDatum: auditBezahltDatum || undefined,
        bankBetrag: auditBankBetrag ? parseFloat(auditBankBetrag) : undefined,
        barBetrag: auditBarBetrag ? parseFloat(auditBarBetrag) : undefined,
        rechnungAusgestellt: auditRechnungAusgestellt,
        rechnungBetrag: auditRechnungBetrag ? parseFloat(auditRechnungBetrag) : undefined,
        rechnungNummer: auditRechnungNummer,
        images: photos.map(p => ({ name: p.name, data: p.base64 })),
      });

      // الآن توليد الفاتورة
      const result = await generateInvoice.mutateAsync({ moveId });
      // تحويل base64 إلى blob وتحميله
      const byteCharacters = atob(result.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Rechnung wurde erfolgreich erstellt!');
    } catch (err) {
      toast.error('Fehler beim Erstellen der Rechnung');
      console.error(err);
    } finally {
      setGeneratingPdf(false);
      setInvoiceSaveMode(false);
    }
  };
  const { data, isLoading, error } = trpc.moves.getById.useQuery({ id: moveId });

  const [anrede, setAnrede] = useState("Herr");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [sitz, setSitz] = useState("");
  
  useEffect(() => {
    if (sitz === "" && branchOptions.length > 0) {
      if (isBranchManager && userData?.branchId) {
        const userBranch = branches.find(b => b.id === userData.branchId);
        if (userBranch) setSitz(userBranch.name);
      } else if (branchOptions.length > 0) {
        setSitz(branchOptions[0]);
      }
    }
  }, [branchOptions, isBranchManager, userData?.branchId, branches]);
  const [status2, setStatus2] = useState("Registriert auf Apex");
  const [versuch, setVersuch] = useState("Versuch 1");
  const [moveType, setMoveType] = useState("Umzug");
  const [mitFotos, setMitFotos] = useState(true);
  const [terminVon, setTerminVon] = useState("");
  const [terminBis, setTerminBis] = useState("");
  const [umzugscode, setUmzugscode] = useState("");
  const [bezahlt, setBezahlt] = useState(false);
  const [callCheck, setCallCheck] = useState("Nein");
  const [shaden, setShaden] = useState("Nein");
  const [angebotPerPost, setAngebotPerPost] = useState(false);
  const [priceBrutto, setPriceBrutto] = useState("");
  const [m3, setM3] = useState("");
  const [moveStatus, setMoveStatus] = useState("pending");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
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
  const [auszugFlaeche, setAuszugFlaeche] = useState("");
  const [auszugZimmer, setAuszugZimmer] = useState("");
  const [einzugFlaeche, setEinzugFlaeche] = useState("");
  const [einzugZimmer, setEinzugZimmer] = useState("");
  const [einpackservice, setEinpackservice] = useState(false);
  const [einpackKartons, setEinpackKartons] = useState("0");
  const [abbauMoebeln, setAbbauMoebeln] = useState(false);
  const [abbauMoebelnM3, setAbbauMoebelnM3] = useState("0");
  const [abbauKueche, setAbbauKueche] = useState(false);
  const [abbauKuecheM3, setAbbauKuecheM3] = useState("0");
  const [parkzoneAuszug, setParkzoneAuszug] = useState(true);
  const [auspackservice, setAuspackservice] = useState(false);
  const [auspackKartons, setAuspackKartons] = useState("0");
  const [aufbauMoebeln, setAufbauMoebeln] = useState(false);
  const [aufbauMoebelnM3, setAufbauMoebelnM3] = useState("0");
  const [aufbauKueche, setAufbauKueche] = useState(false);
  const [aufbauKuecheM3, setAufbauKuecheM3] = useState("0");
  const [parkzoneEinzug, setParkzoneEinzug] = useState(true);
  const [umzugskartons, setUmzugskartons] = useState("0");
  const [kleiderkartons, setKleiderkartons] = useState("0");
  const [kartonDelivery, setKartonDelivery] = useState("");
  const [kartonGeliefert, setKartonGeliefert] = useState("");
  const [parkzoneDatum, setParkzoneDatum] = useState("");
  const [parkzoneGeliefert, setParkzoneGeliefert] = useState("");
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
  const [summary, setSummary] = useState("");
  const [anmerkungen, setAnmerkungen] = useState("");
  const [serviceanmerkungen, setServiceanmerkungen] = useState("");
  const [moebelListe, setMoebelListe] = useState("");
  const [kundenNote, setKundenNote] = useState("");
  const [kontaktinfo, setKontaktinfo] = useState("");
  const [photos, setPhotos] = useState<Array<{ name: string; base64: string; preview: string }>>([]);
  const [existingImages, setExistingImages] = useState<Array<{ id: number; imageUrl: string }>>([]);
  const [compressing, setCompressing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [bewertungPlatform, setBewertungPlatform] = useState("");
  const [bewertungScore, setBewertungScore] = useState("");
  const [bewertungLink, setBewertungLink] = useState("");
  const [planMitarbeiter, setPlanMitarbeiter] = useState("");
  const [planFahrzeuge, setPlanFahrzeuge] = useState("");
  const [planStartzeit, setPlanStartzeit] = useState("");
  const [planEndzeit, setPlanEndzeit] = useState("");
  const [planBemerkungen, setPlanBemerkungen] = useState("");
  const [anzahlung, setAnzahlung] = useState("");
  const [restbetrag, setRestbetrag] = useState("");
  const [zahlungsart, setZahlungsart] = useState("Ueberweisung");
  const [rechnungNr, setRechnungNr] = useState("");
  const [schadenDesc, setSchadenDesc] = useState("");
  const [schadenKosten, setSchadenKosten] = useState("");
  const [schadenStatus, setSchadenStatus] = useState("Gemeldet");
  const [beschwerdeDesc, setBeschwerdeDesc] = useState("");
  const [beschwerdeSchweregard, setBeschwerdeSchweregard] = useState("Niedrig");
  const [extraVolumen, setExtraVolumen] = useState("");
  const [extraPreis, setExtraPreis] = useState("");
  const [extraBemerkungen, setExtraBemerkungen] = useState("");
  // Audits
  const [auditBezahltVon, setAuditBezahltVon] = useState("Kunde");
  const [auditBetzhalKunde, setAuditBetzhalKunde] = useState("");
  const [auditIstBezahlt, setAuditIstBezahlt] = useState(false);
  const [auditPaymentWay, setAuditPaymentWay] = useState("Bank");
  const [auditTotalPrice, setAuditTotalPrice] = useState("");
  const [auditBezahltDatum, setAuditBezahltDatum] = useState("");
  const [auditBankBetrag, setAuditBankBetrag] = useState("");
  const [auditBarBetrag, setAuditBarBetrag] = useState("");
  const [auditRechnungAusgestellt, setAuditRechnungAusgestellt] = useState(false);
  const [auditRechnungBetrag, setAuditRechnungBetrag] = useState("");
  const [auditRechnungNummer, setAuditRechnungNummer] = useState("");

  useEffect(() => {
    if (!data) return;
    const { customer, move, images } = data as any;
    if (customer) {
      setAnrede(customer.title || "Herr");
      setName(`${customer.firstName || ""} ${customer.lastName || ""}`.trim());
      setPhone(customer.phone || ""); setEmail(customer.email || "");

      setSitz(customer.sitz || "Frankfurt"); setStatus2(customer.status2 || "Registriert auf Apex");
      setVersuch(customer.versuch || "Versuch 1"); setCallCheck(customer.callCheck || "Nein");
      setShaden(customer.shaden || "Nein"); setAngebotPerPost(!!customer.angebotPerPost);
      setBezahlt(!!customer.bezahlt); setMitFotos(customer.mitFotos !== 0);
    }
    if (move) {
      setUmzugscode(move.moveCode || ""); setMoveType(move.moveType || "Umzug");
      setMoveStatus(move.status || "pending"); setPaymentStatus(move.paymentStatus || "unpaid");
      setPriceBrutto(move.grossPrice ? String(move.grossPrice) : "");
      setM3(move.volume ? String(move.volume) : ""); setDistanz(move.distance ? String(move.distance) : "");
      setAnfahrt(move.anfahrt ? String(move.anfahrt) : "0");
      setAuszugsort(move.pickupAddress || ""); setAuszugEtage(move.pickupFloor || "Erdgeschoss");
      setAuszugFahrstuhl(move.pickupElevatorCapacity || "kein Aufzug vorhanden");
      setAuszugLaufweg(move.pickupParkingDistance || "10 - 20 m");
      setEinzugsort(move.deliveryAddress || ""); setEinzugEtage(move.deliveryFloor || "Erdgeschoss");
      setEinzugFahrstuhl(move.deliveryElevatorCapacity || "kein Aufzug vorhanden");
      setEinzugLaufweg(move.deliveryParkingDistance || "10 - 20 m");
      if (move.pickupDate) setTerminVon(new Date(move.pickupDate).toISOString().split("T")[0]);
      if (move.deliveryDate) setTerminBis(new Date(move.deliveryDate).toISOString().split("T")[0]);
      setAuszugFlaeche(move.auszugFlaeche ? String(move.auszugFlaeche) : "");
      setAuszugZimmer(move.auszugZimmer ? String(move.auszugZimmer) : "");
      setEinzugFlaeche(move.einzugFlaeche ? String(move.einzugFlaeche) : "");
      setEinzugZimmer(move.einzugZimmer ? String(move.einzugZimmer) : "");
      if (move.servicesJson) {
        try {
          const sj = JSON.parse(move.servicesJson);
          setEinpackservice(!!sj.einpackservice); setEinpackKartons(sj.einpackKartons || "0");
          setAbbauMoebeln(!!sj.abbauMoebeln); setAbbauMoebelnM3(sj.abbauMoebelnM3 || "0");
          setAbbauKueche(!!sj.abbauKueche); setAbbauKuecheM3(sj.abbauKuecheM3 || "0");
          setParkzoneAuszug(sj.parkzoneAuszug !== false);
          setAuspackservice(!!sj.auspackservice); setAuspackKartons(sj.auspackKartons || "0");
          setAufbauMoebeln(!!sj.aufbauMoebeln); setAufbauMoebelnM3(sj.aufbauMoebelnM3 || "0");
          setAufbauKueche(!!sj.aufbauKueche); setAufbauKuecheM3(sj.aufbauKuecheM3 || "0");
          setParkzoneEinzug(sj.parkzoneEinzug !== false);
          setUmzugskartons(sj.umzugskartons || "0"); setKleiderkartons(sj.kleiderkartons || "0");
          setKartonDelivery(sj.kartonDelivery || ""); setKartonGeliefert(sj.kartonGeliefert || "");
          setParkzoneDatum(sj.parkzoneDatum || ""); setParkzoneGeliefert(sj.parkzoneGeliefert || "");
          setKlaviertransport(!!sj.klaviertransport); setKlavierGross(sj.klavierGross || "Nein");
          setSchwerTransport(sj.schwerTransport || "Kein");
          setLampen(!!sj.lampen); setLampenOrt(sj.lampenOrt || "Kein"); setLampenStueck(sj.lampenStueck || "0");
          setEinlagerung(!!sj.einlagerung); setEinlagerungPrice(sj.einlagerungPrice || "0");
          setEndreinigung(!!sj.endreinigung); setBohrarbeit(!!sj.bohrarbeit); setBohrarbeitPunkt(sj.bohrarbeitPunkt || "0");
          setEntsorgung(!!sj.entsorgung); setEntsorgungType(sj.entsorgungType || "Normal"); setEntsorgungM3(sj.entsorgungM3 || "0");
          setAussenlift(sj.aussenlift || "Nein"); setAussenliftStunde(sj.aussenliftStunde || "0");
          setAnschlussWaschmaschine(!!sj.anschlussWaschmaschine);
          setSonstigeLeistung(sj.sonstigeLeistung || ""); setSonstigePrice(sj.sonstigePrice || "");
        } catch {}
      }
      setSummary(move.summary || ""); setAnmerkungen(move.anmerkungen || "");
      setServiceanmerkungen(move.serviceanmerkungen || ""); setMoebelListe(move.moebelListe || "");
      setKundenNote(move.kundenNote || ""); setKontaktinfo(move.kontaktinfo || "");
      setBewertungPlatform(move.bewertungPlatform || "");
      setBewertungScore(move.bewertungScore ? String(move.bewertungScore) : "");
      setBewertungLink(move.bewertungLink || "");
      setPlanMitarbeiter(move.planMitarbeiter ? String(move.planMitarbeiter) : "");
      setPlanFahrzeuge(move.planFahrzeuge ? String(move.planFahrzeuge) : "");
      setPlanStartzeit(move.planStartzeit || ""); setPlanEndzeit(move.planEndzeit || "");
      setPlanBemerkungen(move.planBemerkungen || "");
      setAnzahlung(move.anzahlung ? String(move.anzahlung) : "");
      setRestbetrag(move.restbetrag ? String(move.restbetrag) : "");
      setZahlungsart(move.zahlungsart || "Ueberweisung"); setRechnungNr(move.rechnungNr || "");
      setSchadenDesc(move.schadenDescription || "");
      setSchadenKosten(move.schadenKosten ? String(move.schadenKosten) : "");
      setSchadenStatus(move.schadenStatus || "Gemeldet");
      setBeschwerdeDesc(move.beschwerdeDescription || "");
      setBeschwerdeSchweregard(move.beschwerdeSchweregard || "Niedrig");
      setExtraVolumen(move.extraVolumen ? String(move.extraVolumen) : "");
      setExtraPreis(move.extraPreis ? String(move.extraPreis) : "");
      setExtraBemerkungen(move.extraBemerkungen || "");
      // Audits
      setAuditBezahltVon(move.bezahltVon || "Kunde");
      setAuditBetzhalKunde(move.betzhalKunde || "");
      setAuditIstBezahlt(!!move.istBezahlt);
      setAuditPaymentWay(move.paymentWay || "Bank");
      setAuditTotalPrice(move.auditTotalPrice ? String(move.auditTotalPrice / 100) : "");
      if (move.bezahltDatum) setAuditBezahltDatum(new Date(move.bezahltDatum).toISOString().split("T")[0]);
      setAuditBankBetrag(move.bankBetrag ? String(move.bankBetrag / 100) : "");
      setAuditBarBetrag(move.barBetrag ? String(move.barBetrag / 100) : "");
      setAuditRechnungAusgestellt(!!move.rechnungAusgestellt);
      setAuditRechnungBetrag(move.rechnungBetrag ? String(move.rechnungBetrag / 100) : "");
      setAuditRechnungNummer(move.rechnungNummer || "");
    }
    if (images) setExistingImages(images);
  }, [data]);

  const handlePhotoSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCompressing(true);
    const newPhotos: typeof photos = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try { const r = await compressImage(file); newPhotos.push({ name: r.name, base64: r.base64, preview: r.base64 }); } catch {}
    }
    setPhotos(prev => [...prev, ...newPhotos]); setCompressing(false);
  }, []);

  const buildMessage = (type: string) => {
    const n = name || "[Name]", code = umzugscode || "[Kundennummer]", date = terminVon || "[Datum]";
    const price = priceBrutto || "[Preis]", vol = m3 || "[m3]";
    const from = auszugsort || "[Auszugsort]", to = einzugsort || "[Einzugsort]", dist = distanz || "[km]";
    const t: Record<string, string> = {
      willkommen: `Hallo ${anrede} ${n},\n\nvielen Dank fuer Ihre Anfrage bei Check Umzug!\n\nKundennummer: ${code}\nVon: ${from}\nNach: ${to}\n\nMit freundlichen Gruessen,\nIhr Check Umzug Team`,
      ersteNachricht: `Hallo ${anrede} ${n},\n\nvielen Dank fuer Ihre Anfrage. Wir melden uns bald.\n\nMit freundlichen Gruessen,\nUmzugsberater`,
      angebotSchicken: `Hallo ${anrede} ${n},\n\nIhr Angebot (${code}):\n\nDatum: ${date}\nVolumen: ${vol} m3\nPreis: ${price} EUR\nVon: ${from}\nNach: ${to}\nDistanz: ${dist} km\n\nMit freundlichen Gruessen,\nUmzugsberater`,
      angebotBestaetigt: `Hallo ${anrede} ${n},\n\nIhr Termin am ${date} ist bestaetigt.\n\nKundennummer: ${code}\n\nMit freundlichen Gruessen,\nUmzugsberater`,
      absage: `Hallo ${anrede} ${n},\n\nleider koennen wir Ihren Termin nicht erfuellen.\n\nMit freundlichen Gruessen,\nUmzugsberater`,
      nachverfolgen: `Hallo ${anrede} ${n},\n\nhaben Sie noch Interesse an Angebot ${code}?\n\nMit freundlichen Gruessen,\nUmzugsberater`,
      rechnungDaten: `Hallo ${anrede} ${n},\n\nRechnung fuer Umzug am ${date}.\n\nBetrag: ${price} EUR\nKundennummer: ${code}\n\nMit freundlichen Gruessen,\nUmzugsberater`,
      angepassteAngebot: `Hallo ${anrede} ${n},\n\nangepasstes Angebot:\n\nKundennummer: ${code}\nPreis: ${price} EUR\nDatum: ${date}\n\nMit freundlichen Gruessen,\nUmzugsberater`,
    };
    return t[type] || "";
  };
  const copyMessage = (type: string) => {
    navigator.clipboard.writeText(buildMessage(type));
    setCopied(type); setTimeout(() => setCopied(null), 2000); toast.success("Nachricht kopiert!");
  };

  const [invoiceSaveMode, setInvoiceSaveMode] = useState(false);
  const updateMove = trpc.moves.fullUpdate.useMutation({
    onSuccess: () => {
      if (!invoiceSaveMode) {
        toast.success("Gespeichert!"); onSaved?.(); onClose();
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const servicesJson = JSON.stringify({
      einpackservice, einpackKartons, abbauMoebeln, abbauMoebelnM3, abbauKueche, abbauKuecheM3, parkzoneAuszug,
      auspackservice, auspackKartons, aufbauMoebeln, aufbauMoebelnM3, aufbauKueche, aufbauKuecheM3, parkzoneEinzug,
      umzugskartons, kleiderkartons, kartonDelivery, kartonGeliefert, parkzoneDatum, parkzoneGeliefert,
      klaviertransport, klavierGross, schwerTransport, lampen, lampenOrt, lampenStueck,
      einlagerung, einlagerungPrice, endreinigung, bohrarbeit, bohrarbeitPunkt,
      entsorgung, entsorgungType, entsorgungM3, aussenlift, aussenliftStunde,
      anschlussWaschmaschine, sonstigeLeistung, sonstigePrice,
    });
    updateMove.mutate({
      moveId, title: anrede, name, phone, email, sitz, status2, versuch,
      callCheck, shaden, angebotPerPost, bezahlt, mitFotos,
      moveCode: umzugscode, moveType,
      status: moveStatus as "pending" | "confirmed" | "in_progress" | "completed" | "cancelled",
      paymentStatus: paymentStatus as "unpaid" | "partial" | "paid",
      grossPrice: priceBrutto ? parseFloat(priceBrutto) : undefined,
      volume: m3 ? parseFloat(m3) : undefined, distance: distanz ? parseFloat(distanz) : undefined,
      anfahrt: anfahrt ? parseInt(anfahrt) : 0,
      pickupDate: terminVon, deliveryDate: terminBis,
      pickupAddress: auszugsort, pickupFloor: auszugEtage,
      pickupElevatorCapacity: auszugFahrstuhl, pickupParkingDistance: auszugLaufweg,
      deliveryAddress: einzugsort, deliveryFloor: einzugEtage,
      deliveryElevatorCapacity: einzugFahrstuhl, deliveryParkingDistance: einzugLaufweg,
      auszugFlaeche: auszugFlaeche ? parseInt(auszugFlaeche) : undefined,
      auszugZimmer: auszugZimmer ? parseInt(auszugZimmer) : undefined,
      einzugFlaeche: einzugFlaeche ? parseInt(einzugFlaeche) : undefined,
      einzugZimmer: einzugZimmer ? parseInt(einzugZimmer) : undefined,
      servicesJson, summary, anmerkungen, serviceanmerkungen, moebelListe, kundenNote, kontaktinfo,
      bewertungPlatform, bewertungScore: bewertungScore ? parseInt(bewertungScore) : undefined, bewertungLink,
      planMitarbeiter: planMitarbeiter ? parseInt(planMitarbeiter) : undefined,
      planFahrzeuge: planFahrzeuge ? parseInt(planFahrzeuge) : undefined,
      planStartzeit, planEndzeit, planBemerkungen,
      anzahlung: anzahlung ? parseInt(anzahlung) : undefined,
      restbetrag: restbetrag ? parseInt(restbetrag) : undefined,
      zahlungsart, rechnungNr,
      schadenDescription: schadenDesc,
      schadenKosten: schadenKosten ? parseInt(schadenKosten) : undefined,
      schadenStatus, beschwerdeDescription: beschwerdeDesc, beschwerdeSchweregard,
      extraVolumen: extraVolumen ? parseInt(extraVolumen) : undefined,
      extraPreis: extraPreis ? parseInt(extraPreis) : undefined, extraBemerkungen,
      // Audits
      bezahltVon: auditBezahltVon,
      betzhalKunde: auditBetzhalKunde,
      istBezahlt: auditIstBezahlt,
      paymentWay: auditPaymentWay,
      auditTotalPrice: auditTotalPrice ? parseFloat(auditTotalPrice) : undefined,
      bezahltDatum: auditBezahltDatum || undefined,
      bankBetrag: auditBankBetrag ? parseFloat(auditBankBetrag) : undefined,
      barBetrag: auditBarBetrag ? parseFloat(auditBarBetrag) : undefined,
      rechnungAusgestellt: auditRechnungAusgestellt,
      rechnungBetrag: auditRechnungBetrag ? parseFloat(auditRechnungBetrag) : undefined,
      rechnungNummer: auditRechnungNummer,
      images: photos.map(p => ({ name: p.name, data: p.base64 })),
    });
  };

  const inp = (v: string, s: (x: string) => void, p?: React.InputHTMLAttributes<HTMLInputElement>) =>
    ro ? <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50 min-h-[38px]">{v || "\u2014"}</div>
       : <Input value={v} onChange={e => s(e.target.value)} {...p} />;

  const sel = (v: string, s: (x: string) => void, opts: string[]) =>
    ro ? <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">{v || "\u2014"}</div>
       : <select className="w-full border rounded px-3 py-2 text-sm" value={v} onChange={e => s(e.target.value)}>
           {opts.map(o => <option key={o}>{o}</option>)}
         </select>;

  const ta = (v: string, s: (x: string) => void, lbl: React.ReactNode) =>
    ro ? <Field label={lbl}><div className="w-full border rounded p-2 text-sm bg-gray-50 min-h-[80px] whitespace-pre-wrap">{v || "\u2014"}</div></Field>
       : <Field label={lbl}><textarea className="w-full border rounded p-2 text-sm h-20 resize-y" value={v} onChange={e => s(e.target.value)} /></Field>;

  if (isLoading) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00aabb] mx-auto mb-3" />
        <p className="text-sm text-gray-600">Lade Daten...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 text-center">
        <p className="text-red-600 mb-4">Fehler beim Laden</p>
        <Button onClick={onClose}>Schliessen</Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-100 rounded-lg w-full max-w-5xl max-h-[95vh] flex flex-col">
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-800">
              {ro ? "\ud83d\udc41 Auftrag anzeigen" : "\u270f\ufe0f Auftrag bearbeiten"} \u2014 Kundennummer {umzugscode}
            </h2>
            {ro && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Nur Ansicht</span>}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateOffer}
              disabled={generateOffer.isPending || !data?.move?.customerId}
              className="border-amber-500 text-amber-700 hover:bg-amber-50 bg-white"
            >
              <FileText size={16} className="mr-1" />
              {generateOffer.isPending ? 'PDF wird erstellt...' : 'Umzug Angebot'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateInvoice}
              disabled={generatingPdf}
              className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 bg-white"
            >
              <FileText size={16} className="mr-1" />
              {generatingPdf ? 'Wird erstellt...' : 'Rechnung erstellen'}
            </Button>
            {!ro && (
              <Button type="button" onClick={handleSave} disabled={updateMove.isPending} className="bg-[#00aabb] hover:bg-[#008899] text-white">
                {updateMove.isPending ? "Speichern..." : "\ud83d\udcbe Speichern"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              <X size={16} className="mr-1" />{ro ? "Schliessen" : "Abbrechen"}
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          <Section title="Kunde" defaultOpen teal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Anrede">{sel(anrede, setAnrede, ["Herr","Frau","Firma"])}</Field>

              <YesNo label="mit Fotos oder umzugsliste" value={mitFotos} onChange={setMitFotos} ro={ro} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Field label="Name">{inp(name, setName, { placeholder: "Vor- und Nachname" })}</Field>

              <Field label="Umzug Termin Von">{inp(terminVon, setTerminVon, { type: "date", placeholder: "Von Datum" })}</Field>
              <Field label="Phone">{inp(phone, setPhone, { placeholder: "0175 0000000" })}</Field>
              <Field label="Filiale">{sel(sitz, setSitz, branchOptions)}</Field>
              <Field label="Umzug Termin Bis">{inp(terminBis, setTerminBis, { type: "date", placeholder: "Bis Datum" })}</Field>
              <Field label="Email">{inp(email, setEmail, { type: "email", placeholder: "email@example.com" })}</Field>
              <Field label="Status">{sel(status2, setStatus2, ["Registriert auf Apex","Angebot gesendet","Bestaetigt","Abgesagt","Abgeschlossen"])}</Field>
              <Field label="Kundennummer">{inp(umzugscode, setUmzugscode, { placeholder: "00001", readOnly: true })}</Field>
              <Field label="Price Brutto (EUR)">{inp(priceBrutto, setPriceBrutto, { type: "number", placeholder: "0" })}</Field>
              <Field label="Versuch">{sel(versuch, setVersuch, ["Versuch 1","Versuch 2","Versuch 3","Versuch 4","Versuch 5","Versuch 6"])}</Field>
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
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                  )}
                  <div className="flex items-center gap-3 ml-2">
                    <label className={`flex items-center gap-1 cursor-pointer text-sm font-medium ${
                      bezahlt ? 'text-green-700' : 'text-gray-500'
                    }`}>
                      <input
                        type="radio"
                        name="bezahlt-dialog"
                        checked={bezahlt === true}
                        onChange={() => { if (!ro) { setBezahlt(true); setAuditIstBezahlt(true); setPaymentStatus('paid'); } }}
                        disabled={ro}
                        className="accent-green-500"
                      />
                      Ja
                    </label>
                    <label className={`flex items-center gap-1 cursor-pointer text-sm font-medium ${
                      !bezahlt ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      <input
                        type="radio"
                        name="bezahlt-dialog"
                        checked={bezahlt === false}
                        onChange={() => { if (!ro) { setBezahlt(false); setAuditIstBezahlt(false); setPaymentStatus('unpaid'); } }}
                        disabled={ro}
                        className="accent-red-500"
                      />
                      Nein
                    </label>
                  </div>
                  {bezahlt && <span className="text-green-600 text-xs font-bold ml-auto">✓ Bezahlt!</span>}
                  {!bezahlt && <span className="text-red-500 text-xs font-medium ml-auto">✗ Ausstehend</span>}
                </div>
              </div>
              <Field label="m3">{inp(m3, setM3, { type: "number", placeholder: "0" })}</Field>
              <Field label="Type">{sel(moveType, setMoveType, ["Umzug","Einlagerung","Transport","Entsorgung"])}</Field>
              <Field label="Auftragsstatus">
                {ro ? <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">{moveStatus}</div>
                    : <select className="w-full border rounded px-3 py-2 text-sm" value={moveStatus} onChange={e => setMoveStatus(e.target.value)}>
                        <option value="pending">Angaben vollständig</option><option value="confirmed">Nachverfolgen</option>
                        <option value="in_progress">Online-besichtigungtermin</option><option value="completed">Besichtigungtermin</option>
                        <option value="cancelled">Absagen</option>
                      </select>}
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Field label="Call Check">{sel(callCheck, setCallCheck, ["Nein","Ja"])}</Field>
              <Field label="Shaden">{sel(shaden, setShaden, ["Nein","Ja"])}</Field>
              <YesNo label="Angebot per Post" value={angebotPerPost} onChange={setAngebotPerPost} ro={ro} />
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Section title="Address">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="Distanz (km)">{inp(distanz, setDistanz, { type: "number", placeholder: "0" })}</Field>
                <Field label="Anfahrt">{inp(anfahrt, setAnfahrt, { type: "number", placeholder: "0" })}</Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-sm mb-2 text-gray-700">Auszugsort</p>
                  <div className="space-y-2">
                    <Field label="Adresse">{inp(auszugsort, setAuszugsort, { placeholder: "Strasse, PLZ Ort" })}</Field>
                    <Field label="Etage">{sel(auszugEtage, setAuszugEtage, etageOpts)}</Field>
                    <Field label="Fahrstuhl">{sel(auszugFahrstuhl, setAuszugFahrstuhl, fahrstuhlOpts)}</Field>
                    <Field label="Laufweg">{sel(auszugLaufweg, setAuszugLaufweg, laufwegOpts)}</Field>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-2 text-gray-700">Einzugsort</p>
                  <div className="space-y-2">
                    <Field label="Adresse">{inp(einzugsort, setEinzugsort, { placeholder: "Strasse, PLZ Ort" })}</Field>
                    <Field label="Etage">{sel(einzugEtage, setEinzugEtage, etageOpts)}</Field>
                    <Field label="Fahrstuhl">{sel(einzugFahrstuhl, setEinzugFahrstuhl, fahrstuhlOpts)}</Field>
                    <Field label="Laufweg">{sel(einzugLaufweg, setEinzugLaufweg, laufwegOpts)}</Field>
                  </div>
                </div>
              </div>
            </Section>
            <Section title="Immobilien">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-sm mb-2 text-gray-700">Auszugsort</p>
                  <div className="space-y-2">
                    <Field label="Wohnflaeche (m2)">{inp(auszugFlaeche, setAuszugFlaeche, { type: "number", placeholder: "0" })}</Field>
                    <Field label="Anzahl Zimmer">{inp(auszugZimmer, setAuszugZimmer, { type: "number", placeholder: "0" })}</Field>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-2 text-gray-700">Einzugsort</p>
                  <div className="space-y-2">
                    <Field label="Wohnflaeche (m2)">{inp(einzugFlaeche, setEinzugFlaeche, { type: "number", placeholder: "0" })}</Field>
                    <Field label="Anzahl Zimmer">{inp(einzugZimmer, setEinzugZimmer, { type: "number", placeholder: "0" })}</Field>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <Section title="Servicess">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="border rounded p-3">
                <p className="font-semibold text-sm mb-3 text-gray-700">Auszugsort</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <YesNo label="Einpackservice" value={einpackservice} onChange={setEinpackservice} ro={ro} />
                    <Field label="Kartons">{inp(einpackKartons, setEinpackKartons, { type: "number" })}</Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <YesNo label="Abbau von Moebeln" value={abbauMoebeln} onChange={setAbbauMoebeln} ro={ro} />
                    <Field label="M3">{inp(abbauMoebelnM3, setAbbauMoebelnM3, { type: "number" })}</Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <YesNo label="Abbau von Kueche" value={abbauKueche} onChange={setAbbauKueche} ro={ro} />
                    <Field label="M3">{inp(abbauKuecheM3, setAbbauKuecheM3, { type: "number" })}</Field>
                  </div>
                  <YesNo label="Parkzone am Auszugsort" value={parkzoneAuszug} onChange={setParkzoneAuszug} ro={ro} />
                </div>
              </div>
              <div className="border rounded p-3">
                <p className="font-semibold text-sm mb-3 text-gray-700">Einzugsort</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <YesNo label="Auspackservice" value={auspackservice} onChange={setAuspackservice} ro={ro} />
                    <Field label="Kartons">{inp(auspackKartons, setAuspackKartons, { type: "number" })}</Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <YesNo label="Aufbau von Moebeln" value={aufbauMoebeln} onChange={setAufbauMoebeln} ro={ro} />
                    <Field label="M3">{inp(aufbauMoebelnM3, setAufbauMoebelnM3, { type: "number" })}</Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <YesNo label="Aufbau von Kueche" value={aufbauKueche} onChange={setAufbauKueche} ro={ro} />
                    <Field label="M3">{inp(aufbauKuecheM3, setAufbauKuecheM3, { type: "number" })}</Field>
                  </div>
                  <YesNo label="Parkzone am Einzugsort" value={parkzoneEinzug} onChange={setParkzoneEinzug} ro={ro} />
                </div>
              </div>
            </div>
            <div className="border rounded p-3 mb-4">
              <p className="font-semibold text-sm mb-3 text-gray-700">Kartons</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Umzugskartons">{inp(umzugskartons, setUmzugskartons, { type: "number" })}</Field>
                <Field label="Kleiderkartons">{inp(kleiderkartons, setKleiderkartons, { type: "number" })}</Field>
                <Field label="Delivery Date">{inp(kartonDelivery, setKartonDelivery, { type: "datetime-local" })}</Field>
                <Field label="Karton geliefert?">{sel(kartonGeliefert, setKartonGeliefert, ["","Ja","Nein"])}</Field>
                <Field label="Datum Parkzone">{inp(parkzoneDatum, setParkzoneDatum, { type: "date" })}</Field>
                <Field label="Parkzone geliefert?">{sel(parkzoneGeliefert, setParkzoneGeliefert, ["","Ja","Nein"])}</Field>
              </div>
            </div>
            <div className="border rounded p-3">
              <p className="font-semibold text-sm mb-3 text-gray-700">Additional services</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <YesNo label="Klaviertransport" value={klaviertransport} onChange={setKlaviertransport} ro={ro} />
                <Field label="Klavier Gross">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {["Nein","Klavier 250","Klavier Gross 650"].map(o => (
                      <label key={o} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="radio" checked={klavierGross === o} onChange={() => !ro && setKlavierGross(o)} disabled={ro} /> {o}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Schwer Transport">{sel(schwerTransport, setSchwerTransport, ["Kein","1 Stueck","2 Stueck","3+ Stueck"])}</Field>
                <YesNo label="Lampen" value={lampen} onChange={setLampen} ro={ro} />
                <Field label="Lampen Ort">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {["Kein","Abmontieren","Anbringen","Beide"].map(o => (
                      <label key={o} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="radio" checked={lampenOrt === o} onChange={() => !ro && setLampenOrt(o)} disabled={ro} /> {o}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Lampen Stueck">{inp(lampenStueck, setLampenStueck, { type: "number" })}</Field>
                <YesNo label="Einlagerung von Moebeln" value={einlagerung} onChange={setEinlagerung} ro={ro} />
                <Field label="Einlagerung Price (EUR)">{inp(einlagerungPrice, setEinlagerungPrice, { type: "number" })}</Field>
                <YesNo label="Endreinigung" value={endreinigung} onChange={setEndreinigung} ro={ro} />
                <YesNo label="Bohr- und Duebelarbeit" value={bohrarbeit} onChange={setBohrarbeit} ro={ro} />
                <Field label="Bohrarbeit Punkt">{inp(bohrarbeitPunkt, setBohrarbeitPunkt, { type: "number" })}</Field>
                <div />
                <YesNo label="Entsorgung von Moebeln" value={entsorgung} onChange={setEntsorgung} ro={ro} />
                <Field label="Entsorgung Type">
                  <div className="flex gap-3 mt-1">
                    {["Normal","Gemischt"].map(o => (
                      <label key={o} className="flex items-center gap-1 text-sm cursor-pointer">
                        <input type="radio" checked={entsorgungType === o} onChange={() => !ro && setEntsorgungType(o)} disabled={ro} /> {o}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Entsorgung M3">{inp(entsorgungM3, setEntsorgungM3, { type: "number" })}</Field>
                <Field label="Aussenlift">{sel(aussenlift, setAussenlift, ["Nein","Ja"])}</Field>
                <Field label="Aussenlift Stunde">{inp(aussenliftStunde, setAussenliftStunde, { type: "number" })}</Field>
                <YesNo label="Anschluss der Waschmaschine" value={anschlussWaschmaschine} onChange={setAnschlussWaschmaschine} ro={ro} />
                <Field label="Sonstige Leistung">{inp(sonstigeLeistung, setSonstigeLeistung, { placeholder: "Beschreibung" })}</Field>
                <Field label="Sonstige Leistung Price (EUR)">{inp(sonstigePrice, setSonstigePrice, { type: "number" })}</Field>
              </div>
            </div>
          </Section>

          <Section title="NOTE">
            <div className="space-y-4">
              {ta(summary, setSummary, <span className="text-red-600 font-semibold">Sammary</span>)}
              {ta(anmerkungen, setAnmerkungen, <span className="text-red-600 font-semibold">Die sehr wichtigen Anmerkungen</span>)}
              {ta(serviceanmerkungen, setServiceanmerkungen, <span className="text-red-600 font-semibold">Die kundenbezogenen Serviceanmerkungen</span>)}
              {ta(moebelListe, setMoebelListe, <span className="text-red-600 font-semibold">Nur die Moebelliste und die dazugehoerigen Anmerkungen</span>)}
              {ta(kundenNote, setKundenNote, <span className="text-red-600 font-semibold">Kunden Note (Bitte geben Sie in diesem Feld keine Preise an.)</span>)}
              {ta(kontaktinfo, setKontaktinfo, <span className="text-red-600 font-semibold">Kontaktinformationen des Kunden</span>)}
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Section title={`Photos and Docs${(existingImages.length + photos.length) > 0 ? ` (${existingImages.length + photos.length})` : ""}`}>
              {existingImages.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Vorhandene Fotos ({existingImages.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {existingImages.map(img => (
                      <a key={img.id} href={img.imageUrl} target="_blank" rel="noreferrer">
                        <img src={img.imageUrl} alt="foto" className="w-full h-20 object-cover rounded border hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!ro && (
                <>
                  <input ref={photoInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoSelect(e.target.files)} />
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#00aabb] hover:bg-blue-50 transition-colors" onClick={() => photoInputRef.current?.click()}>
                    {compressing ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00aabb]" />
                        <p className="text-sm text-[#00aabb]">Komprimiere...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={28} className="text-gray-400" />
                        <p className="text-gray-600 text-sm font-medium">Neue Fotos hinzufuegen</p>
                        <Button type="button" variant="outline" size="sm" className="mt-1"><Upload size={14} className="mr-1" />Fotos auswaehlen</Button>
                      </div>
                    )}
                  </div>
                  {photos.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-600">{photos.length} neue Foto(s)</p>
                        <button type="button" onClick={() => setPhotos([])} className="text-xs text-red-500 hover:text-red-700">Alle entfernen</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {photos.map((photo, idx) => (
                          <div key={idx} className="relative group">
                            <img src={photo.preview} alt={photo.name} className="w-full h-20 object-cover rounded border" />
                            <button type="button" onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {ro && existingImages.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                  <ImageIcon size={32} /><p className="text-sm">Keine Fotos vorhanden</p>
                </div>
              )}
            </Section>
            <Section title="Web Bewertung">
              <div className="space-y-3">
                <Field label="Bewertungsplattform">{sel(bewertungPlatform, setBewertungPlatform, ["","Google","Trustpilot","Yelp"])}</Field>
                <Field label="Bewertung (1-5)">{inp(bewertungScore, setBewertungScore, { type: "number", min: "1", max: "5", placeholder: "0" })}</Field>
                <Field label="Bewertungslink">{inp(bewertungLink, setBewertungLink, { type: "url", placeholder: "https://..." })}</Field>
              </div>
            </Section>
          </div>

          <Section title="Plan">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Geplante Mitarbeiter">{inp(planMitarbeiter, setPlanMitarbeiter, { type: "number", placeholder: "0" })}</Field>
              <Field label="Geplante Fahrzeuge">{inp(planFahrzeuge, setPlanFahrzeuge, { type: "number", placeholder: "0" })}</Field>
              <Field label="Startzeit">{inp(planStartzeit, setPlanStartzeit, { type: "time" })}</Field>
              <Field label="Endzeit (geschaetzt)">{inp(planEndzeit, setPlanEndzeit, { type: "time" })}</Field>
              <div className="md:col-span-2">{ta(planBemerkungen, setPlanBemerkungen, "Bemerkungen zum Plan")}</div>
            </div>
          </Section>

          <Section title="Finanzen">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Anzahlung (EUR)">{inp(anzahlung, setAnzahlung, { type: "number", placeholder: "0" })}</Field>
              <Field label="Restbetrag (EUR)">{inp(restbetrag, setRestbetrag, { type: "number", placeholder: "0" })}</Field>
              <Field label="Zahlungsart">{sel(zahlungsart, setZahlungsart, ["Ueberweisung","Barzahlung","PayPal","Kreditkarte"])}</Field>
              <Field label="Rechnungsnummer">{inp(rechnungNr, setRechnungNr, { placeholder: "RE-00000" })}</Field>
              <div className="md:col-span-2 bg-gray-50 rounded p-3 border">
                <p className="text-sm font-semibold text-gray-700 mb-2">Zusammenfassung</p>
                <div className="flex gap-6 text-sm text-gray-600">
                  <span>Brutto-Preis: <strong>{priceBrutto || 0} EUR</strong></span>
                  <span>Anzahlung: <strong>{anzahlung || 0} EUR</strong></span>
                  <span>Restbetrag: <strong>{restbetrag || 0} EUR</strong></span>
                </div>
                <p className="text-sm mt-1">Status: <span className={`font-bold ${bezahlt ? "text-green-600" : "text-red-600"}`}>{bezahlt ? "Bezahlt" : "Ausstehend"}</span></p>
              </div>
            </div>
          </Section>

          <Section title="Beschwerde, Schaden und Extra volume protocols">
            <div className="space-y-4">
              <div className="border rounded p-3">
                <p className="font-semibold text-sm mb-3 text-red-600">Schaden (Damage Report)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ta(schadenDesc, setSchadenDesc, "Schadensbeschreibung")}
                  <Field label="Geschaetzte Kosten (EUR)">{inp(schadenKosten, setSchadenKosten, { type: "number", placeholder: "0" })}</Field>
                  <Field label="Schadenstatus">{sel(schadenStatus, setSchadenStatus, ["Gemeldet","In Bearbeitung","Abgeschlossen"])}</Field>
                </div>
              </div>
              <div className="border rounded p-3">
                <p className="font-semibold text-sm mb-3 text-orange-600">Beschwerde (Complaint)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ta(beschwerdeDesc, setBeschwerdeDesc, "Beschwerdebeschreibung")}
                  <Field label="Schweregrad">{sel(beschwerdeSchweregard, setBeschwerdeSchweregard, ["Niedrig","Mittel","Hoch","Kritisch"])}</Field>
                </div>
              </div>
              <div className="border rounded p-3">
                <p className="font-semibold text-sm mb-3 text-blue-600">Extra Volume Protocol</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Extra Volumen (m3)">{inp(extraVolumen, setExtraVolumen, { type: "number", placeholder: "0" })}</Field>
                  <Field label="Extra Preis (EUR)">{inp(extraPreis, setExtraPreis, { type: "number", placeholder: "0" })}</Field>
                  <div className="md:col-span-2">{ta(extraBemerkungen, setExtraBemerkungen, "Bemerkungen")}</div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Audits">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Betzhlt von">
                  {ro ? <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">{auditBezahltVon}</div>
                      : <select className="w-full border rounded px-3 py-2 text-sm" value={auditBezahltVon} onChange={e => setAuditBezahltVon(e.target.value)}>
                          <option>Kunde</option><option>Firma</option>
                        </select>}
                </Field>
                <Field label="Betzhal kunde">{inp(auditBetzhalKunde, setAuditBetzhalKunde, { placeholder: "Name des Zahlers" })}</Field>
              </div>

              <div className={`flex items-center gap-6 rounded-lg px-4 py-3 transition-all duration-500 ${auditIstBezahlt ? 'bg-green-50 border border-green-300' : 'bg-gray-50 border border-gray-200'}`}>
                <span className={`text-sm font-semibold transition-colors duration-500 ${auditIstBezahlt ? 'text-green-700' : 'text-gray-700'}`}>Ist bezahlt</span>
                {auditIstBezahlt && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                )}
                {ro ? <span className={`font-bold text-sm px-3 py-1 rounded-full ${auditIstBezahlt ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{auditIstBezahlt ? '✓ BEZAHLT' : '✗ UNBEZAHLT'}</span>
                    : <>
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer font-medium">
                          <input type="radio" name="auditIstBezahlt" checked={auditIstBezahlt} onChange={() => { setAuditIstBezahlt(true); setBezahlt(true); setPaymentStatus('paid'); }} className="accent-green-600" />
                          <span className={auditIstBezahlt ? 'text-green-700 font-bold' : 'text-gray-600'}>Ja</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer font-medium">
                          <input type="radio" name="auditIstBezahlt" checked={!auditIstBezahlt} onChange={() => { setAuditIstBezahlt(false); setBezahlt(false); setPaymentStatus('unpaid'); }} className="accent-red-500" />
                          <span className={!auditIstBezahlt ? 'text-red-600 font-bold' : 'text-gray-600'}>Nein</span>
                        </label>
                        {auditIstBezahlt && <span className="ml-2 text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full animate-pulse">✓ Bezahlt!</span>}
                      </>}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 font-semibold text-sm text-gray-700">Data</div>
                <div className="p-4 space-y-4">
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 font-semibold text-sm text-gray-700">Payment</div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Payment way">
                          {ro ? <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">{auditPaymentWay}</div>
                              : <div className="flex items-center gap-4 pt-1">
                                  {["Bank", "Bank and Bar", "Bar"].map(opt => (
                                    <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                      <input type="radio" name="auditPaymentWay" value={opt} checked={auditPaymentWay === opt} onChange={() => setAuditPaymentWay(opt)} className="accent-[#00aabb]" />
                                      {opt}
                                    </label>
                                  ))}
                                </div>}
                        </Field>
                        <Field label="Total Price">{inp(auditTotalPrice, setAuditTotalPrice, { type: "number", placeholder: "0" })}</Field>
                        <Field label="Betzhlt Datum">{inp(auditBezahltDatum, setAuditBezahltDatum, { type: "date" })}</Field>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Bank">{inp(auditBankBetrag, setAuditBankBetrag, { type: "number", placeholder: "0" })}</Field>
                        <Field label="Bar">{inp(auditBarBetrag, setAuditBarBetrag, { type: "number", placeholder: "0" })}</Field>
                      </div>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 font-semibold text-sm text-gray-700">Rechnung</div>
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Rechnung">
                          {ro ? <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">{auditRechnungAusgestellt ? 'Ja' : 'Nein'}</div>
                              : <div className="flex items-center gap-4 pt-1">
                                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                    <input type="radio" name="auditRechnung" checked={auditRechnungAusgestellt} onChange={() => setAuditRechnungAusgestellt(true)} className="accent-[#00aabb]" />
                                    Ja
                                  </label>
                                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                    <input type="radio" name="auditRechnung" checked={!auditRechnungAusgestellt} onChange={() => setAuditRechnungAusgestellt(false)} className="accent-[#00aabb]" />
                                    Nein
                                  </label>
                                </div>}
                        </Field>
                        <Field label="Rechnung Betrag">{inp(auditRechnungBetrag, setAuditRechnungBetrag, { type: "number", placeholder: "0" })}</Field>
                        <Field label="Rechnung Nummer">{inp(auditRechnungNummer, setAuditRechnungNummer, { placeholder: "RE-00000" })}</Field>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Nachrichten">
            <p className="text-xs text-gray-500 mb-3">Klicken Sie auf eine Nachricht, um sie zu oeffnen und zu kopieren.</p>
            <div className="space-y-2">
              {[
                { key: "willkommen", label: "Willkommen Nachricht Frankfurt" },
                { key: "ersteNachricht", label: "Erste Nachricht Frankfurt" },
                { key: "angebotSchicken", label: "Angebot schicken Frankfurt" },
                { key: "angebotBestaetigt", label: "Angebot Bestaetigt Frankfurt" },
                { key: "absage", label: "Absage Frankfurt" },
                { key: "nachverfolgen", label: "Nachverfolgen" },
                { key: "rechnungDaten", label: "Rechnung daten" },
                { key: "angepassteAngebot", label: "Das angepasste Angebot" },
              ].map(({ key, label }) => (
                <MessageItem key={key} label={label} message={buildMessage(key)} copied={copied === key} onCopy={() => copyMessage(key)} />
              ))}
            </div>
          </Section>

          {!ro && (
            <div className="flex justify-end gap-3 pt-4 pb-6">
              <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button type="button" onClick={handleSave} disabled={updateMove.isPending} className="bg-[#00aabb] hover:bg-[#008899] text-white px-8">
                {updateMove.isPending ? "Speichern..." : "\ud83d\udcbe Speichern"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
