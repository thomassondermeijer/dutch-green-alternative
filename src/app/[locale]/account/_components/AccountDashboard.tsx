"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../account.module.css";

type OrderItem = {
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
};

type Order = {
    id: string;
    order_number: string;
    status: string;
    total: number;
    subtotal: number;
    discount_amount: number;
    shipping_cost: number;
    coupon_code: string | null;
    payment_method: string;
    payment_status: string;
    payment_due_date: string | null;
    invoice_surcharge: number;
    tracking_number: string | null;
    tracking_url: string | null;
    created_at: string;
    delivered_at: string | null;
    paid_at: string | null;
    items: OrderItem[];
};

type AccountDashboardProps = {
    locale: Locale;
    dict: Dictionary;
};

export function AccountDashboard({ locale, dict }: AccountDashboardProps) {
    const { user, loading, signOut } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [unpaidTotal, setUnpaidTotal] = useState(0);
    const [unpaidCount, setUnpaidCount] = useState(0);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        // Link customer record on login
        fetch("/api/account/link-customer", { method: "POST" }).catch(() => { });

        // Fetch orders
        fetch("/api/account/orders")
            .then(res => res.json())
            .then(data => {
                setOrders(data.orders || []);
                setUnpaidTotal(data.unpaidTotal || 0);
                setUnpaidCount(data.unpaidCount || 0);
            })
            .catch(console.error)
            .finally(() => setOrdersLoading(false));
    }, [user]);

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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-GB", {
            day: "2-digit", month: "2-digit", year: "numeric",
        });
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "delivered": return styles.statusDelivered;
            case "shipped": return styles.statusShipped;
            case "pending": case "processing": return styles.statusPending;
            case "cancelled": return styles.statusCancelled;
            default: return styles.statusPending;
        }
    };

    const getPaymentStyle = (status: string) => {
        return status === "paid" ? styles.statusPaid : styles.statusUnpaid;
    };

    const statusLabel = (status: string) => {
        const labels: Record<string, Record<string, string>> = {
            de: { delivered: "Zugestellt", shipped: "Versendet", pending: "Ausstehend", processing: "In Bearbeitung", cancelled: "Storniert" },
            nl: { delivered: "Bezorgd", shipped: "Verzonden", pending: "In behandeling", processing: "Wordt verwerkt", cancelled: "Geannuleerd" },
            en: { delivered: "Delivered", shipped: "Shipped", pending: "Pending", processing: "Processing", cancelled: "Cancelled" },
        };
        return labels[locale]?.[status] || status;
    };

    const paymentLabel = (status: string) => {
        const labels: Record<string, Record<string, string>> = {
            de: { paid: "Bezahlt", unpaid: "Ausstehend" },
            nl: { paid: "Betaald", unpaid: "Openstaand" },
            en: { paid: "Paid", unpaid: "Unpaid" },
        };
        return labels[locale]?.[status] || status;
    };

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
                {/* Unpaid Banner */}
                {unpaidTotal > 0 && (
                    <div className={styles.unpaidBanner}>
                        <div className={styles.unpaidIcon}>⚠️</div>
                        <div className={styles.unpaidInfo}>
                            <strong>
                                {locale === "de" ? "Offener Betrag" : locale === "nl" ? "Openstaand bedrag" : "Outstanding Balance"}:
                                {" "}€{unpaidTotal.toFixed(2)}
                            </strong>
                            <span>
                                {locale === "de"
                                    ? `${unpaidCount} ${unpaidCount === 1 ? "Rechnung" : "Rechnungen"} offen`
                                    : locale === "nl"
                                        ? `${unpaidCount} ${unpaidCount === 1 ? "factuur" : "facturen"} openstaand`
                                        : `${unpaidCount} unpaid ${unpaidCount === 1 ? "invoice" : "invoices"}`
                                }
                            </span>
                        </div>
                    </div>
                )}

                <h2 className={styles.contentTitle}>{dict.account.orderHistory}</h2>

                {ordersLoading ? (
                    <div className={styles.emptyState}>
                        <p>{dict.common.loading}</p>
                    </div>
                ) : orders.length === 0 ? (
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
                ) : (
                    <div className={styles.ordersList}>
                        {orders.map(order => (
                            <div
                                key={order.id}
                                className={`${styles.orderCard} ${order.payment_status === "unpaid" && order.status !== "cancelled" ? styles.orderCardUnpaid : ""}`}
                            >
                                <div
                                    className={styles.orderHeader}
                                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                >
                                    <div className={styles.orderMeta}>
                                        <span className={styles.orderNumber}>{order.order_number}</span>
                                        <span className={styles.orderDate}>{formatDate(order.created_at)}</span>
                                    </div>
                                    <div className={styles.orderBadges}>
                                        <span className={`${styles.statusBadge} ${getStatusStyle(order.status)}`}>
                                            {statusLabel(order.status)}
                                        </span>
                                        <span className={`${styles.statusBadge} ${getPaymentStyle(order.payment_status)}`}>
                                            {paymentLabel(order.payment_status)}
                                        </span>
                                    </div>
                                    <div className={styles.orderTotal}>
                                        €{Number(order.total).toFixed(2)}
                                    </div>
                                    <span className={styles.orderChevron}>
                                        {expandedOrder === order.id ? "▲" : "▼"}
                                    </span>
                                </div>

                                {expandedOrder === order.id && (
                                    <div className={styles.orderDetails}>
                                        {/* Items */}
                                        <table className={styles.itemsTable}>
                                            <thead>
                                                <tr>
                                                    <th>{locale === "de" ? "Produkt" : locale === "nl" ? "Product" : "Product"}</th>
                                                    <th>{locale === "de" ? "Menge" : locale === "nl" ? "Aantal" : "Qty"}</th>
                                                    <th>{locale === "de" ? "Preis" : locale === "nl" ? "Prijs" : "Price"}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order.items.map((item, i) => (
                                                    <tr key={i}>
                                                        <td>{item.product_name}</td>
                                                        <td>{item.quantity}×</td>
                                                        <td>€{Number(item.total_price).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Summary */}
                                        <div className={styles.orderSummary}>
                                            {order.discount_amount > 0 && (
                                                <div className={styles.summaryRow}>
                                                    <span>{dict.cart.discount} {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                                                    <span className={styles.discountAmount}>-€{Number(order.discount_amount).toFixed(2)}</span>
                                                </div>
                                            )}
                                            {Number(order.shipping_cost) > 0 && (
                                                <div className={styles.summaryRow}>
                                                    <span>{dict.cart.shipping}</span>
                                                    <span>€{Number(order.shipping_cost).toFixed(2)}</span>
                                                </div>
                                            )}
                                            {Number(order.invoice_surcharge) > 0 && (
                                                <div className={styles.summaryRow}>
                                                    <span>{dict.checkout.invoiceSurcharge || "Invoice fee"}</span>
                                                    <span>€{Number(order.invoice_surcharge).toFixed(2)}</span>
                                                </div>
                                            )}
                                            {order.payment_due_date && order.payment_status === "unpaid" && (
                                                <div className={`${styles.summaryRow} ${styles.dueDate}`}>
                                                    <span>{locale === "de" ? "Fällig am" : locale === "nl" ? "Vervaldatum" : "Due by"}</span>
                                                    <span>{formatDate(order.payment_due_date)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Tracking */}
                                        {order.tracking_url && (
                                            <a
                                                href={order.tracking_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.trackingLink}
                                            >
                                                📦 {dict.account.trackOrder || "Track shipment"} →
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
