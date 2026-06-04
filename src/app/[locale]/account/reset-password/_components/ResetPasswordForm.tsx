"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../../account.module.css";

type ResetPasswordFormProps = {
    locale: Locale;
    dict: Dictionary;
};

export function ResetPasswordForm({ locale, dict }: ResetPasswordFormProps) {
    const { user, loading: authLoading, updatePassword } = useAuth();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (password !== confirm) {
            setError(dict.account.passwordMismatch);
            return;
        }
        setLoading(true);
        const result = await updatePassword(password);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            window.location.href = `/${locale}/account`;
        }
    };

    if (authLoading) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard}>
                    <p>{dict.common.loading}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard}>
                    <div className={styles.magicLinkSuccess}>
                        <div className={styles.emptyIcon}>⚠️</div>
                        <h2 className={styles.authTitle}>{dict.account.resetPasswordTitle}</h2>
                        <p className={styles.magicLinkText}>{dict.account.resetLinkInvalid}</p>
                        <Link className={styles.textButton} href={`/${locale}/account/forgot-password`}>
                            {dict.account.forgotPassword}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <h1 className={styles.authTitle}>{dict.account.resetPasswordTitle}</h1>
                <form className={styles.authForm} onSubmit={handleSubmit}>
                    {error && <div className={styles.error}>{error}</div>}
                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="reset-password">
                            {dict.account.newPassword}
                        </label>
                        <input
                            className={styles.input}
                            id="reset-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="new-password"
                            autoFocus
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="reset-confirm">
                            {dict.account.confirmPassword}
                        </label>
                        <input
                            className={styles.input}
                            id="reset-confirm"
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>
                    <Button variant="primary" fullWidth type="submit" disabled={loading}>
                        {loading ? dict.common.loading : dict.account.updatePasswordButton}
                    </Button>
                </form>
            </div>
        </div>
    );
}
