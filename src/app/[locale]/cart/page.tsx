import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { CartContent } from "./_components/CartContent";
import styles from "./cart.module.css";

export default async function CartPage({
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
                <h1 className={styles.pageTitle}>{dict.cart.title}</h1>
                <CartContent locale={locale} dict={dict} />
            </Container>
        </main>
    );
}
