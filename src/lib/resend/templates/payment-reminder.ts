type PaymentReminderData = {
  orderNumber: string;
  customerName: string;
  total: number;
  paymentDueDate: string;
  daysPastDue: number;
  reminderStage: 1 | 2 | 3; // 1=friendly, 2=final notice, 3=debt collection warning
  locale: string;
};

const labels: Record<string, Record<string, Record<string, string>>> = {
  de: {
    "1": {
      subject: "Zahlungserinnerung",
      heading: "Zahlungserinnerung",
      body: "wir möchten Sie freundlich daran erinnern, dass die Zahlung für die folgende Bestellung noch aussteht.",
      action: "Bitte überweisen Sie den ausstehenden Betrag in den nächsten Tagen auf unser Konto.",
      closing: "Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese E-Mail bitte als gegenstandslos.",
    },
    "2": {
      subject: "Zweite Zahlungserinnerung",
      heading: "Zweite Zahlungserinnerung",
      body: "trotz unserer ersten Erinnerung konnten wir leider noch keinen Zahlungseingang für die folgende Bestellung feststellen.",
      action: "Wir bitten Sie dringend, den ausstehenden Betrag innerhalb von 7 Tagen zu überweisen.",
      closing: "Sollte die Zahlung bereits erfolgt sein, kontaktieren Sie uns bitte unter info@dutchgreenalternative.nl mit Ihrem Zahlungsnachweis.",
    },
    "3": {
      subject: "Letzte Mahnung vor Inkasso",
      heading: "Letzte Mahnung",
      body: "trotz mehrfacher Erinnerungen ist die Zahlung für die folgende Bestellung immer noch nicht bei uns eingegangen.",
      action: "Dies ist unsere letzte Mahnung. Sollte der ausstehende Betrag nicht innerhalb von 7 Tagen auf unserem Konto eingehen, sehen wir uns gezwungen, die Forderung an ein Inkassounternehmen zu übergeben. Dadurch entstehen Ihnen zusätzliche Kosten.",
      closing: "Sollte die Zahlung bereits erfolgt sein, kontaktieren Sie uns umgehend unter info@dutchgreenalternative.nl.",
    },
  },
  nl: {
    "1": {
      subject: "Betalingsherinnering",
      heading: "Betalingsherinnering",
      body: "wij willen u er vriendelijk aan herinneren dat de betaling voor de volgende bestelling nog openstaat.",
      action: "Wij verzoeken u het openstaande bedrag binnen enkele dagen naar onze rekening over te maken.",
      closing: "Mocht u de betaling reeds hebben voldaan, dan kunt u dit bericht als niet verzonden beschouwen.",
    },
    "2": {
      subject: "Tweede betalingsherinnering",
      heading: "Tweede betalingsherinnering",
      body: "ondanks onze eerdere herinnering hebben wij helaas nog geen betaling ontvangen voor de volgende bestelling.",
      action: "Wij verzoeken u dringend het openstaande bedrag binnen 7 dagen over te maken.",
      closing: "Indien u de betaling reeds heeft voldaan, neem dan contact met ons op via info@dutchgreenalternative.nl met uw betalingsbewijs.",
    },
    "3": {
      subject: "Laatste aanmaning voor incasso",
      heading: "Laatste aanmaning",
      body: "ondanks meerdere herinneringen hebben wij de betaling voor de volgende bestelling nog niet ontvangen.",
      action: "Dit is onze laatste aanmaning. Indien het openstaande bedrag niet binnen 7 dagen op onze rekening wordt bijgeschreven, zijn wij genoodzaakt de vordering over te dragen aan een incassobureau. Dit brengt extra kosten voor u met zich mee.",
      closing: "Mocht de betaling reeds zijn voldaan, neem dan direct contact met ons op via info@dutchgreenalternative.nl.",
    },
  },
  en: {
    "1": {
      subject: "Payment Reminder",
      heading: "Payment Reminder",
      body: "we would like to kindly remind you that the payment for the following order is still outstanding.",
      action: "Please transfer the outstanding amount to our account within the next few days.",
      closing: "If you have already made the payment, please disregard this email.",
    },
    "2": {
      subject: "Second Payment Reminder",
      heading: "Second Payment Reminder",
      body: "despite our previous reminder, we have unfortunately not yet received payment for the following order.",
      action: "We urgently request that you transfer the outstanding amount within 7 days.",
      closing: "If the payment has already been made, please contact us at info@dutchgreenalternative.nl with your proof of payment.",
    },
    "3": {
      subject: "Final Notice Before Debt Collection",
      heading: "Final Notice",
      body: "despite multiple reminders, we have still not received payment for the following order.",
      action: "This is our final notice. If the outstanding amount is not received in our account within 7 days, we will be forced to hand over the claim to a debt collection agency. This will result in additional costs for you.",
      closing: "If the payment has already been made, please contact us immediately at info@dutchgreenalternative.nl.",
    },
  },
};

const commonLabels: Record<string, Record<string, string>> = {
  de: {
    dear: "Sehr geehrte(r)",
    orderNumber: "Bestellnummer",
    amount: "Ausstehender Betrag",
    dueDate: "Fälligkeitsdatum",
    overdue: "Überfällig seit",
    days: "Tagen",
    paymentDetails: "Zahlungsinformationen",
    accountHolder: "Kontoinhaber",
    reference: "Verwendungszweck",
    footer: "Bei Fragen kontaktieren Sie uns unter info@dutchgreenalternative.nl",
  },
  nl: {
    dear: "Geachte",
    orderNumber: "Bestelnummer",
    amount: "Openstaand bedrag",
    dueDate: "Vervaldatum",
    overdue: "Vervallen sinds",
    days: "dagen",
    paymentDetails: "Betalingsgegevens",
    accountHolder: "Rekeninghouder",
    reference: "Betalingskenmerk",
    footer: "Bij vragen kunt u ons bereiken via info@dutchgreenalternative.nl",
  },
  en: {
    dear: "Dear",
    orderNumber: "Order Number",
    amount: "Outstanding Amount",
    dueDate: "Due Date",
    overdue: "Overdue by",
    days: "days",
    paymentDetails: "Payment Details",
    accountHolder: "Account Holder",
    reference: "Payment Reference",
    footer: "For questions, contact us at info@dutchgreenalternative.nl",
  },
};

export function getPaymentReminderSubject(data: PaymentReminderData): string {
  const stage = labels[data.locale]?.[String(data.reminderStage)] || labels.de[String(data.reminderStage)];
  return `${stage.subject} - ${data.orderNumber}`;
}

export function buildPaymentReminderEmail(data: PaymentReminderData): string {
  const stage = labels[data.locale]?.[String(data.reminderStage)] || labels.de[String(data.reminderStage)];
  const t = commonLabels[data.locale] || commonLabels.de;

  // Color escalation: blue → orange → red
  const headerColors = {
    1: { bg: "linear-gradient(135deg, #2d5a3d, #4a7c59)", solid: "#2d5a3d", accent: "#2d5a3d" },
    2: { bg: "linear-gradient(135deg, #92400e, #d97706)", solid: "#92400e", accent: "#92400e" },
    3: { bg: "linear-gradient(135deg, #991b1b, #dc2626)", solid: "#991b1b", accent: "#991b1b" },
  };
  const colors = headerColors[data.reminderStage];

  const urgencyBanner = data.reminderStage === 3
    ? `<div style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #991b1b; font-weight: 600; font-size: 14px;">⚠️ ${stage.action}</p>
          </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background-color: ${colors.solid}; background: ${colors.bg}; padding: 30px 40px; text-align: center;">
            <img src="https://xburabmzlolrnywcyxwz.supabase.co/storage/v1/object/public/DGA/logo%20white.png" alt="Dutch Green Alternative" style="max-width: 200px; height: auto; margin-bottom: 8px;" />
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 600; font-family: 'Outfit', sans-serif;">${stage.heading}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 40px;">
            <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
              ${t.dear} ${data.customerName},
            </p>
            <p style="margin: 0 0 24px; color: #374151; line-height: 1.6;">
              ${stage.body}
            </p>

            ${urgencyBanner}

            <!-- Order Summary -->
            <div style="background-color: #f9fafb; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">${t.orderNumber}:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${colors.accent};">${data.orderNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">${t.amount}:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 18px; color: ${colors.accent};">€${data.total.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">${t.dueDate}:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.paymentDueDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #dc2626;">${t.overdue}:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">${data.daysPastDue} ${t.days}</td>
                </tr>
              </table>
            </div>

            ${data.reminderStage < 3 ? `<p style="margin: 0 0 24px; color: #374151; line-height: 1.6;">${stage.action}</p>` : ""}

            <!-- Payment Details -->
            <div style="background-color: #eff6ff; border: 2px solid #bfdbfe; border-radius: 10px; padding: 24px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 16px; color: #1e40af; font-size: 16px; font-family: 'Outfit', sans-serif;">🏦 ${t.paymentDetails}</h3>
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; width: 140px;">${t.accountHolder}:</td>
                  <td style="padding: 6px 0; font-weight: 600;">GreenResults | Dutch Green Alternative</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280;">IBAN:</td>
                  <td style="padding: 6px 0; font-weight: 600; font-family: monospace; font-size: 15px;">BE63 9674 8610 0308</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280;">BIC:</td>
                  <td style="padding: 6px 0; font-weight: 600; font-family: monospace;">TRWIBEB1</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280;">${t.reference}:</td>
                  <td style="padding: 6px 0; font-weight: 600; color: #2d5a3d; font-size: 15px;">${data.orderNumber}</td>
                </tr>
              </table>
            </div>

            <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">${stage.closing}</p>
          </td>
        </tr>
        <!-- Company Details -->
        <tr>
          <td style="padding: 0 40px 24px;">
            <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.6;">
              GreenResults | Dutch Green Alternative · Tornimäe 3 · 10145 Tallinn · Handelsregisternummer: 16624464
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center;">
            <p style="margin: 0; color: #9ca3af; font-size: 13px;">${t.footer}</p>
            <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} Dutch Green Alternative</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
