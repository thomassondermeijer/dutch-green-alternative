"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./admin.module.css";

type DashboardStats = {
    products: number;
    orders: number;
    customers: number;
    coupons: number;
    revenue: number;
    pendingOrders: number;
    unpaidOrders: number;
    activeProducts: number;
};

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useEffect(() => {
        const supabase = createClient();

        async function loadStats() {
            const [products, orders, customers, coupons] = await Promise.all([
                supabase.from("products").select("id, is_active", { count: "exact", head: false }),
                supabase.from("orders").select("id, status, payment_status, total", { count: "exact", head: false }),
                supabase.from("customers").select("id", { count: "exact", head: true }),
                supabase.from("coupons").select("id", { count: "exact", head: true }),
            ]);

            const orderData = orders.data || [];
            const revenue = orderData
                .filter((o) => o.payment_status === "paid")
                .reduce((sum, o) => sum + Number(o.total || 0), 0);
            const pending = orderData.filter((o) => o.status === "pending").length;
            const unpaid = orderData.filter((o) => o.payment_status === "unpaid").length;
            const activeProds = (products.data || []).filter((p) => p.is_active).length;

            setStats({
                products: products.count || 0,
                orders: orders.count || 0,
                customers: customers.count || 0,
                coupons: coupons.count || 0,
                revenue,
                pendingOrders: pending,
                unpaidOrders: unpaid,
                activeProducts: activeProds,
            });
        }

        loadStats();
    }, []);

    const cards = [
        { label: "Products", value: stats ? `${stats.activeProducts} / ${stats.products}` : "...", sub: "active / total", icon: "📦", href: "/admin/products" },
        { label: "Orders", value: stats?.orders ?? "...", sub: stats ? `${stats.pendingOrders} pending` : "", icon: "🧾", href: "/admin/orders" },
        { label: "Revenue", value: stats ? `€${stats.revenue.toFixed(2)}` : "...", sub: stats ? `${stats.unpaidOrders} unpaid` : "", icon: "💰", href: "/admin/orders" },
        { label: "Customers", value: stats?.customers ?? "...", sub: "", icon: "👥", href: "/admin/customers" },
        { label: "Coupons", value: stats?.coupons ?? "...", sub: "", icon: "🏷️", href: "/admin/coupons" },
    ];

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Dashboard</h1>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
                {cards.map((card) => (
                    <Link
                        key={card.label}
                        href={card.href}
                        style={{
                            background: "white",
                            borderRadius: "12px",
                            padding: "1.5rem",
                            textDecoration: "none",
                            color: "inherit",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                            transition: "box-shadow 0.2s",
                        }}
                    >
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{card.icon}</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{card.value}</div>
                        <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>{card.label}</div>
                        {card.sub && <div style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "4px" }}>{card.sub}</div>}
                    </Link>
                ))}
            </div>
        </>
    );
}
