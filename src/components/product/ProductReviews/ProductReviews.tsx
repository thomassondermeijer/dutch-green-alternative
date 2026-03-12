"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./ProductReviews.module.css";

type Review = {
    id: string;
    customer_name: string;
    rating: number;
    text: string | null;
    image_urls: string[];
    verified_purchase: boolean;
    created_at: string;
};

type ProductReviewsProps = {
    productId: string;
    locale: Locale;
    dict: Dictionary;
};

const labels = {
    de: { title: "Kundenbewertungen", noReviews: "Noch keine Bewertungen", verified: "Verifizierter Kauf", writeReview: "Bewertung schreiben" },
    nl: { title: "Klantbeoordelingen", noReviews: "Nog geen beoordelingen", verified: "Geverifieerde aankoop", writeReview: "Beoordeling schrijven" },
    en: { title: "Customer Reviews", noReviews: "No reviews yet", verified: "Verified Purchase", writeReview: "Write a Review" },
};

export function ProductReviews({ productId, locale, dict }: ProductReviewsProps) {
    const t = labels[locale] || labels.de;
    const [reviews, setReviews] = useState<Review[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [lightbox, setLightbox] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/reviews/product?product_id=${productId}`)
            .then(r => r.json())
            .then(data => {
                setReviews(data.reviews || []);
                setAvgRating(data.averageRating || 0);
                setTotalCount(data.totalCount || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [productId]);

    const renderStars = (count: number, size = 16) => (
        <div className={styles.stars}>
            {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width={size} height={size} viewBox="0 0 24 24"
                    fill={i < count ? "#f59e0b" : "none"}
                    stroke={i < count ? "#f59e0b" : "#d1d5db"}
                    strokeWidth="1.5"
                >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
            ))}
        </div>
    );

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-GB", {
            day: "numeric", month: "short", year: "numeric",
        });
    };

    if (loading) return null;

    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <h3 className={styles.title}>{t.title}</h3>
                {totalCount > 0 && (
                    <div className={styles.summary}>
                        {renderStars(Math.round(avgRating), 20)}
                        <span className={styles.avgText}>{avgRating.toFixed(1)}</span>
                        <span className={styles.countText}>({totalCount})</span>
                    </div>
                )}
            </div>

            {reviews.length === 0 ? (
                <p className={styles.noReviews}>{t.noReviews}</p>
            ) : (
                <div className={styles.reviewsList}>
                    {reviews.map(review => (
                        <div key={review.id} className={styles.reviewCard}>
                            <div className={styles.reviewHeader}>
                                <div>
                                    {renderStars(review.rating)}
                                    <span className={styles.reviewName}>{review.customer_name}</span>
                                    {review.verified_purchase && (
                                        <span className={styles.verifiedBadge}>✓ {t.verified}</span>
                                    )}
                                </div>
                                <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                            </div>

                            {review.text && <p className={styles.reviewText}>{review.text}</p>}

                            {review.image_urls && review.image_urls.length > 0 && (
                                <div className={styles.reviewImages}>
                                    {review.image_urls.map((url, i) => (
                                        <div key={i} className={styles.reviewImageWrap} onClick={() => setLightbox(url)}>
                                            <Image src={url} alt={`Review ${i + 1}`} width={80} height={80} className={styles.reviewImage} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div className={styles.lightbox} onClick={() => setLightbox(null)}>
                    <Image src={lightbox} alt="Review photo" width={600} height={600} className={styles.lightboxImage} />
                </div>
            )}
        </section>
    );
}
