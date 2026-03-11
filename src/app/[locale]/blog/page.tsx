import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import styles from "../content.module.css";

export default async function BlogPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    // Blog posts will be fetched from Supabase in a future task
    // For now, show a "coming soon" state
    return (
        <main className={styles.page}>
            <Container>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>{dict.blog.title}</h1>
                    <div className={styles.pageLine} />
                </div>

                <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--color-text-light)" }}>
                    <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>📝</p>
                    <p style={{ fontSize: "var(--font-size-lg)" }}>{dict.blog.noPosts}</p>
                </div>
            </Container>
        </main>
    );
}
