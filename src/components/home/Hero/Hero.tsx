"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button/Button";
import { Container } from "@/components/ui/Container/Container";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import styles from "./Hero.module.css";

type HeroProps = {
    locale: Locale;
    dict: Dictionary;
};

export function Hero({ locale, dict }: HeroProps) {
    const bgRef = useRef<HTMLDivElement>(null);

    // Parallax scroll effect
    useEffect(() => {
        const handleScroll = () => {
            if (!bgRef.current) return;
            const scrollY = window.scrollY;
            const img = bgRef.current.querySelector("img");
            if (img) {
                img.style.transform = `scale(1.1) translateY(${scrollY * 0.3}px)`;
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <section className={styles.hero}>
            {/* Parallax Background Image */}
            <div className={styles.heroBg} ref={bgRef}>
                <Image
                    src="/hero-bg.png"
                    alt="Premium CBD & CBG oils in natural setting"
                    fill
                    priority
                    sizes="100vw"
                    quality={85}
                />
            </div>

            {/* Gradient Overlay */}
            <div className={styles.heroOverlay} />

            {/* Content */}
            <Container size="wide">
                <div className={styles.heroContent}>
                    <span className={styles.heroSubtitle}>
                        Dutch Green Alternative
                    </span>

                    <h1 className={styles.heroTitle}>
                        {dict.home.heroTitle.split("&").map((part, i) =>
                            i === 0 ? (
                                <span key={i}>{part}&amp; </span>
                            ) : (
                                <span key={i} className={styles.heroTitleAccent}>{part}</span>
                            )
                        )}
                    </h1>

                    <p className={styles.heroDescription}>
                        {dict.home.heroSubtitle}
                    </p>

                    <div className={styles.heroCtas}>
                        <Button variant="secondary" size="lg" href={`/${locale}/shop`}>
                            {dict.home.heroCta}
                        </Button>
                        <Button variant="ghost" size="lg" href={`/${locale}/about`} style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>
                            {dict.about.ourStory}
                        </Button>
                    </div>
                </div>
            </Container>

            {/* Scroll Indicator */}
            <div className={styles.scrollIndicator}>
                <div className={styles.scrollLine} />
            </div>
        </section>
    );
}
