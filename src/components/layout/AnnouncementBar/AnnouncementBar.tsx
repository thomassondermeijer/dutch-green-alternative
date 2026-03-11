"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./AnnouncementBar.module.css";

type AnnouncementBarProps = {
    dict: Dictionary;
};

export function AnnouncementBar({ dict }: AnnouncementBarProps) {
    const [visible, setVisible] = useState(true);

    if (!visible) return null;

    return (
        <div className={styles.bar}>
            <div className={styles.inner}>
                <span className={styles.icon}>🚚</span>
                <span className={styles.text}>{dict.shop.freeShipping}</span>
                <span className={styles.separator}>•</span>
                <span className={styles.text}>{dict.home.trustQualityPoint1}</span>
                <span className={styles.separator}>•</span>
                <span className={styles.text}>🇳🇱 Made in Netherlands</span>
            </div>
            <button
                className={styles.close}
                onClick={() => setVisible(false)}
                aria-label="Close"
            >
                ×
            </button>
        </div>
    );
}
