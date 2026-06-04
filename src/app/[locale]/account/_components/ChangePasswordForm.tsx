"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../account.module.css";

type ChangePasswordFormProps = {
    dict: Dictionary;
};

export function ChangePasswordForm({ dict }: ChangePasswordFormProps) {
    const { updatePassword } = useAuth();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);
        if (password !== confirm) {
            setError(dict.account.passwordMismatch);
            return;
        }
        setLoading(true);
        const result = await updatePassword(password);
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(true);
            setPassword("");
            setConfirm("");
        }
        setLoading(false);
    };

    return (
        <div>
            <h2 className={styles.contentTitle}>{dict.account.changePasswordTitle}</h2>
            <form className={styles.authForm} onSubmit={handleSubmit}>
                {error && <div className={styles.error}>{error}</div>}
                {success && <p className={styles.magicLinkText}>{dict.account.passwordUpdated}</p>}
                <div className={styles.inputGroup}>
                    <label className={styles.label} htmlFor="change-password">
                        {dict.account.newPassword}
                    </label>
                    <input
                        className={styles.input}
                        id="change-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                    />
                </div>
                <div className={styles.inputGroup}>
                    <label className={styles.label} htmlFor="change-confirm">
                        {dict.account.confirmPassword}
                    </label>
                    <input
                        className={styles.input}
                        id="change-confirm"
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
    );
}
