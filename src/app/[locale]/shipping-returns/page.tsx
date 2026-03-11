import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import styles from "../content.module.css";

export default async function ShippingReturnsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    const content = {
        de: {
            shippingTitle: "Versand",
            shippingItems: [
                "Kostenloser Versand ab €65 Bestellwert",
                "Versand innerhalb von 1-2 Werktagen",
                "Lieferung in 2-4 Werktagen (EU)",
                "Versandkosten: €4,95 (unter €65)",
                "Sendungsverfolgung per E-Mail",
            ],
            returnsTitle: "Rücksendungen",
            returnsItems: [
                "14 Tage Rückgaberecht",
                "Produkt muss ungeöffnet und originalverpackt sein",
                "Rücksendung auf Kosten des Käufers",
                "Erstattung innerhalb von 5 Werktagen",
                "Kontaktieren Sie uns vor der Rücksendung",
            ],
            zonesTitle: "Liefergebiete",
            zonesItems: [
                "Niederlande — 2-3 Werktage",
                "Deutschland — 3-4 Werktage",
                "Belgien — 2-3 Werktage",
                "Österreich — 3-5 Werktage",
                "Luxemburg — 3-4 Werktage",
            ],
            paymentTitle: "Zahlungsmethoden",
            paymentItems: [
                "iDEAL",
                "Bancontact",
                "Kreditkarte (Visa, Mastercard)",
                "SOFORT Banking",
                "PayPal",
            ],
        },
        nl: {
            shippingTitle: "Verzending",
            shippingItems: [
                "Gratis verzending vanaf €65 bestelwaarde",
                "Verzending binnen 1-2 werkdagen",
                "Levering in 2-4 werkdagen (EU)",
                "Verzendkosten: €4,95 (onder €65)",
                "Track & trace per e-mail",
            ],
            returnsTitle: "Retourneren",
            returnsItems: [
                "14 dagen retourrecht",
                "Product moet ongeopend en in originele verpakking zijn",
                "Retourzending op kosten van de koper",
                "Terugbetaling binnen 5 werkdagen",
                "Neem contact met ons op vóór retourzending",
            ],
            zonesTitle: "Levergebieden",
            zonesItems: [
                "Nederland — 2-3 werkdagen",
                "Duitsland — 3-4 werkdagen",
                "België — 2-3 werkdagen",
                "Oostenrijk — 3-5 werkdagen",
                "Luxemburg — 3-4 werkdagen",
            ],
            paymentTitle: "Betaalmethoden",
            paymentItems: [
                "iDEAL",
                "Bancontact",
                "Creditcard (Visa, Mastercard)",
                "SOFORT Banking",
                "PayPal",
            ],
        },
        en: {
            shippingTitle: "Shipping",
            shippingItems: [
                "Free shipping on orders over €65",
                "Shipped within 1-2 business days",
                "Delivery in 2-4 business days (EU)",
                "Shipping cost: €4.95 (under €65)",
                "Email tracking notification",
            ],
            returnsTitle: "Returns",
            returnsItems: [
                "14-day return policy",
                "Product must be unopened and in original packaging",
                "Return shipping at buyer's expense",
                "Refund within 5 business days",
                "Contact us before returning",
            ],
            zonesTitle: "Delivery Zones",
            zonesItems: [
                "Netherlands — 2-3 business days",
                "Germany — 3-4 business days",
                "Belgium — 2-3 business days",
                "Austria — 3-5 business days",
                "Luxembourg — 3-4 business days",
            ],
            paymentTitle: "Payment Methods",
            paymentItems: [
                "iDEAL",
                "Bancontact",
                "Credit Card (Visa, Mastercard)",
                "SOFORT Banking",
                "PayPal",
            ],
        },
    };

    const c = content[locale] || content.de;
    const pageTitle = locale === "de" ? "Versand & Rücksendungen" : locale === "nl" ? "Verzending & Retour" : "Shipping & Returns";

    return (
        <main className={styles.page}>
            <Container>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>{pageTitle}</h1>
                    <div className={styles.pageLine} />
                </div>

                <div className={styles.infoGrid}>
                    <div className={styles.infoCard}>
                        <h3>{c.shippingTitle}</h3>
                        <ul>{c.shippingItems.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </div>
                    <div className={styles.infoCard}>
                        <h3>{c.returnsTitle}</h3>
                        <ul>{c.returnsItems.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </div>
                    <div className={styles.infoCard}>
                        <h3>{c.zonesTitle}</h3>
                        <ul>{c.zonesItems.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </div>
                    <div className={styles.infoCard}>
                        <h3>{c.paymentTitle}</h3>
                        <ul>{c.paymentItems.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </div>
                </div>
            </Container>
        </main>
    );
}
