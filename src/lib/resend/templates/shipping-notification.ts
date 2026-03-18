type ShippingData = {
  customerName: string;
  orderNumber: string;
  trackingNumber?: string;
  trackingUrl?: string;
  locale: string;
};

const labels: Record<string, Record<string, string>> = {
  de: {
    title: "Ihre Bestellung wurde versendet!",
    greeting: "Gute Nachricht",
    body: "Ihre Bestellung wurde versendet und ist auf dem Weg zu Ihnen.",
    orderNumber: "Bestellnummer",
    tracking: "Sendungsverfolgung",
    trackBtn: "Sendung verfolgen",
    noTracking: "Ihre Bestellung wurde über einen Standardversand ohne Sendungsverfolgung versendet.",
    footer: "Bei Fragen kontaktieren Sie uns gerne unter info@dutchgreenalternative.nl",
  },
  nl: {
    title: "Uw bestelling is verzonden!",
    greeting: "Goed nieuws",
    body: "Uw bestelling is verzonden en onderweg naar u.",
    orderNumber: "Bestelnummer",
    tracking: "Track & Trace",
    trackBtn: "Volg de zending",
    noTracking: "Uw bestelling is verzonden via standaardverzending zonder track & trace.",
    footer: "Bij vragen kunt u ons bereiken via info@dutchgreenalternative.nl",
  },
  en: {
    title: "Your order has been shipped!",
    greeting: "Great news",
    body: "Your order has been shipped and is on its way to you.",
    orderNumber: "Order Number",
    tracking: "Tracking",
    trackBtn: "Track Shipment",
    noTracking: "Your order has been shipped via standard delivery without tracking.",
    footer: "For questions, contact us at info@dutchgreenalternative.nl",
  },
};

export function buildShippingNotificationEmail(data: ShippingData): string {
  const t = labels[data.locale] || labels.de;

  const trackingSection = data.trackingNumber
    ? `<div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
             <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">${t.tracking}</p>
             <p style="margin: 0 0 16px; font-size: 18px; font-weight: bold; color: #1a1a1a;">${data.trackingNumber}</p>
             ${data.trackingUrl ? `<a href="${data.trackingUrl}" style="display: inline-block; padding: 12px 32px; background-color: #2d5a3d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">${t.trackBtn}</a>` : ""}
           </div>`
    : `<p style="color: #6b7280; font-style: italic;">${t.noTracking}</p>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background: linear-gradient(135deg, #2d5a3d, #4a7c59); padding: 30px 40px; text-align: center;">
            <img src="https://dutchgreenalternative.nl/email-assets/logo%20white.png" alt="Dutch Green Alternative" style="max-width: 200px; height: auto; margin-bottom: 8px;" />
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; font-family: 'Outfit', sans-serif;">${t.title}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px;">
            <h2 style="margin: 0 0 8px; color: #1a1a1a;">📦 ${t.greeting}, ${data.customerName}!</h2>
            <p style="color: #6b7280; margin: 0 0 8px;">${t.body}</p>
            <p style="color: #6b7280; margin: 0 0 24px;">${t.orderNumber}: <strong style="color: #2d5a3d;">${data.orderNumber}</strong></p>
            ${trackingSection}
          </td>
        </tr>
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
