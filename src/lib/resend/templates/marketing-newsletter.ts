type MarketingEmailData = {
  subject: string;
  bodyHtml: string;
  imageUrl?: string;
  productName: string;
  productSlug: string;
  productPrice: number;
  couponCode: string;
  couponDiscount: number;
  locale: string;
};

const labels: Record<string, Record<string, string>> = {
  de: {
    ourRecommendation: "Unsere Empfehlung für Sie",
    shopNow: "Jetzt bestellen",
    useCode: "Nutzen Sie den Code",
    forDiscount: "für {discount}% Rabatt",
    validLimited: "Gültig für begrenzte Zeit",
    unsubscribe: "Abmelden",
    privacyNotice: "Sie erhalten diese E-Mail, weil Sie Kunde bei Dutch Green Alternative sind.",
  },
  nl: {
    ourRecommendation: "Onze aanbeveling voor u",
    shopNow: "Nu bestellen",
    useCode: "Gebruik code",
    forDiscount: "voor {discount}% korting",
    validLimited: "Geldig voor beperkte tijd",
    unsubscribe: "Afmelden",
    privacyNotice: "U ontvangt deze e-mail omdat u klant bent bij Dutch Green Alternative.",
  },
  en: {
    ourRecommendation: "Our recommendation for you",
    shopNow: "Shop now",
    useCode: "Use code",
    forDiscount: "for {discount}% off",
    validLimited: "Valid for a limited time",
    unsubscribe: "Unsubscribe",
    privacyNotice: "You're receiving this email as a Dutch Green Alternative customer.",
  },
};

export function buildMarketingNewsletterEmail(data: MarketingEmailData): string {
  const t = labels[data.locale] || labels.de;
  const shopUrl = `https://dutchgreenalternative.com/${data.locale}/product/${data.productSlug}?coupon=${data.couponCode}`;
  const unsubUrl = `https://dutchgreenalternative.com/unsubscribe`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #2d5a3d, #4a7c59); padding: 30px 40px; text-align: center;">
            <img src="https://xburabmzlolrnywcyxwz.supabase.co/storage/v1/object/public/DGA/logo%20white.png" alt="Dutch Green Alternative" style="max-width: 200px; height: auto;" />
          </td>
        </tr>

        <!-- Body Content -->
        <tr>
          <td style="padding: 32px 40px;">
            ${data.bodyHtml}
          </td>
        </tr>

        <!-- Inline Image -->
        ${data.imageUrl ? `
        <tr>
          <td style="padding: 0 40px 24px;">
            <img src="${data.imageUrl}" alt="" style="width: 100%; border-radius: 8px; display: block;" />
          </td>
        </tr>
        ` : ""}

        <!-- Product Recommendation -->
        <tr>
          <td style="padding: 0 40px 24px;">
            <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border-radius: 12px; padding: 24px; border: 1px solid #bbf7d0;">
              <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #2d5a3d; font-weight: 700; font-family: 'Outfit', sans-serif;">
                🌿 ${t.ourRecommendation}
              </p>
              <p style="margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #1e293b;">
                ${data.productName} — €${data.productPrice.toFixed(2)}
              </p>
              <a href="${shopUrl}" style="display: inline-block; background: linear-gradient(135deg, #2d5a3d, #4a7c59); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; font-family: 'Outfit', sans-serif;">
                ${t.shopNow} →
              </a>
            </div>
          </td>
        </tr>

        <!-- Coupon Code -->
        <tr>
          <td style="padding: 0 40px 32px;">
            <div style="text-align: center; padding: 20px; background-color: #fefce8; border-radius: 8px; border: 2px dashed #ca8a04;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #854d0e; font-weight: 600;">
                ${t.useCode}
              </p>
              <p style="margin: 0 0 8px; font-size: 28px; font-weight: 800; color: #854d0e; letter-spacing: 3px; font-family: 'Outfit', monospace;">
                ${data.couponCode}
              </p>
              <p style="margin: 0; font-size: 13px; color: #a16207;">
                ${t.forDiscount.replace("{discount}", String(data.couponDiscount))} · ${t.validLimited}
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 8px; color: #94a3b8; font-size: 11px; line-height: 1.6;">
              ${t.privacyNotice}
            </p>
            <p style="margin: 0 0 12px; color: #94a3b8; font-size: 11px;">
              GreenResults | Dutch Green Alternative · Tornimäe 3 · 10145 Tallinn
            </p>
            <a href="${unsubUrl}" style="color: #94a3b8; font-size: 11px; text-decoration: underline;">
              ${t.unsubscribe}
            </a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
