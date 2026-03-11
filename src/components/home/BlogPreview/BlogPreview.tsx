"use client";

import { Container } from "@/components/ui/Container/Container";
import { useScrollReveal } from "@/lib/animations/scroll-animations";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import styles from "./BlogPreview.module.css";

type BlogPreviewProps = {
    locale: Locale;
    dict: Dictionary;
};

// Placeholder blog data until real posts are fetched from Supabase
const placeholderPosts = [
    {
        slug: "was-ist-cbd",
        tag: "CBD 101",
        titleDe: "Was ist CBD und wie wirkt es?",
        titleNl: "Wat is CBD en hoe werkt het?",
        titleEn: "What is CBD and how does it work?",
        excerptDe: "Erfahren Sie alles über Cannabidiol, seine Wirkungsweise im Endocannabinoid-System und warum immer mehr Menschen CBD in ihren Alltag integrieren.",
        excerptNl: "Leer alles over cannabidiol, hoe het werkt in het endocannabinoïde systeem en waarom steeds meer mensen CBD in hun dagelijks leven integreren.",
        excerptEn: "Learn all about cannabidiol, how it works in the endocannabinoid system and why more and more people are integrating CBD into their daily lives.",
    },
    {
        slug: "cbd-dosierung",
        tag: "Guide",
        titleDe: "CBD Dosierung: So finden Sie die richtige Menge",
        titleNl: "CBD dosering: zo vindt u de juiste hoeveelheid",
        titleEn: "CBD Dosage: How to Find the Right Amount",
        excerptDe: "Die richtige CBD-Dosierung ist individuell. Wir zeigen Ihnen, wie Sie Schritt für Schritt Ihre optimale Dosis finden — sicher und effektiv.",
        excerptNl: "De juiste CBD-dosering is individueel. Wij laten u zien hoe u stap voor stap uw optimale dosis vindt — veilig en effectief.",
        excerptEn: "The right CBD dosage is individual. We show you how to find your optimal dose step by step — safely and effectively.",
    },
    {
        slug: "cbg-vs-cbd",
        tag: "Science",
        titleDe: "CBG vs CBD: Was ist der Unterschied?",
        titleNl: "CBG vs CBD: wat is het verschil?",
        titleEn: "CBG vs CBD: What's the Difference?",
        excerptDe: "CBG gilt als die Mutter aller Cannabinoide. Aber was unterscheidet es von CBD? Wir erklären die Unterschiede und wann welches Cannabinoid sinnvoll ist.",
        excerptNl: "CBG wordt beschouwd als de moeder van alle cannabinoïden. Maar wat onderscheidt het van CBD? Wij leggen de verschillen uit en wanneer welk cannabinoïde zinvol is.",
        excerptEn: "CBG is considered the mother of all cannabinoids. But what sets it apart from CBD? We explain the differences and when each cannabinoid makes sense.",
    },
];

export function BlogPreview({ locale, dict }: BlogPreviewProps) {
    const [sectionRef, isVisible] = useScrollReveal<HTMLElement>();

    return (
        <section className={styles.section} ref={sectionRef}>
            <Container>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{dict.home.blogTitle}</h2>
                    <div className={styles.sectionLine} />
                </div>

                <div className={styles.grid}>
                    {placeholderPosts.map((post) => {
                        const title = locale === "de" ? post.titleDe : locale === "nl" ? post.titleNl : post.titleEn;
                        const excerpt = locale === "de" ? post.excerptDe : locale === "nl" ? post.excerptNl : post.excerptEn;

                        return (
                            <a
                                key={post.slug}
                                href={`/${locale}/blog/${post.slug}`}
                                className={`${styles.card} ${isVisible ? styles.visible : ""}`}
                            >
                                <div className={styles.cardImage}>
                                    <div
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "2.5rem",
                                        }}
                                    >
                                        📖
                                    </div>
                                </div>
                                <div className={styles.cardBody}>
                                    <span className={styles.cardTag}>{post.tag}</span>
                                    <h3 className={styles.cardTitle}>{title}</h3>
                                    <p className={styles.cardExcerpt}>{excerpt}</p>
                                    <span className={styles.readMore}>
                                        {dict.blog.readMore} →
                                    </span>
                                </div>
                            </a>
                        );
                    })}
                </div>
            </Container>
        </section>
    );
}
