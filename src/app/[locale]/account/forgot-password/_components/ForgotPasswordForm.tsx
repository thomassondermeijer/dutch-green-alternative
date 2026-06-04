"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../../account.module.css";

type ForgotPasswordFormProps = {
    locale: Locale;
    dict: Dictionary;
};

export function ForgotPasswordForm({ locale, dict }: ForgotPasswordFormProps) {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const result = await resetPassword(email, locale);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            setSent(true);
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard}>
                    <div className={styles.magicLinkSuccess}>
                        <div className={styles.emptyIcon}>📧</div>
                        <h2 className={styles.authTitle}>{dict.account.resetLinkSent}</h2>
                        <p className={styles.magicLinkText}>{dict.account.resetLinkSentDesc}</p>
                        <p className={styles.magicLinkHint}>{dict.account.checkSpam}</p>
                        <Link className={styles.textButton} href={`/${locale}/account/login`}>
                            {dict.account.backToLogin}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <h1 className={styles.authTitle}>{dict.account.forgotPasswordTitle}</h1>
                <form className={styles.authForm} onSubmit={handleSubmit}>
                    {error && <div className={styles.error}>{error}</div>}
                    <p className={styles.magicLinkDesc}>{dict.account.forgotPasswordDesc}</p>
                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="forgot-email">
                            {dict.account.loginEmail}
                        </label>
                        <input
                            className={styles.input}
                            id="forgot-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <Button variant="primary" fullWidth type="submit" disabled={loading}>
                        {loading ? dict.common.loading : dict.account.sendResetLink}
                    </Button>
                </form>
                <p className={styles.authSwitch}>
                    <Link href={`/${locale}/account/login`}>{dict.account.backToLogin}</Link>
                </p>
            </div>
        </div>
    );
}
