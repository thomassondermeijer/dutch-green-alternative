type PostDeliveryData = {
    customerName: string;
    productNames: string[];
    locale: string;
};

const labels: Record<string, Record<string, string>> = {
    de: {
        heading: "Tipps für Ihr CBD-Öl",
        greeting: "Hallo",
        intro: "Wir hoffen, Sie haben Ihre Bestellung gut erhalten! Damit Sie das Beste aus Ihrem CBD-Öl herausholen, haben wir einige bewährte Tipps für Sie zusammengestellt.",
        tip1Title: "🕐 Regelmäßigkeit ist der Schlüssel",
        tip1: "Nehmen Sie Ihr CBD-Öl täglich zur gleichen Zeit ein. Die besten Ergebnisse zeigen sich nach 2-3 Wochen konsequenter Anwendung.",
        tip2Title: "💧 Sublingual einnehmen",
        tip2: "Tropfen Sie das Öl unter Ihre Zunge und halten Sie es 60-90 Sekunden, bevor Sie schlucken. So wird der Wirkstoff schneller aufgenommen.",
        tip3Title: "📝 Führen Sie ein Tagebuch",
        tip3: "Notieren Sie Ihre Dosierung und wie Sie sich fühlen. So finden Sie die ideale Dosis für Ihren Körper.",
        tip4Title: "🌡️ Richtig lagern",
        tip4: "Bewahren Sie Ihr CBD-Öl an einem kühlen, dunklen Ort auf. Nicht im Kühlschrank, aber fern von direktem Sonnenlicht.",
        yourProducts: "Ihre Produkte",
        cta: "Haben Sie Fragen?",
        ctaBody: "Unser Team hilft Ihnen gerne bei Fragen zur Dosierung oder Anwendung.",
        ctaBtn: "Kontakt aufnehmen",
        footer: "Bei Fragen kontaktieren Sie uns gerne unter info@dutchgreenalternative.nl",
    },
    nl: {
        heading: "Tips voor uw CBD-olie",
        greeting: "Hallo",
        intro: "We hopen dat u uw bestelling goed heeft ontvangen! Om het meeste uit uw CBD-olie te halen, hebben we enkele beproefde tips voor u samengesteld.",
        tip1Title: "🕐 Regelmaat is de sleutel",
        tip1: "Neem uw CBD-olie dagelijks op hetzelfde tijdstip in. De beste resultaten worden zichtbaar na 2-3 weken consequent gebruik.",
        tip2Title: "💧 Sublinguaal innemen",
        tip2: "Druppel de olie onder uw tong en houd het 60-90 seconden vast voordat u slikt. Zo wordt de werkzame stof sneller opgenomen.",
        tip3Title: "📝 Houd een dagboek bij",
        tip3: "Noteer uw dosering en hoe u zich voelt. Zo vindt u de ideale dosis voor uw lichaam.",
        tip4Title: "🌡️ Juist bewaren",
        tip4: "Bewaar uw CBD-olie op een koele, donkere plaats. Niet in de koelkast, maar uit direct zonlicht.",
        yourProducts: "Uw producten",
        cta: "Heeft u vragen?",
        ctaBody: "Ons team helpt u graag bij vragen over dosering of gebruik.",
        ctaBtn: "Neem contact op",
        footer: "Bij vragen kunt u ons bereiken via info@dutchgreenalternative.nl",
    },
    en: {
        heading: "Tips for your CBD oil",
        greeting: "Hello",
        intro: "We hope you received your order well! To help you get the most from your CBD oil, we've put together some proven tips.",
        tip1Title: "🕐 Consistency is key",
        tip1: "Take your CBD oil at the same time every day. Best results appear after 2-3 weeks of consistent use.",
        tip2Title: "💧 Take it sublingually",
        tip2: "Place the drops under your tongue and hold for 60-90 seconds before swallowing. This allows faster absorption.",
        tip3Title: "📝 Keep a journal",
        tip3: "Note your dosage and how you feel. This helps you find the ideal dose for your body.",
        tip4Title: "🌡️ Store properly",
        tip4: "Keep your CBD oil in a cool, dark place. Not in the fridge, but away from direct sunlight.",
        yourProducts: "Your products",
        cta: "Have questions?",
        ctaBody: "Our team is happy to help with dosage or usage questions.",
        ctaBtn: "Contact us",
        footer: "For questions, contact us at info@dutchgreenalternative.nl",
    },
};

export function buildPostDeliveryTipsEmail(data: PostDeliveryData): string {
    const t = labels[data.locale] || labels.de;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

    const productList = data.productNames
        .map((name) => `<li style="padding: 4px 0; color: #374151;">${name}</li>`)
        .join("");

    const tipBlock = (title: string, body: string) => `
        <div style="margin-bottom: 20px;">
          <p style="margin: 0 0 4px; font-weight: 600; color: #1a1a1a; font-family: 'Outfit', sans-serif;">${title}</p>
          <p style="margin: 0; color: #6b7280; line-height: 1.6;">${body}</p>
        </div>`;

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

            <!-- Products -->
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #2d5a3d; font-family: 'Outfit', sans-serif;">📦 ${t.yourProducts}</p>
              <ul style="margin: 0; padding-left: 20px;">${productList}</ul>
            </div>

            <!-- Tips -->
            ${tipBlock(t.tip1Title, t.tip1)}
            ${tipBlock(t.tip2Title, t.tip2)}
            ${tipBlock(t.tip3Title, t.tip3)}
            ${tipBlock(t.tip4Title, t.tip4)}

            <!-- CTA -->
            <div style="background-color: #f9fafb; border-radius: 10px; padding: 24px; text-align: center; margin-top: 32px;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a; font-family: 'Outfit', sans-serif;">${t.cta}</p>
              <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">${t.ctaBody}</p>
              <a href="mailto:info@dutchgreenalternative.nl" style="display: inline-block; padding: 12px 32px; background-color: #2d5a3d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">${t.ctaBtn}</a>
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
