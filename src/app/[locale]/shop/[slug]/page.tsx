import type { Metadata } from "next";
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { ProductCard } from "@/components/shared/ProductCard/ProductCard";
import { ProductDetail } from "./_components/ProductDetail";
import { productJsonLd, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import styles from "./product.module.css";

type Product = {
    id: string;
    slug: string;
    category: "raw" | "pure_formula";
    price: string;
    stock: number;
    specs: {
        drops?: string;
        cbd_percentage?: string;
        thc?: string;
        target?: string;
        type?: string;
        volume_ml?: number;
    };
    image_urls: string[];
    translations: Record<string, {
        name: string;
        short_description: string;
        description: string;
        ingredients?: string;
        dosage_steps?: string[];
        faqs?: { q: string; a: string }[];
    }>;
};

async function getAllProducts(): Promise<Product[]> {
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

async function getProduct(slug: string): Promise<Product | null> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/products?slug=eq.${slug}&is_active=eq.true&limit=1`,
            {
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                },
                next: { revalidate: 3600 },
            }
        );
        if (res.ok) {
            const data = await res.json();
            return data[0] || null;
        }
    } catch { }
    return null;
}

export async function generateStaticParams() {
    const products = await getAllProducts();
    const params: { locale: string; slug: string }[] = [];

    for (const locale of i18n.locales) {
        for (const product of products) {
            params.push({ locale, slug: product.slug });
        }
    }

    return params;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale, slug } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const product = await getProduct(slug);

    if (!product) {
        return { title: "Product Not Found" };
    }

    const t = product.translations[locale] || product.translations["de"];

    return {
        title: t.name,
        description: t.short_description,
        openGraph: {
            title: t.name,
            description: t.short_description,
            images: product.image_urls?.[0] ? [product.image_urls[0]] : [],
        },
        alternates: {
            canonical: `/${locale}/shop/${slug}`,
            languages: {
                de: `/de/shop/${slug}`,
                nl: `/nl/shop/${slug}`,
                en: `/en/shop/${slug}`,
            },
        },
    };
}

export default async function ProductPage({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}) {
    const { locale: rawLocale, slug } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);
    const product = await getProduct(slug);

    if (!product) {
        return (
            <main className={styles.page}>
                <Container>
                    <div style={{ textAlign: "center", padding: "6rem 0" }}>
                        <h1>Product Not Found</h1>
                        <p style={{ color: "var(--color-text-light)", marginTop: "1rem" }}>
                            {dict.common.notFound}
                        </p>
                    </div>
                </Container>
            </main>
        );
    }

    // Get related products (same category, excluding current)
    const allProducts = await getAllProducts();
    const relatedProducts = allProducts
        .filter((p) => p.category === product.category && p.id !== product.id)
        .slice(0, 4);

    const t = product.translations[locale] || product.translations["de"];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

    const productSchema = productJsonLd({
        name: t.name,
        description: t.short_description,
        price: product.price,
        image: product.image_urls?.[0],
        slug: product.slug,
        locale,
        inStock: product.stock > 0,
        sku: (product as Record<string, unknown>).sku as string | undefined,
    });

    const faqSchema = t.faqs ? faqJsonLd(t.faqs) : null;

    const breadcrumb = breadcrumbJsonLd([
        { name: "Home", url: `${siteUrl}/${locale}` },
        { name: "Shop", url: `${siteUrl}/${locale}/shop` },
        { name: t.name, url: `${siteUrl}/${locale}/shop/${slug}` },
    ]);

    return (
        <main className={styles.page}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
            />
            {faqSchema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
                />
            )}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
            />
            <Container>
                <ProductDetail product={product} locale={locale} dict={dict} />

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <section className={styles.relatedSection}>
                        <h2 className={styles.relatedTitle}>{dict.product.relatedProducts}</h2>
                        <div className={styles.relatedGrid}>
                            {relatedProducts.map((p) => (
                                <ProductCard key={p.id} product={p} locale={locale} dict={dict} />
                            ))}
                        </div>
                    </section>
                )}
            </Container>
        </main>
    );
}
