"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container/Container";
import { useScrollReveal } from "@/lib/animations/scroll-animations";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./ReviewsCarousel.module.css";

type ReviewsCarouselProps = {
    dict: Dictionary;
};

const REVIEWS = [
    {
        text: "Das Golden Spectrum nehme ich jetzt seit drei Monaten. Meine Gelenkschmerzen sind deutlich besser geworden. Morgens bin ich nicht mehr so steif.",
        product: "Golden Spectrum 35%",
        rating: 5,
        image: "/reviews/review-1.jpg",
        name: "Klaus M.",
    },
    {
        text: "Hilft sehr gut. Ich nehme das CBD Gold zur Unterstützung gegen Bluthochdruck. Dadurch konnte ich die Dosis meines Medikaments reduzieren.",
        product: "CBD Gold 35%",
        rating: 5,
        image: "/reviews/review-2.jpg",
        name: "Ingrid W.",
    },
    {
        text: "Ich nehme jeden Abend vier Tropfen vom Golden Spectrum und schlafe seitdem viel besser. Kein Grübeln mehr, einfach einschlafen. Wunderbar!",
        product: "Golden Spectrum 35%",
        rating: 5,
        image: "/reviews/review-3.jpg",
        name: "Sabine K.",
    },
    {
        text: "Seit ich das Golden Spectrum nehme, sind meine Kopfschmerzen fast weg. Hätte nie gedacht, dass CBD so gut wirkt. Bin begeistert.",
        product: "Golden Spectrum 35%",
        rating: 5,
        image: "/reviews/review-4.jpg",
        name: "Petra S.",
    },
    {
        text: "Gutes Preis-Leistungs-Verhältnis und schneller, unkomplizierter Service. Das CBD Gold ist das beste Öl, das ich bisher probiert habe.",
        product: "CBD Gold 35%",
        rating: 5,
        image: "/reviews/review-5.jpg",
        name: "Rainer H.",
    },
    {
        text: "Die 5,5% RAW ist perfekt für den Einstieg. Nehme täglich 3 Tropfen und merke, wie meine Verspannungen nachlassen. Sehr mild im Geschmack.",
        product: "RAW CBD 5.5%",
        rating: 5,
        image: "/reviews/review-6.jpg",
        name: "Hannelore B.",
    },
    {
        text: "De 11% RAW helpt mij goed om mijn spierklachten onder controle te houden. 20 minuten na inname merk ik al verschil. Aanrader!",
        product: "RAW CBD 11%",
        rating: 5,
        image: "/reviews/review-7.jpg",
        name: "Jan V.",
    },
    {
        text: "Sehr schnelle Lieferung, hervorragende Qualität. Kann das Golden Spectrum nur empfehlen. Meine Frau nimmt es jetzt auch.",
        product: "Golden Spectrum 35%",
        rating: 5,
        image: "/reviews/review-8.jpg",
        name: "Wolfgang D.",
    },
];

export function ReviewsCarousel({ dict }: ReviewsCarouselProps) {
    const [sectionRef, isVisible] = useScrollReveal<HTMLElement>();
    const [activeIndex, setActiveIndex] = useState(0);
    const trackRef = useRef<HTMLDivElement>(null);
    const autoplayRef = useRef<NodeJS.Timeout | null>(null);

    const startAutoplay = () => {
        autoplayRef.current = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % REVIEWS.length);
        }, 5000);
    };

    const stopAutoplay = () => {
        if (autoplayRef.current) clearInterval(autoplayRef.current);
    };

    useEffect(() => {
        if (isVisible) startAutoplay();
        return () => stopAutoplay();
    }, [isVisible]);

    const goTo = (i: number) => {
        stopAutoplay();
        setActiveIndex(i);
        startAutoplay();
    };

    const prev = () => goTo((activeIndex - 1 + REVIEWS.length) % REVIEWS.length);
    const next = () => goTo((activeIndex + 1) % REVIEWS.length);

    const renderStars = (count: number) => (
        <div className={styles.stars}>
            {Array.from({ length: count }).map((_, i) => (
                <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="var(--color-secondary)" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
            ))}
        </div>
    );

    return (
        <section className={styles.section} ref={sectionRef}>
            <Container>
                <div className={styles.sectionHeader}>
                    <div className={styles.reviewCount}>
                        {renderStars(5)}
                        <span className={styles.reviewCountText}>975+ {dict.product.reviews}</span>
                    </div>
                    <h2 className={styles.sectionTitle}>{dict.home.reviewsTitle || "Was unsere Kunden sagen"}</h2>
                </div>

                <div
                    className={styles.carouselWrapper}
                    onMouseEnter={stopAutoplay}
                    onMouseLeave={startAutoplay}
                >
                    <button className={`${styles.arrow} ${styles.arrowPrev}`} onClick={prev} aria-label="Previous">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>

                    <div className={styles.track} ref={trackRef}>
                        {REVIEWS.map((review, i) => {
                            const offset = i - activeIndex;
                            const isActive = i === activeIndex;
                            return (
                                <div
                                    key={i}
                                    className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
                                    style={{
                                        transform: `translateX(${offset * 105}%) scale(${isActive ? 1 : 0.88})`,
                                        opacity: Math.abs(offset) > 1 ? 0 : isActive ? 1 : 0.5,
                                        zIndex: isActive ? 2 : 1,
                                    }}
                                >
                                    <div className={styles.cardInner}>
                                        <div className={styles.cardImageWrap}>
                                            <Image
                                                src={review.image}
                                                alt={review.name}
                                                width={120}
                                                height={120}
                                                className={styles.cardImage}
                                            />
                                        </div>
                                        <div className={styles.cardContent}>
                                            <div className={styles.quoteIcon}>&ldquo;</div>
                                            {renderStars(review.rating)}
                                            <p className={styles.reviewText}>{review.text}</p>
                                            <div className={styles.reviewFooter}>
                                                <span className={styles.reviewName}>{review.name}</span>
                                                <span className={styles.reviewProduct}>— {review.product}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button className={`${styles.arrow} ${styles.arrowNext}`} onClick={next} aria-label="Next">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>
                </div>

                {/* Dots */}
                <div className={styles.dots}>
                    {REVIEWS.map((_, i) => (
                        <button
                            key={i}
                            className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ""}`}
                            onClick={() => goTo(i)}
                            aria-label={`Review ${i + 1}`}
                        />
                    ))}
                </div>
            </Container>
        </section>
    );
}
