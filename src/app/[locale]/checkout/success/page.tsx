import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { Button } from "@/components/ui/Button/Button";
import { CartClearer } from "./_components/CartClearer";
import styles from "../checkout.module.css";

export default async function CheckoutSuccessPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ order?: string; method?: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);
    const { order: orderNumber, method } = await searchParams;
    const isInvoice = method === "invoice";

    return (
        <main className={styles.page}>
            <Container>
                <div className={styles.successPage}>
                    <CartClearer />
                    <div className={styles.successIcon}>✓</div>
                    <h1 className={styles.successTitle}>{dict.checkout.successTitle}</h1>

                    {orderNumber && (
                        <div className={styles.orderNumber}>{orderNumber}</div>
                    )}

                    <p className={styles.successMessage}>
                        {dict.checkout.estimatedDelivery}
                    </p>

                    {/* Invoice-specific notice */}
                    {isInvoice && (
                        <div style={{
                            background: "linear-gradient(135deg, #eff6ff, #f0fdf4)",
                            border: "2px solid #bfdbfe",
                            borderRadius: "12px",
                            padding: "1.25rem 1.5rem",
                            marginTop: "1.5rem",
                            maxWidth: "520px",
                            textAlign: "left",
                        }}>
                            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", color: "#1e40af" }}>
                                {dict.checkout.invoiceNoticeTitle}
                            </h3>
                            <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6, color: "#374151" }}>
                                {dict.checkout.invoiceNoticeText}
                            </p>
                        </div>
                    )}

                    {/* General spam notice */}
                    <p style={{
                        marginTop: "1.25rem",
                        fontSize: "0.8rem",
                        color: "#9ca3af",
                        maxWidth: "420px",
                    }}>
                        📧 {dict.checkout.checkSpam}
                    </p>

                    <div className={styles.successActions}>
                        <Button variant="primary" href={`/${locale}/shop`}>
                            {dict.cart.continueShopping}
                        </Button>
                    </div>
                </div>
            </Container>
        </main>
    );
}
