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
    const { signIn, sendMagicLink } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [mode, setMode] = useState<"password" | "magic">("password");

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const result = await signIn(email, password);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            // Auto-link customer record
            try { await fetch("/api/account/link-customer", { method: "POST" }); } catch { }
            window.location.href = `/${locale}/account`;
        }
    };

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const result = await sendMagicLink(email);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            setMagicLinkSent(true);
            setLoading(false);
        }
    };

    if (magicLinkSent) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard}>
                    <div className={styles.magicLinkSuccess}>
                        <div className={styles.emptyIcon}>📧</div>
                        <h2 className={styles.authTitle}>{dict.account.magicLinkSent || "Check your email"}</h2>
                        <p className={styles.magicLinkText}>
                            {dict.account.magicLinkSentDesc || `We sent a login link to ${email}. Click the link in the email to sign in.`}
                        </p>
                        <p className={styles.magicLinkHint}>
                            {dict.account.checkSpam || "Don't see it? Check your spam folder."}
                        </p>
                        <button
                            className={styles.textButton}
                            onClick={() => { setMagicLinkSent(false); setEmail(""); }}
                        >
                            {dict.account.tryAgain || "Try another email"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <h1 className={styles.authTitle}>{dict.account.loginTitle}</h1>

                {/* Mode toggle */}
                <div className={styles.loginTabs}>
                    <button
                        className={`${styles.loginTab} ${mode === "magic" ? styles.loginTabActive : ""}`}
                        onClick={() => setMode("magic")}
                        type="button"
                    >
                        📧 {dict.account.magicLinkTab || "Email Link"}
                    </button>
                    <button
                        className={`${styles.loginTab} ${mode === "password" ? styles.loginTabActive : ""}`}
                        onClick={() => setMode("password")}
                        type="button"
                    >
                        🔑 {dict.account.passwordTab || "Password"}
                    </button>
                </div>

                {mode === "magic" ? (
                    <form className={styles.authForm} onSubmit={handleMagicLink}>
                        {error && <div className={styles.error}>{error}</div>}
                        <p className={styles.magicLinkDesc}>
                            {dict.account.magicLinkDesc || "Enter your email and we'll send you a login link. No password needed."}
                        </p>
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
                                autoFocus
                            />
                        </div>
                        <Button variant="primary" fullWidth type="submit" disabled={loading}>
                            {loading ? dict.common.loading : (dict.account.sendMagicLink || "Send Login Link")}
                        </Button>
                    </form>
                ) : (
                    <form className={styles.authForm} onSubmit={handlePasswordLogin}>
                        {error && <div className={styles.error}>{error}</div>}
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="login-email-pw">
                                {dict.account.loginEmail}
                            </label>
                            <input
                                className={styles.input}
                                id="login-email-pw"
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
                        <Link
                            href={`/${locale}/account/forgot-password`}
                            className={styles.textButton}
                            style={{ alignSelf: "flex-end" }}
                        >
                            {dict.account.forgotPassword}
                        </Link>
                        <Button variant="primary" fullWidth type="submit" disabled={loading}>
                            {loading ? dict.common.loading : dict.account.loginButton}
                        </Button>
                    </form>
                )}

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
