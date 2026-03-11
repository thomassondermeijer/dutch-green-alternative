"use client";

import { Container } from "@/components/ui/Container/Container";
import { useScrollReveal } from "@/lib/animations/scroll-animations";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./TrustSignals.module.css";

type TrustSignalsProps = {
    dict: Dictionary;
};

export function TrustSignals({ dict }: TrustSignalsProps) {
    const [sectionRef, isVisible] = useScrollReveal<HTMLElement>();

    const features = [
        {
            icon: (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                </svg>
            ),
            accentIcon: (
                <svg className={styles.bgIcon} width="120" height="120" viewBox="0 0 24 24" fill="currentColor" opacity="0.04">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            ),
            title: dict.home.trustQualityTitle,
            subtitle: dict.home.trustQualitySubtitle,
            points: [
                dict.home.trustQualityPoint1,
                dict.home.trustQualityPoint2,
                dict.home.trustQualityPoint3,
            ],
        },
        {
            icon: (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
            ),
            accentIcon: (
                <svg className={styles.bgIcon} width="120" height="120" viewBox="0 0 24 24" fill="currentColor" opacity="0.04">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
            ),
            title: dict.home.trustPromiseTitle,
            subtitle: dict.home.trustPromiseSubtitle,
            points: [
                dict.home.trustPromisePoint1,
                dict.home.trustPromisePoint2,
                dict.home.trustPromisePoint3,
            ],
        },
        {
            icon: (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <path d="M8 10h.01" />
                    <path d="M12 10h.01" />
                    <path d="M16 10h.01" />
                </svg>
            ),
            accentIcon: (
                <svg className={styles.bgIcon} width="120" height="120" viewBox="0 0 24 24" fill="currentColor" opacity="0.04">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            ),
            title: dict.home.trustSupportTitle,
            subtitle: dict.home.trustSupportSubtitle,
            points: [
                dict.home.trustSupportPoint1,
                dict.home.trustSupportPoint2,
                dict.home.trustSupportPoint3,
            ],
        },
    ];

    return (
        <section className={styles.section} ref={sectionRef}>
            <Container>
                <div className={styles.sectionHeader}>
                    <span className={styles.sectionLabel}>{dict.home.trustLabel}</span>
                    <h2 className={styles.sectionTitle}>{dict.home.trustTitle}</h2>
                    <p className={styles.sectionSubtitle}>{dict.home.trustSubtitle}</p>
                </div>

                <div className={styles.grid}>
                    {features.map((feature, idx) => (
                        <div
                            key={idx}
                            className={`${styles.card} ${isVisible ? styles.visible : ""}`}
                            style={{ transitionDelay: `${idx * 150}ms` }}
                        >
                            {feature.accentIcon}
                            <div className={styles.cardIcon}>{feature.icon}</div>
                            <h3 className={styles.cardTitle}>{feature.title}</h3>
                            <p className={styles.cardSubtitle}>{feature.subtitle}</p>
                            <ul className={styles.cardPoints}>
                                {feature.points.map((point, i) => (
                                    <li key={i} className={styles.point}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </Container>
        </section>
    );
}
