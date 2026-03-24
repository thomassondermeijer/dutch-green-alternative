"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

type Customer = {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    language_pref: string;
    created_at: string;
    total_spent: number;
    order_count: number;
    last_order: string | null;
};

type SortKey = "name" | "email" | "total_spent" | "order_count" | "last_order" | "language_pref" | "created_at";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
    name: "Name",
    email: "Email",
    total_spent: "Total Spent",
    order_count: "Orders",
    last_order: "Last Order",
    language_pref: "Language",
    created_at: "Joined",
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>("total_spent");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [search, setSearch] = useState("");
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();
        supabase.rpc("get_customers_with_stats").then(({ data }) => {
            setCustomers(data || []);
            setLoading(false);
        });
    }, []);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir(key === "name" || key === "email" || key === "language_pref" ? "asc" : "desc");
        }
    };

    const filtered = useMemo(() => {
        let list = customers;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                (c.email || "").toLowerCase().includes(q) ||
                (c.first_name || "").toLowerCase().includes(q) ||
                (c.last_name || "").toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case "name": {
                    const nameA = [a.first_name, a.last_name].filter(Boolean).join(" ").toLowerCase();
                    const nameB = [b.first_name, b.last_name].filter(Boolean).join(" ").toLowerCase();
                    cmp = nameA.localeCompare(nameB);
                    break;
                }
                case "email": cmp = (a.email || "").localeCompare(b.email || ""); break;
                case "total_spent": cmp = a.total_spent - b.total_spent; break;
                case "order_count": cmp = a.order_count - b.order_count; break;
                case "last_order": cmp = (a.last_order || "").localeCompare(b.last_order || ""); break;
                case "language_pref": cmp = (a.language_pref || "").localeCompare(b.language_pref || ""); break;
                case "created_at": cmp = (a.created_at || "").localeCompare(b.created_at || ""); break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [customers, sortKey, sortDir, search]);

    const SortHeader = ({ col, children }: { col: SortKey; children: React.ReactNode }) => (
        <th
            onClick={() => toggleSort(col)}
            style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
        >
            {children} {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </th>
    );

    return (
        <>
            <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <h1 className={styles.pageTitle}>Customers ({customers.length})</h1>
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        padding: "8px 14px", borderRadius: "8px", border: "1px solid #e2e8f0",
                        fontSize: "0.85rem", width: "260px", fontFamily: "inherit",
                    }}
                />
            </div>

            {loading ? (
                <p style={{ color: "#6b7280" }}>Loading...</p>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👥</p>
                    <p>{search ? "No matching customers" : "No customers yet"}</p>
                </div>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <SortHeader col="name">Name</SortHeader>
                            <SortHeader col="email">Email</SortHeader>
                            <SortHeader col="total_spent">Total Spent</SortHeader>
                            <SortHeader col="order_count">Orders</SortHeader>
                            <SortHeader col="last_order">Last Order</SortHeader>
                            <SortHeader col="language_pref">Lang</SortHeader>
                            <SortHeader col="created_at">Joined</SortHeader>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((c) => (
                            <tr key={c.id} onClick={() => router.push(`/admin/customers/${c.id}`)} style={{ cursor: "pointer" }}>
                                <td style={{ fontWeight: 600 }}>
                                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                                </td>
                                <td style={{ fontSize: "0.85rem" }}>{c.email}</td>
                                <td style={{ fontWeight: 700, color: c.total_spent > 0 ? "#166534" : "#94a3b8" }}>
                                    €{c.total_spent.toFixed(2)}
                                </td>
                                <td style={{ textAlign: "center", fontWeight: 600 }}>
                                    {c.order_count}
                                </td>
                                <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                    {c.last_order ? new Date(c.last_order).toLocaleDateString() : "—"}
                                </td>
                                <td>
                                    <span style={{
                                        padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem",
                                        fontWeight: 600, background: "#f3f4f6",
                                    }}>
                                        {c.language_pref?.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                    {new Date(c.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </>
    );
}
