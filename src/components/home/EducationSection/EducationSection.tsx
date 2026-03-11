"use client";

import { Container } from "@/components/ui/Container/Container";
import { useScrollReveal } from "@/lib/animations/scroll-animations";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./EducationSection.module.css";

type EducationSectionProps = {
    dict: Dictionary;
};

export function EducationSection({ dict }: EducationSectionProps) {
    const [sectionRef, isVisible] = useScrollReveal<HTMLElement>();

    const steps = [
        {
            icon: (
                <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="30" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx="32" cy="28" r="8" fill="none" stroke="var(--color-primary)" strokeWidth="2" />
                    <path d="M20 50c0-8 5.4-12 12-12s12 4 12 12" stroke="var(--color-primary)" strokeWidth="2" fill="none" />
                    <circle cx="28" cy="18" r="2" fill="var(--color-secondary)" />
                    <circle cx="36" cy="20" r="1.5" fill="var(--color-secondary)" />
                    <circle cx="40" cy="30" r="1.5" fill="var(--color-secondary)" />
                </svg>
            ),
            title: dict.home.eduStep1Title || "Der Mensch hat ein Endocannabinoid-System",
            desc: dict.home.eduStep1Desc || "Unser Körper verfügt über ein eigenes Endocannabinoid-System (ECS), das eine zentrale Rolle bei der Regulierung lebenswichtiger Funktionen spielt.",
        },
        {
            icon: (
                <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                    <path d="M32 6c-4 8-16 12-16 28 0 10 7.2 24 16 24s16-14 16-24C48 18 36 14 32 6z" stroke="var(--color-primary)" strokeWidth="2" fill="none" />
                    <path d="M32 16c-2 4-8 6-8 14s4 12 8 12 8-4 8-12-6-10-8-14z" fill="rgba(45,90,61,0.08)" />
                    <line x1="32" y1="20" x2="32" y2="48" stroke="var(--color-primary)" strokeWidth="1.5" />
                    <path d="M26 30c3-2 6-2 6 0" stroke="var(--color-secondary)" strokeWidth="1.5" fill="none" />
                    <path d="M38 34c-3-2-6-2-6 0" stroke="var(--color-secondary)" strokeWidth="1.5" fill="none" />
                </svg>
            ),
            title: dict.home.eduStep2Title || "Die Hanfpflanze enthält Cannabinoide",
            desc: dict.home.eduStep2Desc || "Die Hanfpflanze enthält über 100 natürliche Cannabinoide, darunter CBD, CBG und CBN — bioaktive Verbindungen, die mit unserem ECS interagieren.",
        },
        {
            icon: (
                <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="28" stroke="var(--color-primary)" strokeWidth="2" fill="none" />
                    <circle cx="32" cy="32" r="14" stroke="var(--color-secondary)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
                    <circle cx="32" cy="18" r="3" fill="var(--color-secondary)" opacity="0.8" />
                    <circle cx="44" cy="32" r="3" fill="var(--color-primary)" opacity="0.6" />
                    <circle cx="32" cy="46" r="3" fill="var(--color-secondary)" opacity="0.8" />
                    <circle cx="20" cy="32" r="3" fill="var(--color-primary)" opacity="0.6" />
                    <circle cx="32" cy="32" r="4" fill="var(--color-primary)" />
                </svg>
            ),
            title: dict.home.eduStep3Title || "Regulierung von Stimmung, Schmerz & Wohlbefinden",
            desc: dict.home.eduStep3Desc || "Cannabinoide spielen eine Schlüsselrolle bei der Regulierung von Stimmung, Schmerzempfinden, Schlaf und dem allgemeinen Wohlbefinden.",
        },
    ];

    return (
        <section className={styles.section} ref={sectionRef}>
            <Container>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                        {dict.home.eduTitle || "Eine natürliche Verbindung"}
                    </h2>
                    <p className={styles.sectionSubtitle}>
                        {dict.home.eduSubtitle || "So unterstützen Cannabinoide Ihren Körper auf natürliche Weise"}
                    </p>
                </div>

                <div className={styles.steps}>
                    {steps.map((step, idx) => (
                        <div
                            key={idx}
                            className={`${styles.step} ${isVisible ? styles.visible : ""}`}
                            style={{ transitionDelay: `${idx * 200}ms` }}
                        >
                            <div className={styles.iconWrapper}>
                                {step.icon}
                            </div>
                            {idx < steps.length - 1 && (
                                <div className={`${styles.connector} ${isVisible ? styles.connectorVisible : ""}`}
                                    style={{ transitionDelay: `${(idx + 1) * 200}ms` }}
                                />
                            )}
                            <h3 className={styles.stepTitle}>{step.title}</h3>
                            <p className={styles.stepDesc}>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </Container>
        </section>
    );
}
