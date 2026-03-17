"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import styles from "../lab-results.module.css";

type LightboxProps = {
    src: string;
    productName: string;
    verifiedBy: string;
    onClose: () => void;
};

export function Lightbox({ src, productName, verifiedBy, onClose }: LightboxProps) {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        },
        [onClose]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [handleKeyDown]);

    return (
        <div
            className={styles.lightboxOverlay}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <button
                className={styles.lightboxClose}
                onClick={onClose}
                aria-label="Close"
            >
                ✕
            </button>
            <div className={styles.lightboxContent}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={src}
                    alt={`Lab result — ${productName}`}
                />
                <div className={styles.lightboxProductName}>{productName}</div>
                <div className={styles.lightboxBadge}>
                    ✓ {verifiedBy}
                </div>
            </div>
        </div>
    );
}
