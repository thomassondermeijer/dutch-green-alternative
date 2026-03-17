"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "../lab-results.module.css";

type LabResultCardProps = {
    productName: string;
    productImage: string;
    labResultImage: string;
    hoverHint: string;
    clickHint: string;
    verifiedBy: string;
    onOpenLightbox: (labResultImage: string, productName: string) => void;
};

export function LabResultCard({
    productName,
    productImage,
    labResultImage,
    hoverHint,
    clickHint,
    verifiedBy,
    onOpenLightbox,
}: LabResultCardProps) {
    const [flipped, setFlipped] = useState(false);

    const handleClick = () => {
        // On mobile: first tap flips, second tap opens lightbox
        if (!flipped && window.matchMedia("(hover: none)").matches) {
            setFlipped(true);
            return;
        }
        onOpenLightbox(labResultImage, productName);
    };

    const handleBlur = () => {
        // Reset flip on mobile when tapping elsewhere
        if (window.matchMedia("(hover: none)").matches) {
            setFlipped(false);
        }
    };

    return (
        <div
            className={`${styles.cardWrapper} ${flipped ? styles.flipped : ""}`}
            onClick={handleClick}
            onBlur={handleBlur}
            tabIndex={0}
            role="button"
            aria-label={`${productName} — ${hoverHint}`}
        >
            <div className={styles.card}>
                {/* Front: Product Image */}
                <div className={styles.cardFront}>
                    <div className={styles.productImage}>
                        <Image
                            src={productImage}
                            alt={productName}
                            fill
                            sizes="(max-width: 480px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            style={{ objectFit: "cover" }}
                        />
                        <div className={styles.productNameOverlay}>
                            <div className={styles.productName}>{productName}</div>
                            <div className={styles.flipHint}>
                                🔬 {hoverHint}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Back: Lab Result */}
                <div className={styles.cardBack}>
                    <div className={styles.labImage}>
                        <span className={styles.clickHint}>🔍 {clickHint}</span>
                        <Image
                            src={labResultImage}
                            alt={`Lab result — ${productName}`}
                            fill
                            sizes="(max-width: 480px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            style={{ objectFit: "contain" }}
                        />
                        <div className={styles.verifiedBadge}>
                            ✓ {verifiedBy}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
