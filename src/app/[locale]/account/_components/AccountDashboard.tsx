"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../account.module.css";

type AccountDashboardProps = {
    locale: Locale;
    dict: Dictionary;
};

export function AccountDashboard({ locale, dict }: AccountDashboardProps) {
    const { user, loading, signOut } = useAuth();

    if (loading) {
        return (
            <div className={styles.emptyState}>
                <p>{dict.common.loading}</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔒</div>
                <p style={{ marginBottom: "1rem" }}>{dict.account.loginTitle}</p>
                <Button variant="primary" href={`/${locale}/account/login`}>
                    {dict.account.loginButton}
                </Button>
            </div>
        );
    }

    const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "";

    return (
        <div className={styles.dashboardLayout}>
            {/* Sidebar */}
            <div className={styles.sidebar}>
                <div className={styles.sidebarUser}>
                    <div className={styles.sidebarName}>{userName}</div>
                    <div className={styles.sidebarEmail}>{user.email}</div>
                </div>

                <nav className={styles.sidebarNav}>
                    <Link
                        href={`/${locale}/account`}
                        className={`${styles.sidebarLink} ${styles.sidebarLinkActive}`}
                    >
                        📋 {dict.account.orders}
                    </Link>
                    <Link href={`/${locale}/account`} className={styles.sidebarLink}>
                        📍 {dict.account.addresses}
                    </Link>
                    <Link href={`/${locale}/account`} className={styles.sidebarLink}>
                        ⚙️ {dict.account.settings}
                    </Link>
                    <button
                        className={styles.logoutBtn}
                        onClick={async () => {
                            await signOut();
                            window.location.href = `/${locale}`;
                        }}
                    >
                        🚪 {dict.nav.logout}
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className={styles.content}>
                <h2 className={styles.contentTitle}>{dict.account.orderHistory}</h2>

                {/* Orders — will be fetched from Supabase once orders exist */}
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📦</div>
                    <p>{dict.account.noOrders}</p>
                    <Button
                        variant="primary"
                        href={`/${locale}/shop`}
                        style={{ marginTop: "1rem" }}
                    >
                        {dict.cart.continueShopping}
                    </Button>
                </div>
            </div>
        </div>
    );
}
