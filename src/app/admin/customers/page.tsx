"use client";

import { useEffect, useState } from "react";
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
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();
        supabase
            .from("customers")
            .select("id, email, first_name, last_name, phone, language_pref, created_at")
            .order("created_at", { ascending: false })
            .then(({ data }) => {
                setCustomers(data || []);
                setLoading(false);
            });
    }, []);

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Customers</h1>
            </div>

            {loading ? (
                <p style={{ color: "#6b7280" }}>Loading...</p>
            ) : customers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👥</p>
                    <p>No customers yet</p>
                </div>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Language</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((c) => (
                            <tr key={c.id} onClick={() => router.push(`/admin/customers/${c.id}`)} style={{ cursor: "pointer" }}>
                                <td style={{ fontWeight: 600 }}>
                                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                                </td>
                                <td>{c.email}</td>
                                <td style={{ color: "#6b7280" }}>{c.phone || "—"}</td>
                                <td>
                                    <span style={{
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        background: "#f3f4f6",
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
