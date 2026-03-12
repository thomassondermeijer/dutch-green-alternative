type WelcomeData = {
  customerName: string;
  locale: string;
};

const labels: Record<string, Record<string, string>> = {
  de: {
    title: "Willkommen bei Dutch Green Alternative!",
    greeting: "Willkommen",
    body: "Vielen Dank für Ihre Registrierung. Entdecken Sie unsere hochwertigen CBD- und CBG-Öle — laborgetestet, natürlich und wirksam.",
    cta: "Jetzt entdecken",
    benefits: "Als registrierter Kunde profitieren Sie von:",
    benefit1: "Bestellverlauf und Sendungsverfolgung",
    benefit2: "Schnelleres Checkout mit gespeicherten Adressen",
    benefit3: "Exklusive Angebote und Rabattcodes",
    footer: "Bei Fragen kontaktieren Sie uns gerne unter info@dutchgreenalternative.nl",
  },
  nl: {
    title: "Welkom bij Dutch Green Alternative!",
    greeting: "Welkom",
    body: "Bedankt voor uw registratie. Ontdek onze hoogwaardige CBD- en CBG-oliën — laboratorium getest, natuurlijk en effectief.",
    cta: "Ontdek nu",
    benefits: "Als geregistreerde klant profiteert u van:",
    benefit1: "Bestelgeschiedenis en track & trace",
    benefit2: "Sneller afrekenen met opgeslagen adressen",
    benefit3: "Exclusieve aanbiedingen en kortingscodes",
    footer: "Bij vragen kunt u ons bereiken via info@dutchgreenalternative.nl",
  },
  en: {
    title: "Welcome to Dutch Green Alternative!",
    greeting: "Welcome",
    body: "Thank you for registering. Discover our premium CBD and CBG oils — lab-tested, natural and effective.",
    cta: "Discover Now",
    benefits: "As a registered customer, you benefit from:",
    benefit1: "Order history and shipment tracking",
    benefit2: "Faster checkout with saved addresses",
    benefit3: "Exclusive offers and discount codes",
    footer: "For questions, contact us at info@dutchgreenalternative.nl",
  },
};

export function buildWelcomeEmail(data: WelcomeData): string {
  const t = labels[data.locale] || labels.de;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

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
            <img src="https://xburabmzlolrnywcyxwz.supabase.co/storage/v1/object/public/DGA/logo%20white.png" alt="Dutch Green Alternative" style="max-width: 200px; height: auto; margin-bottom: 8px;" />
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; font-family: 'Outfit', sans-serif;">${t.title}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px;">
            <h2 style="margin: 0 0 16px; color: #1a1a1a;">${t.greeting}, ${data.customerName}!</h2>
            <p style="color: #6b7280; line-height: 1.6; margin: 0 0 24px;">${t.body}</p>

            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${siteUrl}/${data.locale}/shop" style="display: inline-block; padding: 14px 40px; background-color: #2d5a3d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${t.cta}</a>
            </div>

            <p style="color: #1a1a1a; font-weight: 600; margin: 0 0 12px;">${t.benefits}</p>
            <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px; margin: 0;">
              <li>${t.benefit1}</li>
              <li>${t.benefit2}</li>
              <li>${t.benefit3}</li>
            </ul>
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
