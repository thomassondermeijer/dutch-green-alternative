"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import styles from "../admin.module.css";

type Review = {
    id: string;
    customer_name: string;
    customer_email: string;
    rating: number;
    text: string | null;
    image_urls: string[];
    language: string;
    is_approved: boolean | null;
    verified_purchase: boolean;
    approved_at: string | null;
    created_at: string;
    coupon_code: string | null;
    order_id: string | null;
    product_id: string | null;
    product_name: string | null;
    orders: { order_number: string } | null;
};

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);

    useEffect(() => { fetchReviews(); }, []);

    const fetchReviews = async () => {
        setLoading(true);
        const res = await fetch("/api/admin/reviews/list");
        const data = await res.json();
        setReviews(data.reviews || []);
        setLoading(false);
    };

    const handleModerate = async (reviewId: string, action: "approve" | "reject") => {
        setActionLoading(reviewId);
        const res = await fetch("/api/admin/reviews/moderate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewId, action }),
        });
        if (res.ok) {
            await fetchReviews();
        }
        setActionLoading(null);
    };

    const filtered = reviews.filter(r => {
        if (tab === "pending") return r.is_approved === null || (r.is_approved === false && !r.approved_at);
        if (tab === "approved") return r.is_approved === true;
        return r.is_approved === false && r.approved_at !== null;
    });

    const renderStars = (count: number) => (
        <span style={{ color: "#f59e0b" }}>{"★".repeat(count)}{"☆".repeat(5 - count)}</span>
    );

    return (
        <div>
            <h1 style={{ marginBottom: "1.5rem" }}>⭐ Reviews</h1>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                {(["pending", "approved", "rejected"] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "8px",
                            border: tab === t ? "2px solid #2d5a3d" : "1px solid #e5e7eb",
                            background: tab === t ? "#f0fdf4" : "#fff",
                            color: tab === t ? "#2d5a3d" : "#6b7280",
                            fontWeight: tab === t ? 600 : 400,
                            cursor: "pointer",
                            fontSize: "14px",
                        }}
                    >
                        {t === "pending" ? `🟡 Pending (${reviews.filter(r => r.is_approved === null || (r.is_approved === false && !r.approved_at)).length})` :
                            t === "approved" ? `✅ Approved (${reviews.filter(r => r.is_approved === true).length})` :
                                `❌ Rejected (${reviews.filter(r => r.is_approved === false && r.approved_at !== null).length})`}
                    </button>
                ))}
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#9ca3af" }}>
                    <p style={{ fontSize: "2rem" }}>📝</p>
                    <p>No {tab} reviews</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {filtered.map(review => (
                        <div key={review.id} style={{
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "12px",
                            padding: "1.25rem",
                            position: "relative",
                        }}>
                            {/* Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "4px" }}>
                                        <strong>{review.customer_name}</strong>
                                        {review.verified_purchase && (
                                            <span style={{ fontSize: "11px", background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: "99px", fontWeight: 600 }}>
                                                ✓ Verified
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "#9ca3af" }}>
                                        {review.customer_email} · {new Date(review.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: "18px" }}>{renderStars(review.rating)}</div>
                                    {review.product_name && <div style={{ fontSize: "12px", color: "#6b7280" }}>{review.product_name}</div>}
                                    {review.orders && <div style={{ fontSize: "12px", color: "#9ca3af" }}>Order: {review.orders.order_number}</div>}
                                </div>
                            </div>

                            {/* Text */}
                            {review.text && (
                                <p style={{ margin: "0 0 0.75rem", color: "#374151", lineHeight: 1.6, fontSize: "14px" }}>
                                    &ldquo;{review.text}&rdquo;
                                </p>
                            )}

                            {/* Photos */}
                            {review.image_urls && review.image_urls.length > 0 && (
                                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                    {review.image_urls.map((url, i) => (
                                        <div
                                            key={i}
                                            style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", cursor: "pointer", border: "1px solid #e5e7eb" }}
                                            onClick={() => setLightboxImg(url)}
                                        >
                                            <Image src={url} alt={`Review photo ${i + 1}`} width={80} height={80} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Coupon info */}
                            {review.coupon_code && (
                                <div style={{ fontSize: "12px", color: "#2d5a3d", background: "#f0fdf4", padding: "4px 10px", borderRadius: "6px", display: "inline-block", marginBottom: "0.5rem" }}>
                                    Coupon: <strong>{review.coupon_code}</strong>
                                </div>
                            )}

                            {/* Actions */}
                            {tab === "pending" && (
                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                    <button
                                        onClick={() => handleModerate(review.id, "approve")}
                                        disabled={actionLoading === review.id}
                                        style={{
                                            padding: "8px 20px", borderRadius: "8px", border: "none",
                                            background: "#2d5a3d", color: "#fff", fontWeight: 600,
                                            cursor: "pointer", fontSize: "13px",
                                            opacity: actionLoading === review.id ? 0.5 : 1,
                                        }}
                                    >
                                        {actionLoading === review.id ? "..." : "✅ Approve & Send Coupon"}
                                    </button>
                                    <button
                                        onClick={() => handleModerate(review.id, "reject")}
                                        disabled={actionLoading === review.id}
                                        style={{
                                            padding: "8px 20px", borderRadius: "8px",
                                            border: "1px solid #e5e7eb", background: "#fff",
                                            color: "#6b7280", cursor: "pointer", fontSize: "13px",
                                        }}
                                    >
                                        ❌ Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightboxImg && (
                <div
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
                        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
                        cursor: "pointer",
                    }}
                    onClick={() => setLightboxImg(null)}
                >
                    <Image src={lightboxImg} alt="Review photo" width={600} height={600} style={{ objectFit: "contain", maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px" }} />
                </div>
            )}
        </div>
    );
}
