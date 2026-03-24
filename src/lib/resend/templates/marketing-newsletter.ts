type MarketingEmailData = {
  subject: string;
  bodyHtml: string;
  imageUrl?: string;
  productName: string;
  productSlug: string;
  productPrice: number;
  couponCode: string;
  couponDiscount: number;
  couponReason: string;
  couponValidUntil?: string;
  locale: string;
};

const labels: Record<string, Record<string, string>> = {
  de: {
    discountHeadline: "{discount}% Rabatt auf alle Produkte",
    inHonorOf: "Anlässlich {reason}",
    shopNow: "Jetzt einkaufen",
    validUntil: "Gültig bis {date}",
    ourTip: "Unser Tipp",
    unsubscribe: "Abmelden",
    privacyNotice: "Sie erhalten diese E-Mail, weil Sie Kunde bei Dutch Green Alternative sind.",
  },
  nl: {
    discountHeadline: "{discount}% korting op alle producten",
    inHonorOf: "Ter ere van {reason}",
    shopNow: "Nu winkelen",
    validUntil: "Geldig tot {date}",
    ourTip: "Onze tip",
    unsubscribe: "Afmelden",
    privacyNotice: "U ontvangt deze e-mail omdat u klant bent bij Dutch Green Alternative.",
  },
  en: {
    discountHeadline: "{discount}% off all products",
    inHonorOf: "In honor of {reason}",
    shopNow: "Shop now",
    validUntil: "Valid until {date}",
    ourTip: "Our tip",
    unsubscribe: "Unsubscribe",
    privacyNotice: "You're receiving this email as a Dutch Green Alternative customer.",
  },
};

export function buildMarketingNewsletterEmail(data: MarketingEmailData): string {
  const t = labels[data.locale] || labels.de;
  const shopUrl = `https://dutchgreenalternative.nl/${data.locale}?coupon=${data.couponCode}`;
  const unsubUrl = `https://dutchgreenalternative.nl/unsubscribe`;

  const discountHeadline = t.discountHeadline.replace("{discount}", String(data.couponDiscount));
  const seasonalContext = t.inHonorOf.replace("{reason}", data.couponReason);

  let validUntilHtml = "";
  if (data.couponValidUntil) {
    const dateStr = new Date(data.couponValidUntil).toLocaleDateString(
      data.locale === "de" ? "de-DE" : data.locale === "nl" ? "nl-NL" : "en-GB",
      { day: "numeric", month: "long", year: "numeric" }
    );
    validUntilHtml = `
                  <p style="margin: 12px 0 0; font-size: 12px; color: #64748b; font-weight: 500;">
                    ⏰ ${t.validUntil.replace("{date}", dateStr)}
                  </p>`;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  h2 { font-family: 'Outfit', sans-serif !important; color: #1e293b; font-size: 20px; font-weight: 700; margin: 28px 0 12px; }
  h3 { font-family: 'Outfit', sans-serif !important; color: #2d5a3d; font-size: 16px; font-weight: 600; }
  p { font-size: 15px; line-height: 1.7; color: #374151; margin: 0 0 14px; }
  a { color: #2d5a3d; }
</style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f4f6" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td bgcolor="#2d5a3d" style="background: linear-gradient(135deg, #2d5a3d, #4a7c59); background-color: #2d5a3d; padding: 30px 40px; text-align: center;">
            <img src="https://dutchgreenalternative.nl/email-assets/logo%20white.png" alt="Dutch Green Alternative" style="max-width: 200px; height: auto;" />
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

        <!-- Discount Banner -->
        <tr>
          <td style="padding: 0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius: 12px; border: 1px solid #bbf7d0;">
              <tr>
                <td bgcolor="#f0fdf4" style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); background-color: #f0fdf4; padding: 28px 24px; border-radius: 12px; text-align: center;">
                  <p style="margin: 0 0 4px; font-size: 13px; color: #2d5a3d; font-weight: 600; font-family: 'Outfit', sans-serif;">
                    🎉 ${seasonalContext}
                  </p>
                  <p style="margin: 0 0 20px; font-size: 26px; font-weight: 800; color: #1e293b; font-family: 'Outfit', sans-serif; letter-spacing: -0.5px;">
                    ${discountHeadline}
                  </p>
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${shopUrl}" style="height:46px;v-text-anchor:middle;width:220px;" arcsize="17%" strokecolor="#2d5a3d" fillcolor="#2d5a3d">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Outfit',sans-serif;font-size:15px;font-weight:600;">${t.shopNow} →</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${shopUrl}" style="display: inline-block; background: linear-gradient(135deg, #2d5a3d, #4a7c59); background-color: #2d5a3d; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px; font-family: 'Outfit', sans-serif; mso-hide: all;">
                    ${t.shopNow} →
                  </a>
                  <!--<![endif]-->${validUntilHtml}
                  <p style="margin: 16px 0 0; font-size: 11px; color: #94a3b8;">
                    💡 ${t.ourTip}: ${data.productName} — €${data.productPrice.toFixed(2)}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="#f8fafc" style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
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
