import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./ProductCard.module.css";

type Product = {
    id: string;
    slug: string;
    category: "raw" | "pure_formula";
    price: string;
    image_urls: string[];
    translations: Record<string, { name: string; short_description: string; description: string }>;
};

type ProductCardProps = {
    product: Product;
    locale: Locale;
    dict: Dictionary;
};

export function ProductCard({ product, locale, dict }: ProductCardProps) {
    const t = product.translations[locale] || product.translations["de"];
    const categoryLabel = product.category === "raw"
        ? dict.shop.categoryRaw
        : dict.shop.categoryPure;

    return (
        <Link href={`/${locale}/shop/${product.slug}`} className={styles.card}>
            {/* Product Image */}
            <div className={styles.imageWrap}>
                <span
                    className={`${styles.category} ${product.category === "raw" ? styles.categoryRaw : styles.categoryPure
                        }`}
                >
                    {categoryLabel}
                </span>
                {product.image_urls && product.image_urls.length > 0 ? (
                    <Image
                        src={product.image_urls[0]}
                        alt={t.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        style={{ objectFit: "cover" }}
                    />
                ) : (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "linear-gradient(135deg, var(--color-bg-alt), var(--color-accent-light))",
                            fontSize: "3rem",
                        }}
                    >
                        🌿
                    </div>
                )}
            </div>

            {/* Content */}
            <div className={styles.content}>
                <h3 className={styles.name}>{t.name}</h3>
                <p className={styles.description}>{t.short_description}</p>

                <div className={styles.bottom}>
                    <span className={styles.price}>€{parseFloat(product.price).toFixed(2)}</span>
                    <span className={styles.addBtn} aria-label={dict.shop.addToCart}>+</span>
                </div>
            </div>
        </Link>
    );
}
