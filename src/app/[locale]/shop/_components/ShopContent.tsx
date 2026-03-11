"use client";

import { useState } from "react";
import { ProductCard } from "@/components/shared/ProductCard/ProductCard";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../shop.module.css";

type Product = {
    id: string;
    slug: string;
    category: "raw" | "pure_formula";
    price: string;
    image_urls: string[];
    translations: Record<string, { name: string; short_description: string; description: string }>;
};

type ShopContentProps = {
    products: Product[];
    locale: Locale;
    dict: Dictionary;
};

type CategoryFilter = "all" | "raw" | "pure_formula";

export function ShopContent({ products, locale, dict }: ShopContentProps) {
    const [activeFilter, setActiveFilter] = useState<CategoryFilter>("all");

    const filteredProducts =
        activeFilter === "all"
            ? products
            : products.filter((p) => p.category === activeFilter);

    const filters: { key: CategoryFilter; label: string }[] = [
        { key: "all", label: dict.shop.allProducts },
        { key: "raw", label: dict.shop.categoryRaw },
        { key: "pure_formula", label: dict.shop.categoryPure },
    ];

    return (
        <>
            {/* Category Filters */}
            <div className={styles.filters}>
                {filters.map((filter) => (
                    <button
                        key={filter.key}
                        className={`${styles.filterBtn} ${activeFilter === filter.key ? styles.filterBtnActive : ""
                            }`}
                        onClick={() => setActiveFilter(filter.key)}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* Product Grid */}
            <div className={styles.grid}>
                {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            locale={locale}
                            dict={dict}
                        />
                    ))
                ) : (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🌿</div>
                        <p>{dict.shop.noProducts}</p>
                    </div>
                )}
            </div>
        </>
    );
}
