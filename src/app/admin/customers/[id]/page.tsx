"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "../../admin.module.css";

type Customer = {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    language_pref: string;
    addresses: Array<{
        street?: string;
        city?: string;
        postalCode?: string;
        country?: string;
    }>;
    created_at: string;
    updated_at: string;
};

export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();
        supabase
            .from("customers")
            .select("*")
            .eq("id", id)
            .single()
            .then(({ data }) => {
                setCustomer(data);
                setLoading(false);
            });
    }, [id]);

    if (loading) return <p style={{ color: "#6b7280", padding: "2rem" }}>Loading...</p>;
    if (!customer) return <p style={{ color: "#ef4444", padding: "2rem" }}>Customer not found</p>;

    const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—";

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>
                    <Link href="/admin/customers" style={{ color: "#6b7280", textDecoration: "none", fontSize: "0.8em" }}>
                        ← Customers
                    </Link>
                    {" / "}{fullName}
                </h1>
            </div>

            <div className={styles.formCard}>
                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>First Name</label>
                        <div style={{ padding: "0.6rem 0", fontSize: "0.95rem" }}>{customer.first_name || "—"}</div>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Last Name</label>
                        <div style={{ padding: "0.6rem 0", fontSize: "0.95rem" }}>{customer.last_name || "—"}</div>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Email</label>
                        <div style={{ padding: "0.6rem 0", fontSize: "0.95rem" }}>
                            <a href={`mailto:${customer.email}`} style={{ color: "#2563eb" }}>{customer.email}</a>
                        </div>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Phone</label>
                        <div style={{ padding: "0.6rem 0", fontSize: "0.95rem" }}>{customer.phone || "—"}</div>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Language</label>
                        <div style={{ padding: "0.6rem 0" }}>
                            <span style={{
                                padding: "2px 10px",
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: "#f3f4f6",
                            }}>
                                {customer.language_pref?.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Joined</label>
                        <div style={{ padding: "0.6rem 0", fontSize: "0.95rem" }}>
                            {new Date(customer.created_at).toLocaleDateString("en-US", {
                                year: "numeric", month: "long", day: "numeric"
                            })}
                        </div>
                    </div>
                </div>

                {customer.addresses && customer.addresses.length > 0 && customer.addresses[0]?.street && (
                    <div className={styles.formSection}>
                        <h3 className={styles.formSectionTitle}>Addresses</h3>
                        {customer.addresses.map((addr, i) => (
                            <div key={i} style={{
                                padding: "0.75rem 1rem",
                                background: "#f9fafb",
                                borderRadius: "8px",
                                marginBottom: "0.5rem",
                                fontSize: "0.9rem",
                                lineHeight: 1.6,
                            }}>
                                {addr.street && <div>{addr.street}</div>}
                                <div>
                                    {[addr.postalCode, addr.city].filter(Boolean).join(" ")}
                                    {addr.country && <span style={{ color: "#6b7280" }}> ({addr.country})</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
