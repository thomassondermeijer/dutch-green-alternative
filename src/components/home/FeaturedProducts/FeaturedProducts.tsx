"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

type FilterCategory = "all" | "raw" | "pure_formula";

const TABS: { key: FilterCategory; label: Record<string, string> }[] = [
    { key: "all", label: { en: "All", de: "Alle", nl: "Alle" } },
    { key: "raw", label: { en: "RAW CBD & CBG", de: "RAW CBD & CBG", nl: "RAW CBD & CBG" } },
    { key: "pure_formula", label: { en: "Pure Formula+", de: "Pure Formula+", nl: "Pure Formula+" } },
];

export function FeaturedProducts({ products, locale, dict }: FeaturedProductsProps) {
    const [sectionRef, isVisible] = useScrollReveal<HTMLElement>();
    const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const tabsRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const filtered = activeFilter === "all"
        ? products.slice(0, 6)
        : products.filter((p) => p.category === activeFilter);

    const updateIndicator = useCallback(() => {
        const idx = TABS.findIndex((t) => t.key === activeFilter);
        const tab = tabRefs.current[idx];
        const container = tabsRef.current;
        if (tab && container) {
            const containerRect = container.getBoundingClientRect();
            const tabRect = tab.getBoundingClientRect();
            setIndicatorStyle({
                left: tabRect.left - containerRect.left,
                width: tabRect.width,
            });
        }
    }, [activeFilter]);

    useEffect(() => {
        updateIndicator();
        window.addEventListener("resize", updateIndicator);
        return () => window.removeEventListener("resize", updateIndicator);
    }, [updateIndicator]);

    return (
        <section className={styles.section} ref={sectionRef}>
            <Container>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{dict.home.featuredTitle}</h2>
                    <div className={styles.sectionLine} />
                </div>

                {/* Sliding Tabs */}
                <div className={styles.tabsWrapper}>
                    <div className={styles.tabs} ref={tabsRef}>
                        {TABS.map((tab, i) => (
                            <button
                                key={tab.key}
                                ref={(el) => { tabRefs.current[i] = el; }}
                                className={`${styles.tab} ${activeFilter === tab.key ? styles.tabActive : ""}`}
                                onClick={() => setActiveFilter(tab.key)}
                            >
                                {tab.label[locale] || tab.label.en}
                            </button>
                        ))}
                        <div
                            className={styles.tabIndicator}
                            style={{
                                left: `${indicatorStyle.left}px`,
                                width: `${indicatorStyle.width}px`,
                            }}
                        />
                    </div>
                </div>

                <div className={styles.grid}>
                    {filtered.map((product) => (
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
