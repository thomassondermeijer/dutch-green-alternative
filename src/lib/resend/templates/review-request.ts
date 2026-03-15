type ReviewRequestData = {
  customerName: string;
  orderNumber: string;
  productNames: string[];
  locale: string;
  reviewToken: string;
};

const labels: Record<string, Record<string, string>> = {
  de: {
    heading: "Wie gefällt Ihnen Ihr CBD-Öl?",
    greeting: "Hallo",
    intro: "Es sind nun zwei Wochen vergangen, seit Sie Ihre Bestellung erhalten haben. Wir würden gerne wissen, wie es Ihnen mit unseren Produkten geht!",
    orderRef: "Bestellung",
    yourProducts: "Ihre Produkte",
    why: "Warum Ihre Bewertung wichtig ist",
    reason1: "⭐ Hilft anderen Kunden bei ihrer Entscheidung",
    reason2: "📊 Hilft uns, unsere Produkte zu verbessern",
    reason3: "🎁 40% Rabatt-Gutschein als Dankeschön (mit Foto)",
    ctaTitle: "Teilen Sie Ihre Erfahrung",
    ctaBody: "Erzählen Sie uns, wie die Produkte bei Ihnen wirken — ob Schlaf, Schmerzen, Entspannung oder allgemeines Wohlbefinden.",
    ctaBtn: "Bewertung schreiben",
    altText: "Oder antworten Sie einfach auf diese E-Mail — wir freuen uns über jede Rückmeldung!",
    footer: "Bei Fragen kontaktieren Sie uns gerne unter info@dutchgreenalternative.nl",
  },
  nl: {
    heading: "Hoe bevalt uw CBD-olie?",
    greeting: "Hallo",
    intro: "Het is nu twee weken geleden dat u uw bestelling heeft ontvangen. We horen graag hoe het gaat met onze producten!",
    orderRef: "Bestelling",
    yourProducts: "Uw producten",
    why: "Waarom uw beoordeling belangrijk is",
    reason1: "⭐ Helpt andere klanten bij hun keuze",
    reason2: "📊 Helpt ons onze producten te verbeteren",
    reason3: "🎁 40% kortingsvoucher als dank (met foto)",
    ctaTitle: "Deel uw ervaring",
    ctaBody: "Vertel ons hoe de producten voor u werken — of het nu gaat om slaap, pijn, ontspanning of algemeen welzijn.",
    ctaBtn: "Beoordeling schrijven",
    altText: "Of beantwoord deze e-mail — we waarderen elke reactie!",
    footer: "Bij vragen kunt u ons bereiken via info@dutchgreenalternative.nl",
  },
  en: {
    heading: "How are you finding your CBD oil?",
    greeting: "Hello",
    intro: "It's been two weeks since you received your order. We'd love to hear how our products are working for you!",
    orderRef: "Order",
    yourProducts: "Your products",
    why: "Why your review matters",
    reason1: "⭐ Helps other customers make their choice",
    reason2: "📊 Helps us improve our products",
    reason3: "🎁 40% discount coupon as a thank you (with photo)",
    ctaTitle: "Share your experience",
    ctaBody: "Tell us how the products are working for you — whether it's sleep, pain, relaxation, or general wellness.",
    ctaBtn: "Write a review",
    altText: "Or simply reply to this email — we appreciate any feedback!",
    footer: "For questions, contact us at info@dutchgreenalternative.nl",
  },
};

export function buildReviewRequestEmail(data: ReviewRequestData): string {
  const t = labels[data.locale] || labels.de;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

  const productList = data.productNames
    .map((name) => `<li style="padding: 4px 0; color: #374151;">${name}</li>`)
    .join("");

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
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #2d5a3d, #4a7c59); padding: 30px 40px; text-align: center;">
            <img src="https://dutchgreenalternative.nl/email-assets/logo%20white.png" alt="Dutch Green Alternative" style="max-width: 200px; height: auto; margin-bottom: 8px;" />
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; font-family: 'Outfit', sans-serif;">${t.heading}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 40px;">
            <h2 style="margin: 0 0 16px; color: #1a1a1a; font-family: 'Outfit', sans-serif;">${t.greeting}, ${data.customerName}!</h2>
            <p style="color: #6b7280; line-height: 1.6; margin: 0 0 8px;">${t.intro}</p>
            <p style="color: #6b7280; margin: 0 0 24px;">${t.orderRef}: <strong style="color: #2d5a3d;">${data.orderNumber}</strong></p>

            <!-- Products -->
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #2d5a3d; font-family: 'Outfit', sans-serif;">📦 ${t.yourProducts}</p>
              <ul style="margin: 0; padding-left: 20px;">${productList}</ul>
            </div>

            <!-- Why Review -->
            <p style="margin: 0 0 12px; font-weight: 600; color: #1a1a1a; font-family: 'Outfit', sans-serif;">${t.why}</p>
            <ul style="color: #6b7280; line-height: 2; padding-left: 8px; list-style: none; margin: 0 0 24px;">
              <li>${t.reason1}</li>
              <li>${t.reason2}</li>
              <li>${t.reason3}</li>
            </ul>

            <!-- CTA -->
            <div style="background-color: #f9fafb; border-radius: 10px; padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a; font-size: 16px; font-family: 'Outfit', sans-serif;">${t.ctaTitle}</p>
              <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">${t.ctaBody}</p>
              <a href="${siteUrl}/${data.locale}/review?token=${data.reviewToken}" style="display: inline-block; padding: 14px 40px; background-color: #2d5a3d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${t.ctaBtn}</a>
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 13px; font-style: italic;">${t.altText}</p>
            </div>
          </td>
        </tr>
        <!-- Company -->
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
