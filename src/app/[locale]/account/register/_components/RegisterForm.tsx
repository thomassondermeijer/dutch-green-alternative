"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../../account.module.css";

type RegisterFormProps = {
    locale: Locale;
    dict: Dictionary;
};

export function RegisterForm({ locale, dict }: RegisterFormProps) {
    const { signUp } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const result = await signUp(email, password, name);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            setSuccess(true);
        }
    };

    if (success) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>✉️</p>
                    <h2>{dict.account.registerTitle}</h2>
                    <p style={{ color: "var(--color-text-light)", marginTop: "0.5rem" }}>
                        {locale === "de"
                            ? "Bitte überprüfen Sie Ihre E-Mail, um Ihr Konto zu bestätigen."
                            : locale === "nl"
                                ? "Controleer uw e-mail om uw account te bevestigen."
                                : "Please check your email to confirm your account."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <h1 className={styles.authTitle}>{dict.account.registerTitle}</h1>

                <form className={styles.authForm} onSubmit={handleSubmit}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="reg-name">
                            {dict.contact.name}
                        </label>
                        <input
                            className={styles.input}
                            id="reg-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="reg-email">
                            {dict.account.loginEmail}
                        </label>
                        <input
                            className={styles.input}
                            id="reg-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="reg-password">
                            {dict.account.loginPassword}
                        </label>
                        <input
                            className={styles.input}
                            id="reg-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <Button variant="primary" fullWidth type="submit" disabled={loading}>
                        {loading ? dict.common.loading : dict.account.registerButton}
                    </Button>
                </form>

                <p className={styles.authSwitch}>
                    {dict.account.loginTitle}?{" "}
                    <Link href={`/${locale}/account/login`}>
                        {dict.account.loginButton}
                    </Link>
                </p>
            </div>
        </div>
    );
}
