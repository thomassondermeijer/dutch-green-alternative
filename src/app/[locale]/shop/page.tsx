import type { Metadata } from "next";
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { ShopContent } from "./_components/ShopContent";
import styles from "./shop.module.css";

async function getProducts() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return [];

    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/products?is_active=eq.true&order=sort_order.asc`,
            {
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                },
                next: { revalidate: 3600 },
            }
        );
        if (res.ok) return await res.json();
    } catch { }
    return [];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return {
        title: dict.shop.title,
        description: dict.shop.subtitle,
    };
}

export default async function ShopPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);
    const products = await getProducts();

    return (
        <main className={styles.page}>
            <Container>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>{dict.shop.title}</h1>
                    <p className={styles.pageSubtitle}>{dict.shop.subtitle}</p>
                </div>

                <ShopContent products={products} locale={locale} dict={dict} />
            </Container>
        </main>
    );
}
