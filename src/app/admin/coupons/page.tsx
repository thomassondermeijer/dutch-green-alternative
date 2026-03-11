"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

type Coupon = {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    min_order_amount: number | null;
    usage_count: number;
    usage_limit: number | null;
    is_active: boolean;
    valid_until: string | null;
};

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();
        supabase
            .from("coupons")
            .select("*")
            .order("code")
            .then(({ data }) => {
                setCoupons(data || []);
                setLoading(false);
            });
    }, []);

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Coupons</h1>
            </div>

            {loading ? (
                <p style={{ color: "#6b7280" }}>Loading...</p>
            ) : coupons.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏷️</p>
                    <p>No coupons yet</p>
                </div>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Discount</th>
                            <th>Min Order</th>
                            <th>Usage</th>
                            <th>Status</th>
                            <th>Expires</th>
                        </tr>
                    </thead>
                    <tbody>
                        {coupons.map((c) => (
                            <tr key={c.id}>
                                <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{c.code}</td>
                                <td>
                                    {c.discount_type === "percentage"
                                        ? `${c.discount_value}%`
                                        : `€${Number(c.discount_value).toFixed(2)}`}
                                </td>
                                <td>{c.min_order_amount ? `€${Number(c.min_order_amount).toFixed(2)}` : "—"}</td>
                                <td>{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                                <td>
                                    <span style={{
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        background: c.is_active ? "#d1fae5" : "#fee2e2",
                                        color: c.is_active ? "#065f46" : "#991b1b",
                                    }}>
                                        {c.is_active ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                    {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : "Never"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </>
    );
}
