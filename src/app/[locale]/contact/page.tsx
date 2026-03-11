import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { ContactFormClient } from "./_components/ContactFormClient";
import styles from "../content.module.css";

export default async function ContactPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return (
        <main className={styles.page}>
            <Container>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>{dict.contact.title}</h1>
                    <div className={styles.pageLine} />
                </div>

                <div className={styles.contactLayout}>
                    <ContactFormClient dict={dict} />

                    <div className={styles.contactInfo}>
                        <div className={styles.contactInfoCard}>
                            <div className={styles.contactInfoIcon}>📧</div>
                            <div>
                                <h3 className={styles.contactInfoTitle}>Email</h3>
                                <p className={styles.contactInfoText}>
                                    <a href="mailto:info@dutchgreenalternative.nl">info@dutchgreenalternative.nl</a>
                                </p>
                            </div>
                        </div>
                        <div className={styles.contactInfoCard}>
                            <div className={styles.contactInfoIcon}>💬</div>
                            <div>
                                <h3 className={styles.contactInfoTitle}>WhatsApp</h3>
                                <p className={styles.contactInfoText}>
                                    <a href="https://wa.me/31612345678" target="_blank" rel="noopener noreferrer">
                                        {dict.contact.whatsapp}
                                    </a>
                                </p>
                            </div>
                        </div>
                        <div className={styles.contactInfoCard}>
                            <div className={styles.contactInfoIcon}>🕐</div>
                            <div>
                                <h3 className={styles.contactInfoTitle}>
                                    {locale === "de" ? "Öffnungszeiten" : locale === "nl" ? "Openingstijden" : "Business Hours"}
                                </h3>
                                <p className={styles.contactInfoText}>
                                    {locale === "de" ? "Mo–Fr: 9:00–17:00" : locale === "nl" ? "Ma–Vr: 9:00–17:00" : "Mon–Fri: 9:00–17:00"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </main>
    );
}
