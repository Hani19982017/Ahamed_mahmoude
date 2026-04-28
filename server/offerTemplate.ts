/**
 * Umzug Angebot — PDF template (user-supplied design).
 *
 * Renders the 5-page Move Profis Umzug Angebot using the design uploaded
 * by the customer (header bar, CHECK24 badges, full-page artwork for
 * pages 4 and 5).
 *
 * Image strategy
 * --------------
 * The 5 PNG assets live next to this file in `assets/offer/`. They are
 * read from disk ONCE on first call and cached as base64 data URLs in
 * memory. The HTML returned by `generateOfferHTML()` has the data URLs
 * inlined directly, so Puppeteer doesn't have to fetch anything over
 * the network — it works regardless of whether the server has internet
 * access and regardless of how the app is deployed.
 *
 * Public contract
 * ---------------
 * The exported interface and function signature match the previous
 * version exactly, so `server/routers/customers.ts` does not need to
 * change.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface OfferTemplateData {
  kundenummer: string;
  moveDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupAddress: string;
  pickupFloor: string;
  pickupElevator: string;
  pickupWalkway: string;
  deliveryAddress: string;
  deliveryFloor: string;
  deliveryElevator: string;
  deliveryWalkway: string;
  distanceKm: string;
  volumeM3: string;
  grossPrice: string;
  nettoPrice: string;
  packageName: string;
  serviceSummary: string;
  greetingLine: string;
}

// ── Asset loading & caching ───────────────────────────────────────────────
// Resolve `assets/offer/` relative to this source file. Works whether the
// project is run with `tsx` in dev or as compiled JS in production.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSET_DIR = join(__dirname, "assets", "offer");

interface OfferAssets {
  header: string;
  badge2024: string;
  badge2025: string;
  page4: string;
  page5: string;
}

let cachedAssets: OfferAssets | null = null;

function loadAsset(filename: string, mime = "image/png"): string {
  const data = readFileSync(join(ASSET_DIR, filename));
  return `data:${mime};base64,${data.toString("base64")}`;
}

function getAssets(): OfferAssets {
  if (!cachedAssets) {
    cachedAssets = {
      header: loadAsset("header.png"),
      badge2024: loadAsset("badge_2024.png"),
      badge2025: loadAsset("badge_2025.png"),
      page4: loadAsset("page4_top_tipps.png"),
      page5: loadAsset("page5_vertrauen.png"),
    };
  }
  return cachedAssets;
}

// ── String helpers ────────────────────────────────────────────────────────
function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function multilineHtml(value: string | null | undefined): string {
  return escapeHtml(value)
    .split(/\n+/)
    .filter(Boolean)
    .join("<br>");
}

function addressCell(value: string | null | undefined): string {
  return multilineHtml(value);
}

// Turn `serviceSummary` (newline-separated extra services) into list items
// that fill the dynamic rows on page 2. Up to 11 lines fit; extra are dropped.
function renderServiceLines(value: string | null | undefined): string {
  const lines = String(value ?? "")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 11);
  while (lines.length < 11) {
    lines.push("");
  }
  return lines
    .map(line =>
      line.length > 0
        ? `<div class="empty-line">${escapeHtml(line)}</div>`
        : `<div class="empty-line"></div>`,
    )
    .join("\n            ");
}

function valueOrBlank(value: string | null | undefined): string {
  const trimmed = (value ?? "").toString().trim();
  return trimmed.length > 0 ? escapeHtml(trimmed) : "";
}

// ── Template ──────────────────────────────────────────────────────────────
export function generateOfferHTML(data: OfferTemplateData): string {
  const assets = getAssets();

  const greeting = (data.greetingLine || "Sehr geehrte Damen und Herren,").trim();

  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Umzug Angebot ${escapeHtml(data.kundenummer)} - Move Profis</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-orange: #F39200;
            --primary-blue: #003366;
            --light-gray: #f9f9f9;
            --text-color: #333;
        }
        @page {
            size: A4;
            margin: 0;
        }
        body {
            font-family: 'Montserrat', sans-serif;
            margin: 0;
            padding: 0;
            color: var(--text-color);
            line-height: 1.4;
            background: #eee;
        }
        .page {
            width: 210mm;
            height: 297mm;
            padding: 10mm 20mm;
            margin: 0 auto;
            box-sizing: border-box;
            position: relative;
            background: white;
            page-break-after: always;
            overflow: hidden;
        }
        .page:last-child { page-break-after: auto; }
        .header-full {
            width: 100%;
            margin-bottom: 10px;
        }
        .header-img {
            width: 100%;
            display: block;
        }
        .section-title {
            color: var(--primary-blue);
            border-bottom: 3px solid var(--primary-orange);
            padding-bottom: 5px;
            margin-top: 15px;
            margin-bottom: 10px;
            font-size: 18px;
            text-transform: uppercase;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 8px;
            margin-bottom: 15px;
        }
        .info-label {
            font-weight: 700;
            color: var(--primary-blue);
            font-size: 14px;
            align-self: center;
        }
        .info-value {
            background: var(--light-gray);
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid #eee;
            min-height: 16px;
            font-size: 13px;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
        }
        .table th {
            background: #e9ecef;
            color: var(--primary-blue);
            text-align: left;
            padding: 8px;
            font-weight: 700;
            font-size: 14px;
        }
        .table td {
            padding: 8px;
            border-bottom: 1px solid #eee;
            font-size: 13px;
            vertical-align: top;
        }
        .footer-logos {
            position: absolute;
            bottom: 10mm;
            left: 0;
            right: 0;
            display: flex;
            justify-content: center;
            gap: 40px;
        }
        .badge-img {
            height: 70px;
        }
        .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 15px;
        }
        .sig-field {
            border-bottom: 1px solid #333;
            margin-top: 25px;
            padding-bottom: 5px;
            font-size: 12px;
            font-weight: 700;
        }
        .empty-line {
            border-bottom: 1px solid #ddd;
            min-height: 28px;
            padding: 4px 6px;
            margin-bottom: 5px;
            font-size: 13px;
        }
        .full-page-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }
        .page-no-padding {
            padding: 0;
        }
        .id-pill {
            background: #ffd8a8;
            padding: 4px 15px;
            border-radius: 4px;
            display: inline-block;
            font-weight: 700;
        }
        .id-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 13px;
            padding: 0 10px;
        }
        .route-box {
            background: var(--light-gray);
            padding: 12px;
            border-radius: 10px;
            border-left: 5px solid var(--primary-orange);
        }
        .route-box p { margin: 0; font-size: 14px; line-height: 1.8; }
        .route-box p + p { margin-top: 4px; }
        .price-box {
            margin-top: 30px;
            padding: 15px;
            border: 2px dashed var(--primary-blue);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 22px;
            font-weight: 700;
            color: var(--primary-blue);
        }
        .price-box .price-amount {
            color: var(--primary-orange);
        }
        .price-box .mwst {
            font-size: 14px;
            font-weight: 700;
        }
        .bezahlung-box {
            background: #fff3e0;
            padding: 15px;
            border-radius: 8px;
            margin-top: 40px;
            font-size: 12px;
            border: 1px solid var(--primary-orange);
            line-height: 1.6;
        }
        .leistungen-list {
            list-style: none;
            padding: 0;
            margin-bottom: 0;
        }
        .leistungen-list li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        .leistungen-list li::before {
            content: "• ";
            color: var(--primary-orange);
            font-weight: 700;
            margin-right: 6px;
        }
    </style>
</head>
<body>
    <!-- Page 1 -->
    <div class="page">
        <div class="header-full">
            <img src="${assets.header}" class="header-img">
        </div>

        <div class="id-row">
            <div><strong>UMZUGS-ID:</strong> <span class="id-pill">${escapeHtml(data.kundenummer)}</span></div>
            <div><strong>UMZUGSDATUM:</strong> ${escapeHtml(data.moveDate)}</div>
        </div>

        <h2 class="section-title">Ihre Angaben zum Umzug</h2>
        <div class="info-grid">
            <div class="info-label">Name</div><div class="info-value">${valueOrBlank(data.customerName)}</div>
            <div class="info-label">E-mail</div><div class="info-value">${valueOrBlank(data.customerEmail)}</div>
            <div class="info-label">Rufnummer</div><div class="info-value">${valueOrBlank(data.customerPhone)}</div>
        </div>

        <table class="table">
            <thead>
                <tr>
                    <th style="width: 40%;">DESCRIPTION</th>
                    <th style="width: 30%;">AUSZUG</th>
                    <th style="width: 30%;">EINZUG</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>Datum*</td><td>${valueOrBlank(data.moveDate)}</td><td>${valueOrBlank(data.moveDate)}</td></tr>
                <tr><td>Etage*</td><td>${valueOrBlank(data.pickupFloor)}</td><td>${valueOrBlank(data.deliveryFloor)}</td></tr>
                <tr><td>Fahrstuhl Kapazität</td><td>${valueOrBlank(data.pickupElevator)}</td><td>${valueOrBlank(data.deliveryElevator)}</td></tr>
                <tr><td>Fußweg*</td><td>${valueOrBlank(data.pickupWalkway)}</td><td>${valueOrBlank(data.deliveryWalkway)}</td></tr>
                <tr><td>Adresse</td><td>${addressCell(data.pickupAddress)}</td><td>${addressCell(data.deliveryAddress)}</td></tr>
            </tbody>
        </table>

        <p style="font-size: 10px; margin-top: 15px; color: #777; font-style: italic;">* Bitte lesen Sie die Informationen über unseren Umzug in diesem Dokument!</p>

        <div class="footer-logos">
            <img src="${assets.badge2025}" class="badge-img">
            <img src="${assets.badge2024}" class="badge-img">
        </div>
    </div>

    <!-- Page 2 -->
    <div class="page">
        <div class="header-full">
            <img src="${assets.header}" class="header-img">
        </div>

        <h2 class="section-title">Ihr Umzugsangebot</h2>
        <div class="route-box">
            <p>Umzug von <strong>${valueOrBlank(data.pickupAddress)}</strong></p>
            <p>nach <strong>${valueOrBlank(data.deliveryAddress)}</strong></p>
            <p><strong>Distanz:</strong> ${escapeHtml(data.distanceKm)} km</p>
        </div>

        <h2 class="section-title">PACKAGE${data.packageName ? ` <span style="font-size:14px; color:var(--primary-orange); margin-left:10px;">— ${escapeHtml(data.packageName)}</span>` : ""}</h2>
        <p style="font-size: 15px; margin-bottom: 8px;"><strong>Volumen von ( ${escapeHtml(data.volumeM3)} m³)</strong></p>

        <h3 style="color: var(--primary-blue); margin-top: 10px; font-size: 16px; margin-bottom: 8px;">LEISTUNGEN</h3>
        <ul class="leistungen-list">
            <li>Umzugsversicherung</li>
            <li>Ab/Anfahrt</li>
            <li>Be- und Entladung</li>
            <li>Bereitstellung von Luftpolsterfolie und Umzugsfolienrollen</li>
        </ul>

        <div style="margin-top: 12px;">
            ${renderServiceLines(data.serviceSummary)}
        </div>

        <div class="footer-logos">
            <img src="${assets.badge2025}" class="badge-img">
            <img src="${assets.badge2024}" class="badge-img">
        </div>
    </div>

    <!-- Page 3 -->
    <div class="page">
        <div class="header-full">
            <img src="${assets.header}" class="header-img">
        </div>

        <div class="price-box">
            <span>Brutto Gesamtpreis</span>
            <span class="price-amount">${escapeHtml(data.grossPrice)} €</span>
            <span class="mwst">Inkl. 19% MwSt.</span>
        </div>

        <p style="margin-top: 30px; font-size: 14px;">Hiermit bestätige ich, dass ich dem Umzugsangebot verbindlich annehmen möchte.</p>

        <div class="signature-section">
            <div>
                <div class="sig-field">Name: ${valueOrBlank(data.customerName)}</div>
                <div class="sig-field">Vorname:</div>
                <div class="sig-field">Unterschrift:</div>
            </div>
            <div>
                <div class="sig-field">Ort:</div>
                <div class="sig-field">Datum: ${valueOrBlank(data.moveDate)}</div>
            </div>
        </div>

        <div class="bezahlung-box">
            <strong style="color: var(--primary-orange);">BEZAHLUNG</strong><br>
            <strong>Überweisung:</strong> Bitte überweisen Sie den Betrag spätestens 5 Tage vor dem Umzugstermin.<br>
            <strong>Barzahlung:</strong> Sie können den Betrag auch am Tag des Umzugs in bar bezahlen.
        </div>

        <div class="footer-logos">
            <img src="${assets.badge2025}" class="badge-img">
            <img src="${assets.badge2024}" class="badge-img">
        </div>
    </div>

    <!-- Page 4 — Top-Tipps (static artwork) -->
    <div class="page page-no-padding">
        <img src="${assets.page4}" class="full-page-img">
    </div>

    <!-- Page 5 — Vertrauen Sie auf uns (static artwork) -->
    <div class="page page-no-padding">
        <img src="${assets.page5}" class="full-page-img">
        <!-- Greeting line "${escapeHtml(greeting)}" is rendered inside the static artwork -->
    </div>
</body>
</html>`;
}
