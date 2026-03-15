type ReviewRewardData = {
    customerName: string;
    couponCode: string;
    productName: string;
    locale: string;
};

const labels: Record<string, Record<string, string>> = {
    de: {
        heading: "Vielen Dank für Ihre Bewertung!",
        greeting: "Hallo",
        intro: "Ihre Bewertung wurde veröffentlicht! Als Dankeschön erhalten Sie einen exklusiven Gutschein für Ihren nächsten Einkauf.",
        couponLabel: "Ihr persönlicher Gutscheincode",
        discount: "40% Rabatt",
        maxDiscount: "Max. Rabatt: €400",
        validity: "Gültig für 90 Tage · Einmalig verwendbar",
        ctaBtn: "Jetzt einlösen",
        reviewed: "Ihre bewertete Produkt",
        footer: "Bei Fragen kontaktieren Sie uns gerne unter info@dutchgreenalternative.nl",
    },
    nl: {
        heading: "Bedankt voor uw beoordeling!",
        greeting: "Hallo",
        intro: "Uw beoordeling is gepubliceerd! Als dank ontvangt u een exclusieve kortingscode voor uw volgende bestelling.",
        couponLabel: "Uw persoonlijke kortingscode",
        discount: "40% korting",
        maxDiscount: "Max. korting: €400",
        validity: "Geldig voor 90 dagen · Eenmalig bruikbaar",
        ctaBtn: "Nu inwisselen",
        reviewed: "Uw beoordeelde product",
        footer: "Bij vragen kunt u ons bereiken via info@dutchgreenalternative.nl",
    },
    en: {
        heading: "Thank you for your review!",
        greeting: "Hello",
        intro: "Your review has been published! As a thank you, here's an exclusive coupon code for your next order.",
        couponLabel: "Your personal coupon code",
        discount: "40% off",
        maxDiscount: "Max discount: €400",
        validity: "Valid for 90 days · Single use",
        ctaBtn: "Redeem now",
        reviewed: "Your reviewed product",
        footer: "For questions, contact us at info@dutchgreenalternative.nl",
    },
};

export function buildReviewRewardEmail(data: ReviewRewardData): string {
    const t = labels[data.locale] || labels.de;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";
    const locale = data.locale || "de";

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
            <p style="color: #6b7280; line-height: 1.6; margin: 0 0 24px;">${t.intro}</p>

            <!-- Coupon Box -->
            <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 2px dashed #2d5a3d; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">${t.couponLabel}</p>
              <p style="margin: 0 0 8px; font-size: 32px; font-weight: 700; color: #2d5a3d; font-family: 'Outfit', monospace; letter-spacing: 3px;">${data.couponCode}</p>
              <p style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #2d5a3d;">${t.discount}</p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">${t.maxDiscount} · ${t.validity}</p>
            </div>

            <!-- Product -->
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
              ${t.reviewed}: <strong style="color: #2d5a3d;">${data.productName}</strong>
            </p>

            <!-- CTA -->
            <div style="text-align: center;">
              <a href="${siteUrl}/${locale}/shop" style="display: inline-block; padding: 14px 40px; background-color: #2d5a3d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${t.ctaBtn}</a>
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
