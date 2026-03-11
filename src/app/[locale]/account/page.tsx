import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { AccountDashboard } from "./_components/AccountDashboard";
import styles from "./account.module.css";

export default async function AccountPage({
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
                <AccountDashboard locale={locale} dict={dict} />
            </Container>
        </main>
    );
}
