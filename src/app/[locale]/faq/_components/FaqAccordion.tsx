"use client";

import { useState } from "react";
import styles from "../../content.module.css";

type AccordionItem = {
    question: string;
    answer: string;
};

type FaqAccordionProps = {
    items: AccordionItem[];
};

export function FaqAccordion({ items }: FaqAccordionProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className={styles.accordion}>
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={`${styles.accordionItem} ${openIndex === idx ? styles.open : ""}`}
                >
                    <button
                        className={styles.accordionTrigger}
                        onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                        aria-expanded={openIndex === idx}
                    >
                        {item.question}
                        <svg
                            className={styles.accordionArrow}
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    {openIndex === idx && (
                        <div className={styles.accordionContent}>
                            {item.answer}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
