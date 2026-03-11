type OrderItem = {
    name: string;
    quantity: number;
    price: number;
};

type OrderConfirmationData = {
    orderNumber: string;
    customerName: string;
    items: OrderItem[];
    subtotal: number;
    shipping: number;
    discount?: number;
    total: number;
    shippingAddress: string;
    locale: string;
};

const labels: Record<string, Record<string, string>> = {
    de: {
        title: "Bestellbestätigung",
        greeting: "Vielen Dank für Ihre Bestellung",
        orderNumber: "Bestellnummer",
        items: "Bestellte Produkte",
        product: "Produkt",
        qty: "Menge",
        price: "Preis",
        subtotal: "Zwischensumme",
        shipping: "Versand",
        discount: "Rabatt",
        total: "Gesamt",
        shippingTo: "Lieferadresse",
        delivery: "Voraussichtliche Lieferung: 2-4 Werktage",
        footer: "Bei Fragen kontaktieren Sie uns gerne unter info@dutchgreenalternative.nl",
    },
    nl: {
        title: "Orderbevestiging",
        greeting: "Bedankt voor uw bestelling",
        orderNumber: "Bestelnummer",
        items: "Bestelde producten",
        product: "Product",
        qty: "Aantal",
        price: "Prijs",
        subtotal: "Subtotaal",
        shipping: "Verzending",
        discount: "Korting",
        total: "Totaal",
        shippingTo: "Bezorgadres",
        delivery: "Verwachte levering: 2-4 werkdagen",
        footer: "Bij vragen kunt u ons bereiken via info@dutchgreenalternative.nl",
    },
    en: {
        title: "Order Confirmation",
        greeting: "Thank you for your order",
        orderNumber: "Order Number",
        items: "Ordered Products",
        product: "Product",
        qty: "Qty",
        price: "Price",
        subtotal: "Subtotal",
        shipping: "Shipping",
        discount: "Discount",
        total: "Total",
        shippingTo: "Shipping Address",
        delivery: "Estimated delivery: 2-4 business days",
        footer: "For questions, contact us at info@dutchgreenalternative.nl",
    },
};

export function buildOrderConfirmationEmail(data: OrderConfirmationData): string {
    const t = labels[data.locale] || labels.de;

    const itemRows = data.items
        .map(
            (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
        )
        .join("");

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #2d5a3d, #4a7c59); padding: 30px 40px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px;">🌿 Dutch Green Alternative</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 40px;">
            <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px;">${t.greeting}, ${data.customerName}!</h2>
            <p style="color: #6b7280; margin: 0 0 24px;">${t.orderNumber}: <strong style="color: #2d5a3d;">${data.orderNumber}</strong></p>

            <!-- Items Table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px; text-align: left; font-size: 14px; color: #6b7280;">${t.product}</th>
                <th style="padding: 12px; text-align: center; font-size: 14px; color: #6b7280;">${t.qty}</th>
                <th style="padding: 12px; text-align: right; font-size: 14px; color: #6b7280;">${t.price}</th>
              </tr>
              ${itemRows}
            </table>

            <!-- Totals -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">${t.subtotal}</td>
                <td style="padding: 6px 0; text-align: right;">€${data.subtotal.toFixed(2)}</td>
              </tr>
              ${data.discount ? `<tr>
                <td style="padding: 6px 0; color: #16a34a;">${t.discount}</td>
                <td style="padding: 6px 0; text-align: right; color: #16a34a;">-€${data.discount.toFixed(2)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">${t.shipping}</td>
                <td style="padding: 6px 0; text-align: right;">${data.shipping === 0 ? "✓ Free" : `€${data.shipping.toFixed(2)}`}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0 0; font-size: 18px; font-weight: bold; border-top: 2px solid #e5e7eb;">${t.total}</td>
                <td style="padding: 12px 0 0; text-align: right; font-size: 18px; font-weight: bold; border-top: 2px solid #e5e7eb; color: #2d5a3d;">€${data.total.toFixed(2)}</td>
              </tr>
            </table>

            <!-- Shipping -->
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a;">📦 ${t.shippingTo}</p>
              <p style="margin: 0; color: #6b7280; white-space: pre-line;">${data.shippingAddress}</p>
              <p style="margin: 12px 0 0; color: #2d5a3d; font-weight: 500;">${t.delivery}</p>
            </div>
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
