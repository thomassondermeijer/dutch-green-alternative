"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button/Button";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../../content.module.css";

type ContactFormProps = {
    dict: Dictionary;
};

export function ContactFormClient({ dict }: ContactFormProps) {
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // TODO: Send via API route + Resend
        setSent(true);
    };

    if (sent) {
        return (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>✉️</p>
                <p style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-semibold)" }}>
                    {dict.contact.sent}
                </p>
            </div>
        );
    }

    return (
        <form className={styles.contactForm} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
                <input
                    className={styles.input}
                    type="text"
                    name="name"
                    placeholder={dict.contact.name}
                    required
                />
            </div>
            <div className={styles.inputGroup}>
                <input
                    className={styles.input}
                    type="email"
                    name="email"
                    placeholder={dict.contact.email}
                    required
                />
            </div>
            <div className={styles.inputGroup}>
                <textarea
                    className={styles.textarea}
                    name="message"
                    placeholder={dict.contact.message}
                    required
                />
            </div>
            <Button variant="primary" type="submit">
                {dict.contact.send}
            </Button>
        </form>
    );
}
