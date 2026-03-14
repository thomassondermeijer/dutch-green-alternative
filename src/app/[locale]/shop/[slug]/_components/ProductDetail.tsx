"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button/Button";
import { useCart } from "@/lib/cart/cart-context";
import { useToast } from "@/components/shared/Toast/Toast";
import { ProductReviews } from "@/components/product/ProductReviews/ProductReviews";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../product.module.css";

type Product = {
    id: string;
    slug: string;
    category: "raw" | "pure_formula";
    price: string;
    stock: number;
    image_urls: string[];
    specs: {
        drops?: string;
        cbd_percentage?: string;
        thc?: string;
        target?: string;
        type?: string;
        volume_ml?: number;
    };
    translations: Record<string, {
        name: string;
        short_description: string;
        description: string;
        ingredients?: string;
        dosage_steps?: string[];
        faqs?: { q: string; a: string }[];
    }>;
};

type ProductDetailProps = {
    product: Product;
    locale: Locale;
    dict: Dictionary;
};

export function ProductDetail({ product, locale, dict }: ProductDetailProps) {
    const [activeImage, setActiveImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const { addItem, openDrawer } = useCart();
    const { showToast } = useToast();

    // Capture coupon from URL and persist to localStorage
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const couponParam = params.get("coupon");
            if (couponParam) {
                const code = couponParam.toUpperCase();
                localStorage.setItem("dga_coupon", JSON.stringify({
                    code,
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                }));
                // Show confirmation toast
                const msg = (dict.cart.couponSaved || "✨ Discount code {code} saved!").replace("{code}", code);
                showToast(msg, "coupon");
            }
        } catch { /* ignore */ }
    }, []);

    const t = product.translations[locale] || product.translations["de"];
    const categoryLabel =
        product.category === "raw" ? dict.shop.categoryRaw : dict.shop.categoryPure;

    const handleAddToCart = () => {
        addItem({
            id: product.id,
            slug: product.slug,
            name: t.name,
            price: parseFloat(product.price),
            quantity,
            image: product.image_urls?.[0],
            category: product.category,
        });
        showToast(`${dict.product.addedToCart}: ${t.name}`);
        openDrawer();
        setQuantity(1);
    };

    const specs = product.specs || {};
    const inStock = (product.stock ?? 0) > 0;

    return (
        <>
            {/* ── Section 1: Two-column hero ── */}
            <div className={styles.productLayout}>
                {/* Image Gallery */}
                <div className={styles.gallery}>
                    <div className={styles.mainImage}>
                        {product.image_urls && product.image_urls.length > 0 ? (
                            <Image
                                src={product.image_urls[activeImage] || product.image_urls[0]}
                                alt={t.name}
                                fill
                                sizes="(max-width: 768px) 100vw, 50vw"
                                style={{ objectFit: "cover" }}
                                priority
                            />
                        ) : (
                            <div className={styles.placeholderImage}>🌿</div>
                        )}
                    </div>

                    {product.image_urls && product.image_urls.length > 1 && (
                        <div className={styles.thumbnails}>
                            {product.image_urls.map((url, idx) => (
                                <button
                                    key={idx}
                                    className={`${styles.thumb} ${idx === activeImage ? styles.thumbActive : ""}`}
                                    onClick={() => setActiveImage(idx)}
                                >
                                    <Image
                                        src={url}
                                        alt={`${t.name} ${idx + 1}`}
                                        fill
                                        sizes="72px"
                                        style={{ objectFit: "cover" }}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className={styles.info}>
                    {/* Breadcrumb */}
                    <nav className={styles.breadcrumb}>
                        <Link href={`/${locale}`}>{dict.nav.home}</Link>
                        <span>/</span>
                        <Link href={`/${locale}/shop`}>{dict.nav.shop}</Link>
                        <span>/</span>
                        <span>{t.name}</span>
                    </nav>

                    {/* Category Badge */}
                    <span
                        className={`${styles.categoryBadge} ${product.category === "raw" ? styles.categoryRaw : styles.categoryPure
                            }`}
                    >
                        {categoryLabel}
                    </span>

                    {/* Name & Price */}
                    <h1 className={styles.productName}>{t.name}</h1>
                    <span className={styles.price}>€{parseFloat(product.price).toFixed(2)}</span>

                    {/* Short Description */}
                    <p className={styles.shortDesc}>{t.short_description}</p>

                    {/* Specs Grid */}
                    {specs && Object.keys(specs).length > 0 && (
                        <div className={styles.specsGrid}>
                            {specs.drops && (
                                <div className={styles.specItem}>
                                    <span className={styles.specIcon}>💧</span>
                                    <div>
                                        <span className={styles.specLabel}>{dict.product.drops || "Drops"}</span>
                                        <span className={styles.specValue}>{specs.drops}</span>
                                    </div>
                                </div>
                            )}
                            {specs.cbd_percentage && (
                                <div className={styles.specItem}>
                                    <span className={styles.specIcon}>🌿</span>
                                    <div>
                                        <span className={styles.specLabel}>CBD</span>
                                        <span className={styles.specValue}>{specs.cbd_percentage}</span>
                                    </div>
                                </div>
                            )}
                            {specs.volume_ml && (
                                <div className={styles.specItem}>
                                    <span className={styles.specIcon}>📦</span>
                                    <div>
                                        <span className={styles.specLabel}>{dict.product.volume || "Volume"}</span>
                                        <span className={styles.specValue}>{specs.volume_ml}ml</span>
                                    </div>
                                </div>
                            )}
                            {specs.type && (
                                <div className={styles.specItem}>
                                    <span className={styles.specIcon}>🏷️</span>
                                    <div>
                                        <span className={styles.specLabel}>{dict.product.type || "Type"}</span>
                                        <span className={styles.specValue}>{specs.type === "full_spectrum" ? "Full Spectrum" : "Pure Formula+"}</span>
                                    </div>
                                </div>
                            )}
                            {specs.thc && (
                                <div className={styles.specItem}>
                                    <span className={styles.specIcon}>🧪</span>
                                    <div>
                                        <span className={styles.specLabel}>THC</span>
                                        <span className={styles.specValue}>{specs.thc}</span>
                                    </div>
                                </div>
                            )}
                            <div className={styles.specItem}>
                                <span className={styles.specIcon}>{inStock ? "✅" : "❌"}</span>
                                <div>
                                    <span className={styles.specLabel}>Status</span>
                                    <span className={`${styles.specValue} ${inStock ? styles.inStock : styles.outOfStock}`}>
                                        {inStock ? (dict.product.inStock || "In Stock") : (dict.product.outOfStock || "Out of Stock")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quantity + Add to Cart */}
                    <div className={styles.purchaseRow}>
                        <div className={styles.quantityControl}>
                            <button
                                className={styles.qtyBtn}
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                aria-label="Decrease quantity"
                            >
                                −
                            </button>
                            <span className={styles.qtyValue}>{quantity}</span>
                            <button
                                className={styles.qtyBtn}
                                onClick={() => setQuantity(quantity + 1)}
                                aria-label="Increase quantity"
                            >
                                +
                            </button>
                        </div>

                        <div className={styles.addToCartBtn}>
                            <Button
                                variant="primary"
                                size="lg"
                                fullWidth
                                onClick={handleAddToCart}
                            >
                                {dict.shop.addToCart}
                            </Button>
                        </div>
                    </div>

                    {/* Trust Badges */}
                    <div className={styles.trustBadges}>
                        <div className={styles.trustBadge}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 3h15v13H1z" />
                                <path d="M16 8h4l3 3v5h-7V8z" />
                                <circle cx="5.5" cy="18.5" r="2.5" />
                                <circle cx="18.5" cy="18.5" r="2.5" />
                            </svg>
                            <span>{dict.shop.freeShipping}</span>
                        </div>
                        <div className={styles.trustBadge}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <span>{dict.product.securePayment || "Secure Payment"}</span>
                        </div>
                        <div className={styles.trustBadge}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12l2 2 4-4" />
                                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                            </svg>
                            <span>{dict.product.labTested || "Lab Tested"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Section 2: Full-width description ── */}
            <section className={styles.descriptionSection}>
                <h2 className={styles.sectionTitle}>{t.name}</h2>
                <div
                    className={styles.descriptionContent}
                    dangerouslySetInnerHTML={{ __html: t.description.replace(/\n/g, "<br/>") }}
                />
            </section>

            {/* ── Section 3: Dosage + Ingredients ── */}
            {(t.dosage_steps || t.ingredients) && (
                <section className={styles.dosageSection}>
                    {t.dosage_steps && t.dosage_steps.length > 0 && (
                        <div className={styles.dosageSteps}>
                            <h3 className={styles.sectionSubtitle}>{dict.product.dosage}</h3>
                            <ol className={styles.stepsList}>
                                {t.dosage_steps.map((step, idx) => (
                                    <li key={idx} className={styles.stepItem}>
                                        <span className={styles.stepNumber}>{idx + 1}</span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {t.ingredients && (
                        <div className={styles.ingredientsBox}>
                            <h3 className={styles.sectionSubtitle}>{dict.product.ingredients || "Ingredients"}</h3>
                            <p className={styles.ingredientsText}>{t.ingredients}</p>
                        </div>
                    )}
                </section>
            )}

            {/* ── Section 4: FAQ Accordion ── */}
            {t.faqs && t.faqs.length > 0 && (
                <section className={styles.faqSection}>
                    <h2 className={styles.sectionTitle}>{dict.product.faq || "FAQ"}</h2>
                    <div className={styles.faqList}>
                        {t.faqs.map((faq, idx) => (
                            <div key={idx} className={`${styles.faqItem} ${openFaq === idx ? styles.faqOpen : ""}`}>
                                <button
                                    className={styles.faqQuestion}
                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                    aria-expanded={openFaq === idx}
                                >
                                    <span>{faq.q}</span>
                                    <svg
                                        className={styles.faqChevron}
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                                <div className={styles.faqAnswer}>
                                    <p>{faq.a}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Section 5: Customer Reviews ── */}
            <ProductReviews productId={product.id} locale={locale} dict={dict} />
        </>
    );
}
