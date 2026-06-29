"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

type Order = {
    id: string;
    order_number: string;
    customer_email: string;
    status: string;
    payment_method: string | null;
    payment_status: string;
    total: number;
    acut_order_id: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    created_at: string;
};

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();
        supabase
            .from("orders")
            .select("id, order_number, customer_email, status, payment_method, payment_status, total, acut_order_id, tracking_number, tracking_url, created_at")
            .order("created_at", { ascending: false })
            .then(({ data }) => {
                setOrders(data || []);
                setLoading(false);
            });
    }, []);

    return (
        <>
            <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 className={styles.pageTitle}>Orders</h1>
                <Link href="/admin/orders/new" className={styles.actionBtn} style={{ background: "#f0fdf4", color: "#065f46", borderColor: "#bbf7d0" }}>
                    + New Order
                </Link>
            </div>

            {loading ? (
                <p style={{ color: "#6b7280" }}>Loading...</p>
            ) : orders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🧾</p>
                    <p>No orders yet</p>
                </div>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Total</th>
                            <th>Acut ID</th>
                            <th>Tracking</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr
                                key={order.id}
                                onClick={() => router.push(`/admin/orders/${order.id}`)}
                                style={{ cursor: "pointer" }}
                            >
                                <td style={{ fontWeight: 600 }}>{order.order_number}</td>
                                <td>{order.customer_email}</td>
                                <td>
                                    <span style={{
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        background: order.status === "shipped" ? "#d1fae5" : order.status === "paid" ? "#dbeafe" : "#f3f4f6",
                                        color: order.status === "shipped" ? "#065f46" : order.status === "paid" ? "#1e40af" : "#374151",
                                    }}>
                                        {order.status}
                                    </span>
                                    {order.payment_method === "invoice" && (
                                        <span style={{
                                            padding: "2px 8px",
                                            borderRadius: "12px",
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                            marginLeft: "4px",
                                            background: order.payment_status === "paid" ? "#f0fdf4" : order.payment_status === "overdue" ? "#fef2f2" : "#fff7ed",
                                            color: order.payment_status === "paid" ? "#166534" : order.payment_status === "overdue" ? "#991b1b" : "#c2410c",
                                        }}>
                                            💰 {order.payment_status}
                                        </span>
                                    )}
                                </td>
                                <td>€{Number(order.total).toFixed(2)}</td>
                                <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{order.acut_order_id || "—"}</td>
                                <td>
                                    {order.tracking_url ? (
                                        <a href={order.tracking_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: "0.8rem" }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {order.tracking_number}
                                        </a>
                                    ) : "—"}
                                </td>
                                <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                    {new Date(order.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </>
    );
}
