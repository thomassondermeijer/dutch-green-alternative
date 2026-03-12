"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildMarketingNewsletterEmail } from "@/lib/resend/templates/marketing-newsletter";
import styles from "../admin.module.css";

type Tab = "campaigns" | "preview" | "stats";
type Campaign = {
    id: string; source_url: string; source_title: string;
    subject_de: string; subject_nl: string; subject_en: string;
    body_html_de: string; body_html_nl: string; body_html_en: string;
    image_url: string; image_prompt: string;
    recommended_product_slug: string;
    coupon_code: string; coupon_discount: number;
    status: string; scheduled_for: string | null;
    sent_at: string | null; sent_count: number; failed_count: number;
    created_at: string; generation_log: Record<string, unknown>;
};

const PRODUCTS: Record<string, { name: string; price: number }> = {
    "cbd-raw-5-5": { name: "RAW CBD Öl 5,5%", price: 29.95 },
    "cbd-raw-11": { name: "RAW CBD Öl 11%", price: 41.95 },
    "cbd-gold-35": { name: "CBD Gold 35%", price: 84.95 },
    "golden-spectrum-35": { name: "Golden Spectrum 35% (CBD+CBG+CBN)", price: 89.95 },
    "cbg-raw-12": { name: "CBG RAW 12%", price: 49.95 },
    "mind-comfort-8": { name: "Mind Comfort", price: 44.95 },
    "good-night-8": { name: "Good Night", price: 44.95 },
    "body-harmony-8": { name: "Body Harmony", price: 44.95 },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    draft: { bg: "#f1f5f9", text: "#475569" },
    generating: { bg: "#fef3c7", text: "#92400e" },
    approved: { bg: "#dbeafe", text: "#1e40af" },
    sending: { bg: "#fef3c7", text: "#92400e" },
    sent: { bg: "#dcfce7", text: "#166534" },
    failed: { bg: "#fef2f2", text: "#991b1b" },
};

export default function MarketingPage() {
    const [tab, setTab] = useState<Tab>("campaigns");
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [locale, setLocale] = useState("de");
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const [showSource, setShowSource] = useState(false);
    const [customerCount, setCustomerCount] = useState(0);
    const [totalSent, setTotalSent] = useState(0);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const loadCampaigns = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false });
        setCampaigns((data || []) as Campaign[]);
        setLoading(false);
    }, []);

    const loadStats = useCallback(async () => {
        const supabase = createClient();
        const { count: custCount } = await supabase.from("customers").select("*", { count: "exact", head: true }).not("email", "is", null);
        setCustomerCount(custCount || 0);
        const { count: sentCount } = await supabase.from("email_log").select("*", { count: "exact", head: true }).eq("template", "marketing-newsletter");
        setTotalSent(sentCount || 0);
    }, []);

    useEffect(() => { loadCampaigns(); loadStats(); }, [loadCampaigns, loadStats]);

    const showMsg = (type: "success" | "error", text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const [genProgress, setGenProgress] = useState("");

    // ═══ Generate new campaign (3-step pipeline) ═══
    const handleGenerate = async () => {
        setGenerating(true);
        setMessage(null);
        try {
            // Step 1: Scrape + coupon
            setGenProgress("Step 1/3: Scraping BudMed...");
            const res1 = await fetch("/api/admin/marketing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ step: 1 }),
            });
            const data1 = await res1.json();
            if (!res1.ok) throw new Error(data1.error || "Step 1 failed");

            // Step 2: Claude AI rewrite
            setGenProgress("Step 2/3: AI writing email...");
            const res2 = await fetch("/api/admin/marketing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ step: 2, campaignId: data1.campaignId }),
            });
            const data2 = await res2.json();
            if (!res2.ok) throw new Error(data2.error || "Step 2 failed");

            // Step 3: Gemini image
            setGenProgress("Step 3/3: Generating image...");
            const res3 = await fetch("/api/admin/marketing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ step: 3, campaignId: data1.campaignId }),
            });
            const data3 = await res3.json();
            if (!res3.ok) throw new Error(data3.error || "Step 3 failed");

            showMsg("success", "Campaign draft generated! Click it to preview.");
            loadCampaigns();
        } catch (err) {
            showMsg("error", err instanceof Error ? err.message : "Generation failed");
            loadCampaigns(); // Refresh to show partial results
        }
        setGenerating(false);
        setGenProgress("");
    };

    // ═══ Approve campaign ═══
    const handleApprove = async (scheduledFor?: string) => {
        if (!selectedCampaign) return;
        try {
            const res = await fetch("/api/admin/marketing/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId: selectedCampaign.id, scheduledFor }),
            });
            if (!res.ok) throw new Error("Approval failed");
            showMsg("success", scheduledFor ? "Campaign approved and scheduled!" : "Campaign approved!");
            loadCampaigns();
            setSelectedCampaign({ ...selectedCampaign, status: "approved" });
        } catch (err) {
            showMsg("error", err instanceof Error ? err.message : "Approval failed");
        }
    };

    // ═══ Send campaign ═══
    const handleSend = async (isTest = false) => {
        if (!selectedCampaign) return;
        setSending(true);
        try {
            const body: Record<string, string> = { campaignId: selectedCampaign.id };
            if (isTest && testEmail) body.testEmail = testEmail;
            const res = await fetch("/api/admin/marketing/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Send failed");
            showMsg("success", isTest ? `Test email sent to ${testEmail}!` : `Campaign sent to ${data.sent} recipients!`);
            loadCampaigns();
        } catch (err) {
            showMsg("error", err instanceof Error ? err.message : "Send failed");
        }
        setSending(false);
    };

    // ═══ Delete draft campaign ═══
    const handleDelete = async (campaignId: string) => {
        if (!confirm("Delete this draft campaign?")) return;
        try {
            const res = await fetch("/api/admin/marketing/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId }),
            });
            if (!res.ok) throw new Error("Delete failed");
            showMsg("success", "Draft deleted");
            if (selectedCampaign?.id === campaignId) {
                setSelectedCampaign(null);
                setTab("campaigns");
            }
            loadCampaigns();
        } catch (err) {
            showMsg("error", err instanceof Error ? err.message : "Delete failed");
        }
    };

    // Build preview HTML
    const getPreviewHtml = (camp: Campaign) => {
        const subjectKey = `subject_${locale}` as keyof Campaign;
        const bodyKey = `body_html_${locale}` as keyof Campaign;
        const product = PRODUCTS[camp.recommended_product_slug] || { name: "CBD Oil", price: 29.95 };

        return buildMarketingNewsletterEmail({
            subject: (camp[subjectKey] as string) || camp.subject_de,
            bodyHtml: (camp[bodyKey] as string) || camp.body_html_de,
            imageUrl: camp.image_url || undefined,
            productName: product.name,
            productSlug: camp.recommended_product_slug,
            productPrice: product.price,
            couponCode: camp.coupon_code,
            couponDiscount: camp.coupon_discount,
            locale,
        });
    };

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Marketing Hub</h1>
                <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", borderRadius: "8px", padding: "3px" }}>
                    {(["campaigns", "preview", "stats"] as Tab[]).map((t) => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: "8px 16px", border: "none", borderRadius: "6px", cursor: "pointer",
                            fontSize: "0.85rem", fontWeight: 600, fontFamily: "inherit",
                            background: tab === t ? "white" : "transparent",
                            color: tab === t ? "#1e293b" : "#64748b",
                            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        }}>
                            {t === "campaigns" ? "📢 Campaigns" : t === "preview" ? "👁 Preview" : "📊 Stats"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toast */}
            {message && (
                <div style={{
                    padding: "12px 20px", borderRadius: "8px", marginBottom: "1rem", fontWeight: 600, fontSize: "0.85rem",
                    background: message.type === "success" ? "#dcfce7" : "#fef2f2",
                    color: message.type === "success" ? "#166534" : "#991b1b",
                    border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                }}>
                    {message.type === "success" ? "✅" : "❌"} {message.text}
                </div>
            )}

            {/* ═══ TAB 1: Campaigns ═══ */}
            {tab === "campaigns" && (
                <>
                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} · {customerCount} subscribers
                            </span>
                        </div>
                        <button onClick={handleGenerate} disabled={generating} style={{
                            padding: "10px 20px", borderRadius: "8px", border: "none", cursor: generating ? "wait" : "pointer",
                            background: generating ? "#94a3b8" : "linear-gradient(135deg, #2d5a3d, #4a7c59)",
                            color: "white", fontWeight: 700, fontSize: "0.9rem", fontFamily: "inherit",
                            opacity: generating ? 0.7 : 1, display: "flex", alignItems: "center", gap: "8px",
                        }}>
                            {generating ? (
                                <>
                                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                    {genProgress || "Generating with AI..."}
                                </>
                            ) : "🤖 Generate New Campaign"}
                        </button>
                    </div>

                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                    {/* Campaign list */}
                    {loading ? <p style={{ color: "#94a3b8" }}>Loading...</p> : campaigns.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
                            <p style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📢</p>
                            <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>No campaigns yet</p>
                            <p>Click "Generate New Campaign" to create your first AI-powered email</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {campaigns.map(camp => {
                                const statusColor = STATUS_COLORS[camp.status] || STATUS_COLORS.draft;
                                const product = PRODUCTS[camp.recommended_product_slug];
                                return (
                                    <div key={camp.id} onClick={() => { setSelectedCampaign(camp); setTab("preview"); }}
                                        style={{
                                            background: "white", borderRadius: "12px", padding: "1.25rem",
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer",
                                            border: "1px solid #f1f5f9", transition: "box-shadow 0.15s",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
                                        onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                                                    <span style={{
                                                        padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem",
                                                        fontWeight: 700, textTransform: "uppercase",
                                                        background: statusColor.bg, color: statusColor.text,
                                                    }}>{camp.status}</span>
                                                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                                        {new Date(camp.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                                                    {camp.subject_de || camp.source_title}
                                                </h3>
                                                <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                                                    📦 {product?.name || camp.recommended_product_slug} · 🏷️ {camp.coupon_code} ({camp.coupon_discount}%)
                                                    {camp.sent_count > 0 && ` · ✉️ ${camp.sent_count} sent`}
                                                </p>
                                            </div>
                                            {camp.image_url && (
                                                <img src={camp.image_url} alt="" style={{ width: 64, height: 64, borderRadius: "8px", objectFit: "cover", marginLeft: "1rem" }} />
                                            )}
                                            {camp.status === "draft" && (
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(camp.id); }} style={{
                                                    padding: "6px 10px", borderRadius: "6px", border: "1px solid #fecaca",
                                                    background: "#fef2f2", color: "#dc2626", cursor: "pointer",
                                                    fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit",
                                                    marginLeft: "0.5rem", whiteSpace: "nowrap",
                                                }}>🗑️</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ═══ TAB 2: Preview & Approve ═══ */}
            {tab === "preview" && (
                selectedCampaign ? (
                    <>
                        {/* Controls */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                            <button onClick={() => { setTab("campaigns"); setSelectedCampaign(null); }} style={{
                                padding: "6px 14px", borderRadius: "6px", border: "1px solid #e2e8f0",
                                background: "white", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit",
                            }}>← Back</button>

                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                {/* Language switcher */}
                                <div style={{ display: "flex", gap: "2px", background: "#f1f5f9", borderRadius: "6px", padding: "2px" }}>
                                    {["de", "nl", "en"].map(l => (
                                        <button key={l} onClick={() => setLocale(l)} style={{
                                            padding: "5px 10px", borderRadius: "4px", border: "none", cursor: "pointer",
                                            fontSize: "0.8rem", fontWeight: 600, fontFamily: "inherit",
                                            background: locale === l ? "white" : "transparent",
                                            color: locale === l ? "#1e293b" : "#94a3b8",
                                        }}>{l.toUpperCase()}</button>
                                    ))}
                                </div>

                                <button onClick={() => setShowSource(!showSource)} style={{
                                    padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600,
                                    cursor: "pointer", border: "1px solid #e2e8f0", fontFamily: "inherit",
                                    background: showSource ? "#1e293b" : "white", color: showSource ? "white" : "#64748b",
                                }}>{showSource ? "👁 Preview" : "</> Source"}</button>
                            </div>
                        </div>

                        {/* Campaign info bar */}
                        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                            {[
                                { label: "Status", value: selectedCampaign.status.toUpperCase(), color: STATUS_COLORS[selectedCampaign.status]?.text || "#475569" },
                                { label: "Product", value: PRODUCTS[selectedCampaign.recommended_product_slug]?.name || "—" },
                                { label: "Coupon", value: `${selectedCampaign.coupon_code} (${selectedCampaign.coupon_discount}%)` },
                                { label: "Source", value: selectedCampaign.source_title?.slice(0, 40) || "—" },
                            ].map(item => (
                                <div key={item.label} style={{
                                    background: "white", borderRadius: "8px", padding: "10px 16px",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)", flex: "1 1 120px",
                                }}>
                                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>{item.label}</div>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: item.color || "#1e293b" }}>{item.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Subject line */}
                        <div style={{ background: "white", borderRadius: "8px", padding: "12px 16px", marginBottom: "1rem", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600 }}>SUBJECT: </span>
                            <span style={{ fontWeight: 700, color: "#1e293b" }}>
                                {(selectedCampaign as unknown as Record<string, string>)[`subject_${locale}`] || selectedCampaign.subject_de}
                            </span>
                        </div>

                        {/* Preview iframe or source */}
                        <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                            <div style={{ background: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "6px", alignItems: "center" }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                                <span style={{ marginLeft: "1rem", color: "#94a3b8", fontSize: "0.75rem" }}>
                                    {showSource ? "HTML Source" : "Email Preview"} — {locale.toUpperCase()}
                                </span>
                            </div>

                            {showSource ? (
                                <textarea
                                    value={getPreviewHtml(selectedCampaign)}
                                    readOnly
                                    style={{
                                        width: "100%", height: "700px", border: "none", padding: "16px",
                                        fontFamily: "'JetBrains Mono', monospace", fontSize: "12px",
                                        lineHeight: 1.5, resize: "none", background: "#1e293b", color: "#e2e8f0",
                                        outline: "none",
                                    }}
                                />
                            ) : (
                                <iframe
                                    srcDoc={getPreviewHtml(selectedCampaign)}
                                    style={{ width: "100%", height: "700px", border: "none", background: "#f3f4f6" }}
                                    title="Campaign Preview"
                                />
                            )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                            {selectedCampaign.status === "draft" && (
                                <>
                                    <button onClick={() => handleApprove()} style={{
                                        padding: "10px 20px", borderRadius: "8px", border: "none", cursor: "pointer",
                                        background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                                        color: "white", fontWeight: 700, fontSize: "0.9rem", fontFamily: "inherit",
                                    }}>✅ Approve</button>

                                    <button onClick={() => {
                                        const d = new Date(Date.now() + 86400000);
                                        handleApprove(d.toISOString());
                                    }} style={{
                                        padding: "10px 20px", borderRadius: "8px", border: "1px solid #e2e8f0",
                                        background: "white", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", fontFamily: "inherit",
                                    }}>⏰ Approve + Schedule (tomorrow)</button>

                                    <button onClick={() => handleDelete(selectedCampaign.id)} style={{
                                        padding: "10px 20px", borderRadius: "8px", border: "1px solid #fecaca",
                                        background: "#fef2f2", color: "#dc2626", cursor: "pointer",
                                        fontWeight: 600, fontSize: "0.85rem", fontFamily: "inherit",
                                    }}>🗑️ Delete Draft</button>
                                </>
                            )}

                            {(selectedCampaign.status === "approved" || selectedCampaign.status === "draft") && (
                                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
                                    <input type="email" placeholder="test@email.com" value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        style={{
                                            padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0",
                                            fontSize: "0.85rem", width: "200px", fontFamily: "inherit",
                                        }}
                                    />
                                    <button onClick={() => handleSend(true)} disabled={!testEmail || sending} style={{
                                        padding: "8px 16px", borderRadius: "6px", border: "1px solid #e2e8f0",
                                        background: "white", cursor: testEmail ? "pointer" : "default",
                                        fontWeight: 600, fontSize: "0.85rem", fontFamily: "inherit",
                                        opacity: testEmail ? 1 : 0.5,
                                    }}>📬 Test Send</button>
                                </div>
                            )}

                            {selectedCampaign.status === "approved" && (
                                <button onClick={() => handleSend(false)} disabled={sending} style={{
                                    padding: "10px 20px", borderRadius: "8px", border: "none", cursor: sending ? "wait" : "pointer",
                                    background: sending ? "#94a3b8" : "linear-gradient(135deg, #dc2626, #ef4444)",
                                    color: "white", fontWeight: 700, fontSize: "0.9rem", fontFamily: "inherit",
                                }}>
                                    {sending ? "Sending..." : `🚀 Send to ${customerCount} customers`}
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
                        <p style={{ fontSize: "2rem" }}>👁</p>
                        <p>Select a campaign from the Campaigns tab to preview it</p>
                    </div>
                )
            )}

            {/* ═══ TAB 3: Stats ═══ */}
            {tab === "stats" && (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                        {[
                            { label: "Total Campaigns", value: campaigns.length, icon: "📢", color: "#2d5a3d" },
                            { label: "Sent", value: campaigns.filter(c => c.status === "sent").length, icon: "✅", color: "#16a34a" },
                            { label: "Drafts", value: campaigns.filter(c => c.status === "draft").length, icon: "📝", color: "#f59e0b" },
                            { label: "Subscribers", value: customerCount, icon: "👥", color: "#3b82f6" },
                            { label: "Emails Delivered", value: totalSent, icon: "✉️", color: "#8b5cf6" },
                            { label: "Bi-weekly Budget", value: `${customerCount}/3000`, icon: "📊", color: "#64748b" },
                        ].map(stat => (
                            <div key={stat.label} style={{
                                background: "white", borderRadius: "12px", padding: "20px",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderLeft: `4px solid ${stat.color}`,
                            }}>
                                <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>
                                    {stat.icon} {stat.label}
                                </div>
                                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color }}>
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Campaign history */}
                    <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Campaign History</h3>
                    {campaigns.filter(c => c.status === "sent").length === 0 ? (
                        <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No campaigns sent yet</p>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Subject</th>
                                    <th>Sent</th>
                                    <th>Failed</th>
                                    <th>Coupon</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.filter(c => c.status === "sent").map(camp => (
                                    <tr key={camp.id}>
                                        <td style={{ fontSize: "0.8rem" }}>{camp.sent_at ? new Date(camp.sent_at).toLocaleDateString() : "—"}</td>
                                        <td style={{ fontWeight: 600, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{camp.subject_de}</td>
                                        <td><span style={{ color: "#16a34a", fontWeight: 700 }}>{camp.sent_count}</span></td>
                                        <td><span style={{ color: camp.failed_count > 0 ? "#dc2626" : "#94a3b8", fontWeight: 600 }}>{camp.failed_count}</span></td>
                                        <td><code style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", fontSize: "0.8rem" }}>{camp.coupon_code}</code></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </>
    );
}
