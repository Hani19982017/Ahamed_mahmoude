/**
 * German Invoice Template
 * Professional invoice template for Umzug services
 */

export interface InvoiceData {
  // Company info (hardcoded for now)
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTaxId?: string;
  
  // Bank info
  bankName?: string;
  bankIban?: string;
  bankBic?: string;
  
  // Customer info
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  
  // Invoice details
  invoiceNumber: string;
  invoiceDate: string;
  moveDate: string;
  
  // Service details
  serviceDescription: string;
  totalAmount: number; // in cents
  
  // Payment info
  isPaid: boolean;
  paymentDate?: string;
  paymentMethod?: string; // Bank, Bar, Bank and Bar
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const formattedAmount = (data.totalAmount / 100).toFixed(2);
  const isPaidText = data.isPaid ? 'BEZAHLT' : 'UNBEZAHLT';
  const isPaidColor = data.isPaid ? '#10b981' : '#ef4444';
  
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1f2937;
      padding: 40px;
      background: white;
    }
    
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #0891b2;
    }
    
    .company-info {
      flex: 1;
    }
    
    .company-name {
      font-size: 24pt;
      font-weight: bold;
      color: #0891b2;
      margin-bottom: 8px;
    }
    
    .company-details {
      font-size: 10pt;
      color: #6b7280;
      line-height: 1.5;
    }
    
    .invoice-title {
      text-align: right;
      flex: 1;
    }
    
    .invoice-title h1 {
      font-size: 32pt;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 8px;
    }
    
    .invoice-number {
      font-size: 12pt;
      color: #6b7280;
      margin-bottom: 4px;
    }
    
    .payment-status {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 11pt;
      margin-top: 8px;
      background-color: ${isPaidColor};
      color: white;
    }
    
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    
    .address-block {
      flex: 1;
    }
    
    .address-block h3 {
      font-size: 11pt;
      font-weight: bold;
      color: #0891b2;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .address-block p {
      font-size: 10pt;
      line-height: 1.6;
      color: #374151;
    }
    
    .invoice-details {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .detail-row:last-child {
      border-bottom: none;
    }
    
    .detail-label {
      font-weight: 600;
      color: #6b7280;
      font-size: 10pt;
    }
    
    .detail-value {
      color: #1f2937;
      font-size: 10pt;
    }
    
    .services-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .services-table thead {
      background: #0891b2;
      color: white;
    }
    
    .services-table th {
      padding: 12px;
      text-align: left;
      font-size: 10pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .services-table td {
      padding: 16px 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 10pt;
    }
    
    .services-table tbody tr:last-child td {
      border-bottom: 2px solid #0891b2;
    }
    
    .text-right {
      text-align: right;
    }
    
    .total-section {
      margin-top: 20px;
      text-align: right;
    }
    
    .total-row {
      display: flex;
      justify-content: flex-end;
      padding: 10px 0;
      font-size: 11pt;
    }
    
    .total-label {
      min-width: 200px;
      text-align: right;
      padding-right: 20px;
      font-weight: 600;
      color: #6b7280;
    }
    
    .total-value {
      min-width: 150px;
      text-align: right;
      font-weight: bold;
    }
    
    .grand-total {
      border-top: 2px solid #0891b2;
      margin-top: 10px;
      padding-top: 10px;
    }
    
    .grand-total .total-label,
    .grand-total .total-value {
      font-size: 14pt;
      color: #0891b2;
    }
    
    .payment-info {
      background: #f0f9ff;
      border-left: 4px solid #0891b2;
      padding: 20px;
      margin-top: 30px;
      border-radius: 4px;
    }
    
    .payment-info h3 {
      font-size: 12pt;
      font-weight: bold;
      color: #0891b2;
      margin-bottom: 12px;
    }
    
    .payment-info p {
      font-size: 10pt;
      line-height: 1.8;
      color: #374151;
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #9ca3af;
    }
    
    .footer p {
      margin: 4px 0;
    }
    
    .kleinunternehmer {
      margin-top: 20px;
      padding: 12px;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 4px;
      font-size: 9pt;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <div class="company-name">${data.companyName}</div>
        <div class="company-details">
          ${data.companyAddress}<br>
          Tel: ${data.companyPhone}<br>
          E-Mail: ${data.companyEmail}
          ${data.companyTaxId ? `<br>Steuernummer: ${data.companyTaxId}` : ''}
        </div>
      </div>
      <div class="invoice-title">
        <h1>RECHNUNG</h1>
        <div class="invoice-number">Nr. ${data.invoiceNumber}</div>
        <div class="invoice-number">Datum: ${data.invoiceDate}</div>
        <div class="payment-status">${isPaidText}</div>
      </div>
    </div>
    
    <!-- Addresses -->
    <div class="addresses">
      <div class="address-block">
        <h3>Rechnungsempfänger</h3>
        <p>
          <strong>${data.customerName}</strong><br>
          ${data.customerAddress}<br>
          Tel: ${data.customerPhone}<br>
          E-Mail: ${data.customerEmail}
        </p>
      </div>
      <div class="address-block">
        <h3>Leistungsdatum</h3>
        <p>
          <strong>${data.moveDate}</strong>
        </p>
      </div>
    </div>
    
    <!-- Services Table -->
    <table class="services-table">
      <thead>
        <tr>
          <th style="width: 60%;">Beschreibung</th>
          <th style="width: 20%;" class="text-right">Menge</th>
          <th style="width: 20%;" class="text-right">Betrag</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${data.serviceDescription}</td>
          <td class="text-right">1</td>
          <td class="text-right">${formattedAmount} €</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Total Section -->
    <div class="total-section">
      <div class="total-row">
        <div class="total-label">Zwischensumme:</div>
        <div class="total-value">${formattedAmount} €</div>
      </div>
      <div class="total-row grand-total">
        <div class="total-label">Gesamtbetrag:</div>
        <div class="total-value">${formattedAmount} €</div>
      </div>
    </div>
    
    <!-- Kleinunternehmer Notice -->
    <div class="kleinunternehmer">
      <strong>Hinweis:</strong> Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).
    </div>
    
    ${data.isPaid ? `
    <!-- Payment Confirmation -->
    <div class="payment-info">
      <h3>✓ Zahlung erhalten</h3>
      <p>
        <strong>Zahlungsdatum:</strong> ${data.paymentDate || 'N/A'}<br>
        <strong>Zahlungsart:</strong> ${data.paymentMethod || 'N/A'}
      </p>
      <p style="margin-top: 12px; font-weight: 600; color: #10b981;">
        Vielen Dank für Ihre Zahlung!
      </p>
    </div>
    ` : `
    <!-- Payment Instructions -->
    <div class="payment-info">
      <h3>Zahlungsinformationen</h3>
      <p>
        Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:
      </p>
      ${data.bankName && data.bankIban ? `
      <p style="margin-top: 12px;">
        <strong>Bank:</strong> ${data.bankName}<br>
        <strong>IBAN:</strong> ${data.bankIban}<br>
        ${data.bankBic ? `<strong>BIC:</strong> ${data.bankBic}<br>` : ''}
        <strong>Verwendungszweck:</strong> Rechnung ${data.invoiceNumber}
      </p>
      ` : ''}
    </div>
    `}
    
    <!-- Footer -->
    <div class="footer">
      <p>${data.companyName} • ${data.companyAddress}</p>
      <p>Tel: ${data.companyPhone} • E-Mail: ${data.companyEmail}</p>
      ${data.companyTaxId ? `<p>Steuernummer: ${data.companyTaxId}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
}
