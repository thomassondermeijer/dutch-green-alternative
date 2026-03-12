"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container/Container";
import { useScrollReveal } from "@/lib/animations/scroll-animations";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./ReviewsCarousel.module.css";

type DBReview = {
    id: string;
    customer_name: string;
    rating: number;
    text: string | null;
    image_urls: string[];
    language: string;
    verified_purchase: boolean;
    product: { name: string; slug: string } | null;
};

type ReviewsCarouselProps = {
    dict: Dictionary;
    locale: Locale;
};

const REVIEWS = [
    {
        text: {
            de: "Das Golden Spectrum nehme ich jetzt seit drei Monaten. Meine Gelenkschmerzen sind deutlich besser geworden. Morgens bin ich nicht mehr so steif.",
            en: "I've been taking the Golden Spectrum for three months now. My joint pain has improved significantly. I'm no longer so stiff in the mornings.",
            nl: "Ik gebruik het Golden Spectrum nu drie maanden. Mijn gewrichtspijn is flink verbeterd. 's Ochtends ben ik niet meer zo stijf.",
        },
        product: "Golden Spectrum 35%",
        rating: 5,
        image: "/reviews/review-1.jpg",
        name: "Klaus M.",
    },
    {
        text: {
            de: "Hilft sehr gut. Ich nehme das CBD Gold zur Unterstützung gegen Bluthochdruck. Dadurch konnte ich die Dosis meines Medikaments reduzieren.",
            en: "Works very well. I take the CBD Gold to help manage my blood pressure. It allowed me to reduce the dosage of my medication.",
            nl: "Werkt heel goed. Ik gebruik de CBD Gold ter ondersteuning bij hoge bloeddruk. Daardoor kon ik de dosis van mijn medicatie verlagen.",
        },
        product: "CBD Gold 35%",
        rating: 5,
        image: "/reviews/review-2.jpg",
        name: "Ingrid W.",
    },
    {
        text: {
            de: "Ich nehme jeden Abend vier Tropfen vom Golden Spectrum und schlafe seitdem viel besser. Kein Grübeln mehr, einfach einschlafen. Wunderbar!",
            en: "I take four drops of the Golden Spectrum every evening and have been sleeping much better since. No more overthinking, I just fall asleep. Wonderful!",
            nl: "Ik neem elke avond vier druppels Golden Spectrum en slaap sindsdien veel beter. Geen gepiekerd meer, gewoon in slaap vallen. Heerlijk!",
        },
        product: "Golden Spectrum 35%",
        rating: 5,
        image: "/reviews/review-3.jpg",
        name: "Sabine K.",
    },
    {
        text: {
            de: "Seit ich das Golden Spectrum nehme, sind meine Kopfschmerzen fast weg. Hätte nie gedacht, dass CBD so gut wirkt. Bin begeistert.",
            en: "Since I started taking the Golden Spectrum, my headaches are nearly gone. I never thought CBD could work so well. I'm thrilled.",
            nl: "Sinds ik het Golden Spectrum gebruik, zijn mijn hoofdpijnen bijna weg. Had nooit gedacht dat CBD zo goed zou werken. Ben enthousiast.",
        },
        product: "Golden Spectrum 35%",
        rating: 5,
        image: "/reviews/review-4.jpg",
        name: "Petra S.",
    },
    {
        text: {
            de: "Gutes Preis-Leistungs-Verhältnis und schneller, unkomplizierter Service. Das CBD Gold ist das beste Öl, das ich bisher probiert habe.",
            en: "Great value for money and fast, hassle-free service. CBD Gold is the best oil I've tried so far.",
            nl: "Goede prijs-kwaliteitverhouding en snelle, ongecompliceerde service. De CBD Gold is de beste olie die ik tot nu toe heb geprobeerd.",
        },
        product: "CBD Gold 35%",
        rating: 5,
        image: "/reviews/review-5.jpg",
        name: "Rainer H.",
    },
    {
        text: {
            de: "Die 5,5% RAW ist perfekt für den Einstieg. Nehme täglich 3 Tropfen und merke, wie meine Verspannungen nachlassen. Sehr mild im Geschmack.",
            en: "The 5.5% RAW is perfect for getting started. I take 3 drops daily and notice my tension easing. Very mild taste.",
            nl: "De 5,5% RAW is perfect om mee te beginnen. Ik neem dagelijks 3 druppels en merk dat mijn spanningen afnemen. Heel mild van smaak.",
        },
        product: "RAW CBD 5.5%",
        rating: 5,
        image: "/reviews/review-6.jpg",
        name: "Hannelore B.",
    },
    {
        text: {
            de: "Die 11% RAW hilft mir gut, meine Muskelbeschwerden unter Kontrolle zu halten. 20 Minuten nach der Einnahme merke ich schon einen Unterschied. Empfehlenswert!",
            en: "The 11% RAW helps me keep my muscle issues under control. I notice a difference within 20 minutes of taking it. Highly recommended!",
            nl: "De 11% RAW helpt mij goed om mijn spierklachten onder controle te houden. 20 minuten na inname merk ik al verschil. Aanrader!",
        },
        product: "RAW CBD 11%",
        rating: 5,
        image: "/reviews/review-7.jpg",
        name: "Jan V.",
    },
    {
        text: {
            de: "Sehr schnelle Lieferung, hervorragende Qualität. Kann das Golden Spectrum nur empfehlen. Meine Frau nimmt es jetzt auch.",
            en: "Very fast delivery, excellent quality. I can only recommend the Golden Spectrum. My wife is now taking it too.",
            nl: "Zeer snelle levering, uitstekende kwaliteit. Kan het Golden Spectrum alleen maar aanbevelen. Mijn vrouw gebruikt het nu ook.",
        },
        product: "Golden Spectrum 35%",
        rating: 5,
        image: "/reviews/review-8.jpg",
        name: "Wolfgang D.",
    },
];

export function ReviewsCarousel({ dict, locale }: ReviewsCarouselProps) {
    const [sectionRef, isVisible] = useScrollReveal<HTMLElement>();
    const [activeIndex, setActiveIndex] = useState(0);
    const trackRef = useRef<HTMLDivElement>(null);
    const autoplayRef = useRef<NodeJS.Timeout | null>(null);
    const [allReviews, setAllReviews] = useState(REVIEWS);

    // Fetch DB reviews and merge with seed data
    useEffect(() => {
        fetch("/api/reviews/approved?limit=10")
            .then(r => r.json())
            .then(data => {
                const dbReviews = (data.reviews || []).filter((r: DBReview) => r.text).map((r: DBReview) => ({
                    text: { de: r.text!, en: r.text!, nl: r.text! },
                    product: r.product?.name || "CBD",
                    rating: r.rating,
                    image: r.image_urls?.[0] || "/reviews/review-1.jpg",
                    name: r.customer_name,
                    verified: true,
                }));
                if (dbReviews.length > 0) {
                    setAllReviews([...dbReviews, ...REVIEWS]);
                }
            })
            .catch(() => { });
    }, []);

    const startAutoplay = useCallback(() => {
        autoplayRef.current = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % allReviews.length);
        }, 5000);
    }, [allReviews.length]);

    const stopAutoplay = useCallback(() => {
        if (autoplayRef.current) clearInterval(autoplayRef.current);
    }, []);

    useEffect(() => {
        if (isVisible) startAutoplay();
        return () => stopAutoplay();
    }, [isVisible]);

    const goTo = (i: number) => {
        stopAutoplay();
        setActiveIndex(i);
        startAutoplay();
    };

    const prev = () => goTo((activeIndex - 1 + allReviews.length) % allReviews.length);
    const next = () => goTo((activeIndex + 1) % allReviews.length);

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
                        {allReviews.map((review, i) => {
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
                                                width={160}
                                                height={160}
                                                className={styles.cardImage}
                                            />
                                        </div>
                                        <div className={styles.cardContent}>
                                            <div className={styles.quoteIcon}>&ldquo;</div>
                                            {renderStars(review.rating)}
                                            <p className={styles.reviewText}>{review.text[locale] || review.text.de}</p>
                                            <div className={styles.reviewFooter}>
                                                <span className={styles.reviewName}>{review.name}</span>
                                                <span className={styles.reviewProduct}>— {review.product}</span>
                                                {Boolean((review as Record<string, unknown>).verified) && (
                                                    <span className={styles.verifiedBadge}>✓</span>
                                                )}
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
                    {allReviews.map((_, i) => (
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
