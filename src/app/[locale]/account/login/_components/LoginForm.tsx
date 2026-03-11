"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../../account.module.css";

type LoginFormProps = {
    locale: Locale;
    dict: Dictionary;
};

export function LoginForm({ locale, dict }: LoginFormProps) {
    const { signIn } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const result = await signIn(email, password);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            window.location.href = `/${locale}/account`;
        }
    };

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <h1 className={styles.authTitle}>{dict.account.loginTitle}</h1>

                <form className={styles.authForm} onSubmit={handleSubmit}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="login-email">
                            {dict.account.loginEmail}
                        </label>
                        <input
                            className={styles.input}
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="login-password">
                            {dict.account.loginPassword}
                        </label>
                        <input
                            className={styles.input}
                            id="login-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <Button variant="primary" fullWidth type="submit" disabled={loading}>
                        {loading ? dict.common.loading : dict.account.loginButton}
                    </Button>
                </form>

                <p className={styles.authSwitch}>
                    {dict.account.registerTitle}?{" "}
                    <Link href={`/${locale}/account/register`}>
                        {dict.account.registerButton}
                    </Link>
                </p>
            </div>
        </div>
    );
}
