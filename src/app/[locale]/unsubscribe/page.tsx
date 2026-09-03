import type { Metadata } from "next";
import { i18n, type Locale } from "@/i18n/config";
import { Container } from "@/components/ui/Container/Container";
import { verifyUnsubscribe } from "@/lib/marketing/unsubscribe-token";
import { UnsubscribeClient } from "./_components/UnsubscribeClient";
import { COPY } from "./copy";
import styles from "../content.module.css";

export const metadata: Metadata = {
    title: "Unsubscribe | Dutch Green Alternative",
    // Never index an unsubscribe page — the URL contains an email address.
    robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ e?: string; t?: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;

    const { e: email = "", t: token = "" } = await searchParams;
    const valid = Boolean(email && token && verifyUnsubscribe(email, token));
    const copy = COPY[locale] || COPY.de;

    return (
        <main className={styles.page}>
            <Container>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>{copy.title}</h1>
                    <div className={styles.pageLine} />
                </div>

                <UnsubscribeClient
                    copy={copy}
                    email={email}
                    token={token}
                    valid={valid}
                    locale={locale}
                />
            </Container>
        </main>
    );
}
