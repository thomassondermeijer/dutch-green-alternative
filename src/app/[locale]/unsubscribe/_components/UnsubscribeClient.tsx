"use client";

import { useState } from "react";
import Link from "next/link";
import type { UnsubscribeCopy } from "../copy";
import styles from "./UnsubscribeClient.module.css";

type State = "idle" | "working" | "done" | "error";

export function UnsubscribeClient({
    copy,
    email,
    token,
    valid,
    locale,
}: {
    copy: UnsubscribeCopy;
    email: string;
    token: string;
    valid: boolean;
    locale: string;
}) {
    const [state, setState] = useState<State>("idle");
    const [manualEmail, setManualEmail] = useState("");

    const unsubscribe = async () => {
        setState("working");
        try {
            const params = new URLSearchParams({ e: email, t: token });
            const res = await fetch(`/api/unsubscribe?${params}`, { method: "POST" });
            setState(res.ok ? "done" : "error");
        } catch {
            setState("error");
        }
    };

    if (state === "done") {
        return (
            <div className={styles.panel}>
                <h2 className={styles.heading}>{copy.doneTitle}</h2>
                <p className={styles.body}>{copy.doneBody}</p>
                <p className={styles.note}>{copy.stillTransactional}</p>
                <Link href={`/${locale}`} className={styles.link}>{copy.backToShop}</Link>
            </div>
        );
    }

    // No valid signature: don't silently fail, and don't unsubscribe an address
    // we can't prove belongs to the person clicking. Ask them to type it, which
    // routes to support rather than opting anyone out on an unverified guess.
    if (!valid) {
        return (
            <div className={styles.panel}>
                <h2 className={styles.heading}>{copy.invalidTitle}</h2>
                <p className={styles.body}>{copy.invalidBody}</p>
                <p className={styles.body}>{copy.manualPrompt}</p>
                <form
                    className={styles.form}
                    action="mailto:info@dutchgreenalternative.nl"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const address = manualEmail.trim();
                        if (!address) return;
                        window.location.href =
                            `mailto:info@dutchgreenalternative.nl` +
                            `?subject=${encodeURIComponent("Unsubscribe")}` +
                            `&body=${encodeURIComponent(`Please unsubscribe ${address} from the newsletter.`)}`;
                    }}
                >
                    <label className={styles.label} htmlFor="unsub-email">{copy.emailLabel}</label>
                    <input
                        id="unsub-email"
                        type="email"
                        className={styles.input}
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        required
                    />
                    <button type="submit" className={styles.button}>{copy.confirm}</button>
                </form>
                <Link href={`/${locale}`} className={styles.link}>{copy.backToShop}</Link>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            <p className={styles.body}>{copy.intro.replace("{email}", email)}</p>
            <button
                className={styles.button}
                onClick={unsubscribe}
                disabled={state === "working"}
            >
                {state === "working" ? copy.working : copy.confirm}
            </button>
            {state === "error" && <p className={styles.error}>{copy.error}</p>}
            <p className={styles.note}>{copy.stillTransactional}</p>
        </div>
    );
}
