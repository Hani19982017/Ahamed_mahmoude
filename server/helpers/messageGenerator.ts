import { formatCustomerNumber } from "../../shared/customerNumber";

/**
 * Template variables that can be used in message templates
 */
export interface TemplateVariables {
  customerFirstName: string;
  customerLastName: string;
  customerFullName: string;
  kundenummer: string;
  moveCode: string;
  pickupDate: string;
  deliveryDate: string;
  volume: string;
  grossPrice: string;
  distance: string;
  pickupAddress: string;
  deliveryAddress: string;
  [key: string]: string;
}

/**
 * Generate template variables from customer and move data
 */
export function generateTemplateVariables(customer: any, move: any): TemplateVariables {
  const pickupDate = move.pickupDate ? new Date(move.pickupDate).toLocaleDateString("de-DE") : "";
  const deliveryDate = move.deliveryDate ? new Date(move.deliveryDate).toLocaleDateString("de-DE") : "";
  const kundenummer = customer?.kundenummer || formatCustomerNumber(customer?.id ?? move?.customerId);

  return {
    customerFirstName: customer.firstName || "",
    customerLastName: customer.lastName || "",
    customerFullName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
    kundenummer,
    moveCode: kundenummer || move.moveCode || "",
    pickupDate,
    deliveryDate,
    volume: move.volume ? `${move.volume} m³` : "",
    grossPrice: move.grossPrice ? `${(move.grossPrice / 100).toFixed(2)} €` : "",
    distance: move.distance ? `${move.distance} km` : "",
    pickupAddress: move.pickupAddress || "",
    deliveryAddress: move.deliveryAddress || "",
  };
}

/**
 * Replace template variables in content
 */
export function replaceTemplateVariables(content: string, variables: TemplateVariables): string {
  let result = content;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, value);
  });

  return result;
}

/**
 * Default German message template
 */
export const DEFAULT_GERMAN_TEMPLATE = `Hallo {{customerFirstName}} {{customerLastName}},

anbei erhalten Sie Ihr individuelles Umzugsangebot mit der Kundennummer ({{kundenummer}}).

Zusammenfassung der Angebotsdetails:
📅 Umzugsdatum: {{pickupDate}}
📦 Berechnetes Volumen: {{volume}}
💰 Brutto-Preis: {{grossPrice}}
📍 Auszugsort: {{pickupAddress}}
🏠 Einzugsort: {{deliveryAddress}}
🚛 Distanz: {{distance}}

Bitte geben Sie bei Rückfragen immer Ihre Kundennummer {{kundenummer}} an.

Warum sollten Sie sich für uns entscheiden?
✅ Zuverlässigkeit & Erfahrung: Jahrelange Erfahrung im Umzugsbereich – wir wissen, worauf es ankommt!
✅ Pünktliches Erscheinen: Unsere Teams sind zuverlässig und erscheinen zur vereinbarten Zeit.
✅ Genügend Einsatzkräfte: Wir stellen sicher, dass ausreichend Personal für einen schnellen und reibungslosen Umzug vorhanden ist.
✅ Faire Preise: Transparente und wettbewerbsfähige Preise ohne versteckte Kosten.
✅ Sorgfältiger Umgang mit Ihrem Eigentum: Unsere geschulten Mitarbeiter behandeln Ihr Umzugsgut mit höchster Sorgfalt.
✅ Flexibilität: Sie können Ihr Umzugsdatum und viele weitere Details später kostenlos anpassen!
✅ Festpreis-Garantie: Keine versteckten Kosten – Sie zahlen genau den vereinbarten Preis!
✅ Zufriedenheitsgarantie: Ihre Zufriedenheit steht an erster Stelle – wir arbeiten professionell und zuverlässig, damit Ihr Umzug stressfrei verläuft!

So können Sie uns beauftragen:
✔ Zur Reservierung Ihres Umzugstermins reicht eine schriftliche Bestätigung hier im Chat.
✔ Später können Sie uns das unterschriebene Angebot zukommen lassen.

🔹 Zahlungsinformationen:
💳 Überweisung: (vorab, spätestens 7 Tage vor dem Umzugstag)
💵 Barzahlung: am Umzugstag (vor der Entladung)

Bitte prüfen Sie das Angebot und geben Sie uns eine Rückmeldung, ob Sie den Umzug mit uns durchführen möchten. Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.

Mit freundlichen Grüßen,

Check Umzug
📞 WhatsApp: 0234 60142460
✉️ E-Mail: info@frankfurtcheckumzug.de
🌍 Web: www.checkumzug.de
📠 Fax: 02343 6714070

📍 Unsere Standorte:
Hannover, München, Grünwald, Stuttgart, Hamburg, Frankfurt, Düsseldorf`;

/**
 * Generate a message from template and variables
 */
export function generateMessage(template: string, variables: TemplateVariables): string {
  return replaceTemplateVariables(template, variables);
}

/**
 * Copy text to clipboard (client-side helper)
 */
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    try {
      document.execCommand("copy");
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(textArea);
    }
  });
}
