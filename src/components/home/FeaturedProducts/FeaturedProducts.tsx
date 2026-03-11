"use client";

import { Container } from "@/components/ui/Container/Container";
import { Button } from "@/components/ui/Button/Button";
import { ProductCard } from "@/components/shared/ProductCard/ProductCard";
import { useScrollReveal } from "@/lib/animations/scroll-animations";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./FeaturedProducts.module.css";

type Product = {
    id: string;
    slug: string;
    category: "raw" | "pure_formula";
    price: string;
    image_urls: string[];
    translations: Record<string, { name: string; short_description: string; description: string }>;
};

type FeaturedProductsProps = {
    products: Product[];
    locale: Locale;
    dict: Dictionary;
};

export function FeaturedProducts({ products, locale, dict }: FeaturedProductsProps) {
    const [sectionRef, isVisible] = useScrollReveal<HTMLElement>();

    return (
        <section className={styles.section} ref={sectionRef}>
            <Container>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{dict.home.featuredTitle}</h2>
                    <div className={styles.sectionLine} />
                </div>

                <div className={styles.grid}>
                    {products.slice(0, 6).map((product) => (
                        <div
                            key={product.id}
                            className={`${styles.revealItem} ${isVisible ? styles.visible : ""}`}
                        >
                            <ProductCard product={product} locale={locale} dict={dict} />
                        </div>
                    ))}
                </div>

                <div className={styles.viewAll}>
                    <Button variant="outline" href={`/${locale}/shop`}>
                        {dict.shop.allProducts} →
                    </Button>
                </div>
            </Container>
        </section>
    );
}
