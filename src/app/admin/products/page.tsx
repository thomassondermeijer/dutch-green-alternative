"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../admin.module.css";

type Product = {
    id: string;
    slug: string;
    category: string;
    price: string;
    stock: number;
    is_active: boolean;
    sort_order: number;
    translations: Record<string, { name: string }>;
};

export default function AdminProducts() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/products")
            .then((res) => res.json())
            .then((data) => {
                setProducts(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        const res = await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
        if (res.ok) {
            setProducts((prev) => prev.filter((p) => p.id !== id));
        }
    };

    const handleToggle = async (product: Product) => {
        const res = await fetch("/api/admin/products", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
        });
        if (res.ok) {
            setProducts((prev) =>
                prev.map((p) =>
                    p.id === product.id ? { ...p, is_active: !p.is_active } : p
                )
            );
        }
    };

    if (loading) return <p>Loading products...</p>;

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Products ({products.length})</h1>
                <Link
                    href="/admin/products/new"
                    style={{
                        padding: "0.5rem 1.25rem",
                        backgroundColor: "#2d5a3d",
                        color: "white",
                        borderRadius: "8px",
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                    }}
                >
                    + Add Product
                </Link>
            </div>

            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th>Order</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {products.map((product) => (
                        <tr key={product.id}>
                            <td>
                                <div className={styles.productName}>
                                    {product.translations?.de?.name || product.slug}
                                </div>
                                <div className={styles.productSlug}>{product.slug}</div>
                            </td>
                            <td>
                                <span
                                    className={`${styles.badge} ${product.category === "raw"
                                            ? styles.badgeRaw
                                            : styles.badgePure
                                        }`}
                                >
                                    {product.category}
                                </span>
                            </td>
                            <td>€{parseFloat(product.price).toFixed(2)}</td>
                            <td>{product.stock}</td>
                            <td>
                                <button
                                    onClick={() => handleToggle(product)}
                                    className={`${styles.badge} ${product.is_active
                                            ? styles.badgeActive
                                            : styles.badgeInactive
                                        }`}
                                    style={{ cursor: "pointer", border: "none" }}
                                >
                                    {product.is_active ? "Active" : "Inactive"}
                                </button>
                            </td>
                            <td>{product.sort_order}</td>
                            <td>
                                <div className={styles.actions}>
                                    <Link
                                        href={`/admin/products/${product.id}`}
                                        className={styles.actionBtn}
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                        onClick={() =>
                                            handleDelete(
                                                product.id,
                                                product.translations?.de?.name || product.slug
                                            )
                                        }
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
