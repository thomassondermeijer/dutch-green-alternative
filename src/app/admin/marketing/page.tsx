"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildMarketingNewsletterEmail } from "@/lib/resend/templates/marketing-newsletter";
import styles from "../admin.module.css";

type Tab = "library" | "campaigns" | "preview" | "stats";

type Article = {
    id: string; url: string; title: string; has_cancer_content: boolean; scraped_at: string;
};

type SubjectOption = { de: string; nl: string; en: string; angle: string };

type Campaign = {
    id: string; source_url: string; source_title: string;
    subject_de: string; subject_nl: string; subject_en: string;
    body_html_de: string; body_html_nl: string; body_html_en: string;
    image_url: string; image_prompt: string;
    recommended_product_slug: string;
    coupon_code: string; coupon_discount: number;
    status: string; scheduled_for: string | null;
    sent_at: string | null; sent_count: number; failed_count: number;
    send_order: number | null;
    audience_filter: AudienceFilter;
    subject_options: SubjectOption[];
    created_at: string; generation_log: Record<string, unknown>;
    article_id: string | null;
};

type AudienceFilter = {
    min_spent?: number;
    max_spent?: number;
    ordered_within_days?: number;
    ordered_before_days?: number;
    min_order_count?: number;
    languages?: string[];
    has_purchased_product?: string[];
    never_purchased?: boolean;
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

// Shared button styles
const btnBase = { padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", fontFamily: "inherit" } as const;
const btnPrimary = { ...btnBase, background: "linear-gradient(135deg, #2d5a3d, #4a7c59)", color: "white" } as const;
const btnSecondary = { ...btnBase, border: "1px solid #e2e8f0", background: "white", color: "#475569" } as const;
const btnDanger = { ...btnBase, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626" } as const;

export default function MarketingPage() {
    const [tab, setTab] = useState<Tab>("library");
    const [articles, setArticles] = useState<Article[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [locale, setLocale] = useState("de");
    const [showSource, setShowSource] = useState(false);
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [scraping, setScraping] = useState(false);
    const [sending, setSending] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const [customerCount, setCustomerCount] = useState(0);
    const [totalSent, setTotalSent] = useState(0);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [genProgress, setGenProgress] = useState("");
    const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>({});
    const [filteredCount, setFilteredCount] = useState<number | null>(null);
    const [savedCoupon, setSavedCoupon] = useState<{ code: string; discount: number } | null>(null);

    // Track which articles already have campaigns
    const usedArticleIds = new Set(campaigns.map(c => c.article_id).filter(Boolean));

    const loadArticles = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase.from("budmed_articles").select("*").order("scraped_at", { ascending: false });
        setArticles((data || []) as Article[]);
    }, []);

    const loadCampaigns = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false });
        setCampaigns((data || []) as Campaign[]);
    }, []);

    const loadStats = useCallback(async () => {
        const supabase = createClient();
        const { count: custCount } = await supabase.from("customers").select("*", { count: "exact", head: true }).not("email", "is", null);
        setCustomerCount(custCount || 0);
        const { count: sentCount } = await supabase.from("email_log").select("*", { count: "exact", head: true }).eq("template", "marketing-newsletter");
        setTotalSent(sentCount || 0);
    }, []);

    useEffect(() => { loadArticles(); loadCampaigns(); loadStats(); }, [loadArticles, loadCampaigns, loadStats]);

    const showMsg = (type: "success" | "error", text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    // ═══ Scrape latest BudMed articles (fire-and-forget + Realtime) ═══
    const handleScrape = async () => {
        setScraping(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/marketing/scrape", { method: "POST" });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Scrape failed"); }

            showMsg("success", "Scraping BudMed... articles will appear as they're found");

            // Subscribe to new articles via Realtime
            const supabase = createClient();
            let newCount = 0;

            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => { channel.unsubscribe(); resolve(); }, 90000);

                const channel = supabase
                    .channel("scrape-progress")
                    .on("postgres_changes", {
                        event: "INSERT", schema: "public", table: "budmed_articles",
                    }, () => {
                        newCount++;
                        showMsg("success", `📰 Found ${newCount} new article${newCount > 1 ? "s" : ""}...`);
                        loadArticles();
                    })
                    .subscribe();

                // Auto-finish after 90s or when no new articles for 15s
                let lastActivity = Date.now();
                const checkDone = setInterval(() => {
                    if (Date.now() - lastActivity > 15000 && newCount > 0) {
                        clearInterval(checkDone); clearTimeout(timeout); channel.unsubscribe(); resolve();
                    }
                    lastActivity = Date.now();
                }, 5000);
            });

            loadArticles();
            showMsg("success", newCount > 0 ? `✅ Scraped ${newCount} new article(s)!` : "All articles already in library");
        } catch (err) {
            showMsg("error", err instanceof Error ? err.message : "Scrape failed");
        }
        setScraping(false);
    };

    // ═══ Generate campaign from article (Edge Function + Realtime) ═══
    const handleGenerate = async (articleId: string) => {
        setGeneratingId(articleId);
        setMessage(null);
        try {
            setGenProgress("Starting generation...");
            const res = await fetch("/api/admin/marketing/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ articleId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to start generation");

            const campaignId = data.campaignId;
            setGenProgress("🔍 Loading article content...");

            const supabase = createClient();
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    supabase.removeAllChannels();
                    reject(new Error("Generation timed out after 3 minutes"));
                }, 180000);

                const channel = supabase
                    .channel(`campaign-${campaignId}`)
                    .on("postgres_changes", {
                        event: "UPDATE", schema: "public", table: "marketing_campaigns",
                        filter: `id=eq.${campaignId}`,
                    }, (payload) => {
                        const camp = payload.new as Campaign;
                        const log = (camp.generation_log || {}) as Record<string, string>;
                        if (log.step === "scrape_done") setGenProgress("✍️ AI writing email content...");
                        else if (log.step === "ai_done") setGenProgress("🎨 Generating product image...");

                        if (camp.status === "draft") {
                            clearTimeout(timeout); channel.unsubscribe();
                            showMsg("success", "Campaign generated! Go to Campaigns tab to review.");
                            resolve();
                        } else if (camp.status === "failed") {
                            clearTimeout(timeout); channel.unsubscribe();
                            showMsg("error", log.error ? `Failed: ${log.error}` : "Generation failed");
                            resolve();
                        }
                    })
                    .subscribe();
            });

            loadCampaigns();
        } catch (err) {
            showMsg("error", err instanceof Error ? err.message : "Generation failed");
            loadCampaigns();
        }
        setGeneratingId(null);
        setGenProgress("");
    };

    // ═══ Delete campaign ═══
    const handleDelete = async (campaignId: string) => {
        if (!confirm("Delete this campaign?")) return;
        try {
            const res = await fetch("/api/admin/marketing/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId }),
            });
            if (!res.ok) throw new Error("Delete failed");
            showMsg("success", "Deleted");
            if (selectedCampaign?.id === campaignId) { setSelectedCampaign(null); setTab("campaigns"); }
            loadCampaigns();
        } catch (err) {
            showMsg("error", err instanceof Error ? err.message : "Delete failed");
        }
    };

    // ═══ Approve campaign ═══
    const handleApprove = async (scheduledFor?: string) => {
        if (!selectedCampaign) return;
        try {
            // Save audience filter first
            const supabase = createClient();
            await supabase.from("marketing_campaigns").update({ audience_filter: audienceFilter }).eq("id", selectedCampaign.id);

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

    // ═══ Count filtered recipients ═══
    const updateFilteredCount = async (filter: AudienceFilter) => {
        try {
            const res = await fetch("/api/admin/marketing/send", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(filter),
            });
            const data = await res.json();
            setFilteredCount(data.count ?? null);
        } catch {
            setFilteredCount(null);
        }
    };

    // Update count when filter changes
    useEffect(() => {
        const timer = setTimeout(() => updateFilteredCount(audienceFilter), 500);
        return () => clearTimeout(timer);
    }, [audienceFilter]);

    // Load filter from selected campaign
    useEffect(() => {
        if (selectedCampaign?.audience_filter) {
            setAudienceFilter(selectedCampaign.audience_filter);
        } else {
            setAudienceFilter({});
        }
    }, [selectedCampaign?.id]);

    const getPreviewHtml = (camp: Campaign) => {
        const subjectKey = `subject_${locale}` as keyof Campaign;
        const bodyKey = `body_html_${locale}` as keyof Campaign;
        const product = PRODUCTS[camp.recommended_product_slug] || { name: "CBD Oil", price: 29.95 };

        // Replace placeholder with "Max" for preview
        let bodyHtml = ((camp[bodyKey] as string) || camp.body_html_de || "");
        bodyHtml = bodyHtml.replace(/\{FIRST_NAME\}/g, "Max");

        return buildMarketingNewsletterEmail({
            subject: (camp[subjectKey] as string) || camp.subject_de,
            bodyHtml,
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
                    {(["library", "campaigns", "preview", "stats"] as Tab[]).map((t) => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: "8px 16px", border: "none", borderRadius: "6px", cursor: "pointer",
                            fontSize: "0.85rem", fontWeight: 600, fontFamily: "inherit",
                            background: tab === t ? "white" : "transparent",
                            color: tab === t ? "#1e293b" : "#64748b",
                            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        }}>
                            {t === "library" ? "📰 Content Library" : t === "campaigns" ? "📢 Campaigns" : t === "preview" ? "👁 Preview" : "📊 Stats"}
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

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* ═══ TAB 1: Content Library ═══ */}
            {tab === "library" && (
                <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                            {articles.length} article{articles.length !== 1 ? "s" : ""} in library
                        </span>
                        <button onClick={handleScrape} disabled={scraping} style={{
                            ...btnPrimary, opacity: scraping ? 0.7 : 1, cursor: scraping ? "wait" : "pointer",
                            display: "flex", alignItems: "center", gap: "8px",
                        }}>
                            {scraping ? (
                                <>
                                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                    Checking for new blogs...
                                </>
                            ) : "🔍 Check for New Blogs"}
                        </button>
                    </div>

                    {articles.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
                            <p style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📰</p>
                            <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>No articles yet</p>
                            <p>Click &ldquo;Check for New Blogs&rdquo; to populate the content library</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {articles.map(article => (
                                <div key={article.id} style={{
                                    background: "white", borderRadius: "12px", padding: "1.25rem",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9",
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                                                {article.has_cancer_content && (
                                                    <span style={{
                                                        padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem",
                                                        fontWeight: 700, background: "#fce7f3", color: "#be185d",
                                                    }}>🎗️ CANCER</span>
                                                )}
                                                {usedArticleIds.has(article.id) && (
                                                    <span style={{
                                                        padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem",
                                                        fontWeight: 700, background: "#dcfce7", color: "#166534",
                                                    }}>✅ Used</span>
                                                )}
                                                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                                    {new Date(article.scraped_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 700, color: usedArticleIds.has(article.id) ? "#94a3b8" : "#0f172a" }}>
                                                {article.title}
                                            </h3>
                                            <a href={article.url} target="_blank" rel="noopener noreferrer"
                                                style={{ fontSize: "0.75rem", color: "#3b82f6", textDecoration: "none" }}>
                                                View original →
                                            </a>
                                        </div>
                                        {usedArticleIds.has(article.id) ? (
                                            <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>Campaign created</span>
                                        ) : (
                                            <button
                                                onClick={() => handleGenerate(article.id)}
                                                disabled={generatingId !== null}
                                                style={{ ...btnPrimary, opacity: generatingId !== null ? 0.5 : 1, whiteSpace: "nowrap" }}
                                            >
                                                {generatingId === article.id ? genProgress || "Generating..." : "🤖 Generate Campaign"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )
            }

            {/* ═══ TAB 2: Campaigns (Queue) ═══ */}
            {
                tab === "campaigns" && (
                    <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} · {customerCount} subscribers
                            </span>
                        </div>

                        {campaigns.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
                                <p style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📢</p>
                                <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>No campaigns yet</p>
                                <p>Go to Content Library to generate campaigns from articles</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                {campaigns.map(camp => {
                                    const statusColor = STATUS_COLORS[camp.status] || STATUS_COLORS.draft;
                                    const product = PRODUCTS[camp.recommended_product_slug];
                                    return (
                                        <div key={camp.id}
                                            onClick={() => { setSelectedCampaign(camp); setSavedCoupon({ code: camp.coupon_code, discount: camp.coupon_discount }); setTab("preview"); }}
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
                                                {(camp.status === "draft" || camp.status === "generating" || camp.status === "approved") && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(camp.id); }}
                                                        style={{ ...btnDanger, padding: "6px 10px", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )
            }

            {/* ═══ TAB 3: Preview & Approve ═══ */}
            {
                tab === "preview" && (
                    selectedCampaign ? (
                        <>
                            {/* Controls */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                <button onClick={() => { setTab("campaigns"); setSelectedCampaign(null); }} style={btnSecondary}>← Back</button>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                                        ...btnSecondary,
                                        background: showSource ? "#1e293b" : "white",
                                        color: showSource ? "white" : "#64748b",
                                    }}>{showSource ? "👁 Preview" : "</> Source"}</button>
                                </div>
                            </div>

                            {/* Source article */}
                            {selectedCampaign.source_title && (
                                <div style={{ background: "#f0fdf4", borderRadius: "8px", padding: "10px 16px", marginBottom: "1rem", border: "1px solid #bbf7d0" }}>
                                    <span style={{ fontSize: "0.7rem", color: "#166534", fontWeight: 600 }}>BASED ON: </span>
                                    <a href={selectedCampaign.source_url} target="_blank" rel="noopener noreferrer"
                                        style={{ fontWeight: 600, color: "#166534", textDecoration: "none", fontSize: "0.85rem" }}>
                                        {selectedCampaign.source_title} →
                                    </a>
                                </div>
                            )}

                            {/* Campaign info bar — editable coupon/discount */}
                            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                                <div style={{ background: "white", borderRadius: "8px", padding: "10px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", flex: "1 1 120px" }}>
                                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>Status</div>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: STATUS_COLORS[selectedCampaign.status]?.text }}>{selectedCampaign.status.toUpperCase()}</div>
                                </div>
                                <div style={{ background: "white", borderRadius: "8px", padding: "10px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", flex: "1 1 120px" }}>
                                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>Product</div>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}>{PRODUCTS[selectedCampaign.recommended_product_slug]?.name || "—"}</div>
                                </div>
                                <div style={{ background: "white", borderRadius: "8px", padding: "10px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", flex: "1 1 200px" }}>
                                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Coupon Code</div>
                                    <input type="text" value={selectedCampaign.coupon_code}
                                        onChange={e => setSelectedCampaign({ ...selectedCampaign, coupon_code: e.target.value })}
                                        style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: 700, fontFamily: "monospace", boxSizing: "border-box" }} />
                                </div>
                                <div style={{ background: "white", borderRadius: "8px", padding: "10px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", flex: "0 0 120px" }}>
                                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Discount %</div>
                                    <input type="number" min={1} max={100} value={selectedCampaign.coupon_discount}
                                        onChange={e => setSelectedCampaign({ ...selectedCampaign, coupon_discount: Number(e.target.value) })}
                                        style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: 700, boxSizing: "border-box", fontFamily: "inherit" }} />
                                </div>
                                {savedCoupon && (savedCoupon.code !== selectedCampaign.coupon_code || savedCoupon.discount !== selectedCampaign.coupon_discount) && (
                                    <div style={{ display: "flex", alignItems: "flex-end", flex: "0 0 auto" }}>
                                        <button onClick={async () => {
                                            try {
                                                const supabase = createClient();
                                                await supabase.from("marketing_campaigns").update({
                                                    coupon_code: selectedCampaign.coupon_code,
                                                    coupon_discount: selectedCampaign.coupon_discount,
                                                }).eq("id", selectedCampaign.id);
                                                setSavedCoupon({ code: selectedCampaign.coupon_code, discount: selectedCampaign.coupon_discount });
                                                showMsg("success", "Coupon updated!");
                                                loadCampaigns();
                                            } catch { showMsg("error", "Save failed"); }
                                        }} style={{ ...btnPrimary, fontSize: "0.8rem", padding: "6px 14px" }}>💾 Save</button>
                                    </div>
                                )}
                                <div style={{ background: "white", borderRadius: "8px", padding: "10px 16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", flex: "1 1 120px" }}>
                                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>Audience</div>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}>{filteredCount !== null ? `${filteredCount} recipients` : "All subscribers"}</div>
                                </div>
                            </div>

                            {/* Audience Filter Panel */}
                            {(selectedCampaign.status === "draft" || selectedCampaign.status === "approved") && (
                                <div style={{
                                    background: "white", borderRadius: "12px", padding: "20px", marginBottom: "1rem",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9",
                                }}>
                                    <h4 style={{ margin: "0 0 12px", fontSize: "0.9rem", fontWeight: 700, color: "#1e293b" }}>
                                        🎯 Audience Filters
                                        {filteredCount !== null && <span style={{ fontWeight: 400, color: "#64748b", marginLeft: "8px" }}>({filteredCount} matching)</span>}
                                    </h4>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                                        {/* Min Spent */}
                                        <div>
                                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Min. Total Spent (€)</label>
                                            <input type="number" placeholder="0" min={0} value={audienceFilter.min_spent || ""}
                                                onChange={e => setAudienceFilter({ ...audienceFilter, min_spent: e.target.value ? Number(e.target.value) : undefined })}
                                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box" }} />
                                        </div>
                                        {/* Max Spent */}
                                        <div>
                                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Max. Total Spent (€)</label>
                                            <input type="number" placeholder="∞" min={0} value={audienceFilter.max_spent || ""}
                                                onChange={e => setAudienceFilter({ ...audienceFilter, max_spent: e.target.value ? Number(e.target.value) : undefined })}
                                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box" }} />
                                        </div>
                                        {/* Ordered Within */}
                                        <div>
                                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Ordered Within (days)</label>
                                            <select value={audienceFilter.ordered_within_days || ""}
                                                onChange={e => setAudienceFilter({ ...audienceFilter, ordered_within_days: e.target.value ? Number(e.target.value) : undefined })}
                                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box" }}>
                                                <option value="">All time</option>
                                                <option value="30">30 days</option>
                                                <option value="60">60 days</option>
                                                <option value="90">90 days</option>
                                                <option value="180">180 days</option>
                                                <option value="365">1 year</option>
                                            </select>
                                        </div>
                                        {/* Ordered Before */}
                                        <div>
                                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Inactive For (days)</label>
                                            <select value={audienceFilter.ordered_before_days || ""}
                                                onChange={e => setAudienceFilter({ ...audienceFilter, ordered_before_days: e.target.value ? Number(e.target.value) : undefined })}
                                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box" }}>
                                                <option value="">No filter</option>
                                                <option value="90">90+ days inactive</option>
                                                <option value="180">180+ days inactive</option>
                                                <option value="365">1+ year inactive</option>
                                            </select>
                                        </div>
                                        {/* Min Order Count */}
                                        <div>
                                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Min. Orders</label>
                                            <input type="number" placeholder="0" min={0} value={audienceFilter.min_order_count || ""}
                                                onChange={e => setAudienceFilter({ ...audienceFilter, min_order_count: e.target.value ? Number(e.target.value) : undefined })}
                                                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontFamily: "inherit", boxSizing: "border-box" }} />
                                        </div>
                                        {/* Language */}
                                        <div>
                                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Languages</label>
                                            <div style={{ display: "flex", gap: "6px" }}>
                                                {["de", "nl", "en"].map(lang => {
                                                    const active = !audienceFilter.languages || audienceFilter.languages.length === 0 || audienceFilter.languages.includes(lang);
                                                    return (
                                                        <button key={lang} onClick={() => {
                                                            const current = audienceFilter.languages || ["de", "nl", "en"];
                                                            const updated = active ? current.filter(l => l !== lang) : [...current, lang];
                                                            setAudienceFilter({ ...audienceFilter, languages: updated.length === 3 ? undefined : updated });
                                                        }} style={{
                                                            padding: "4px 10px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 600,
                                                            border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit",
                                                            background: active ? "#2d5a3d" : "white", color: active ? "white" : "#94a3b8",
                                                        }}>{lang.toUpperCase()}</button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        {/* Never Purchased */}
                                        <div>
                                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>Never Purchased</label>
                                            <button onClick={() => setAudienceFilter({ ...audienceFilter, never_purchased: !audienceFilter.never_purchased })}
                                                style={{
                                                    padding: "6px 14px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600,
                                                    border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit",
                                                    background: audienceFilter.never_purchased ? "#dc2626" : "white",
                                                    color: audienceFilter.never_purchased ? "white" : "#94a3b8",
                                                }}>{audienceFilter.never_purchased ? "Yes ✓" : "No"}</button>
                                        </div>
                                        {/* Reset */}
                                        <div style={{ display: "flex", alignItems: "flex-end" }}>
                                            <button onClick={() => setAudienceFilter({})} style={{ ...btnSecondary, fontSize: "0.8rem" }}>
                                                ↻ Reset Filters
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Subject line chooser */}
                            {selectedCampaign.subject_options && selectedCampaign.subject_options.length > 1 && (selectedCampaign.status === "draft" || selectedCampaign.status === "approved") ? (
                                <div style={{ marginBottom: "1rem" }}>
                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "8px" }}>Choose Subject Line ({locale.toUpperCase()})</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {selectedCampaign.subject_options.map((opt, idx) => {
                                            const currentSubject = (selectedCampaign as unknown as Record<string, string>)[`subject_${locale}`] || selectedCampaign.subject_de;
                                            const optSubject = (opt as unknown as Record<string, string>)[locale] || opt.de;
                                            const isSelected = currentSubject === optSubject;
                                            const angleEmoji = opt.angle === "research" ? "🔬" : opt.angle === "benefit" ? "💚" : "❓";
                                            const angleLabel = opt.angle === "research" ? "Research" : opt.angle === "benefit" ? "Benefit" : "Curiosity";
                                            return (
                                                <button key={idx} onClick={async () => {
                                                    const updated = { ...selectedCampaign, subject_de: opt.de, subject_nl: opt.nl, subject_en: opt.en };
                                                    setSelectedCampaign(updated);
                                                    const supabase = createClient();
                                                    await supabase.from("marketing_campaigns").update({
                                                        subject_de: opt.de, subject_nl: opt.nl, subject_en: opt.en,
                                                    }).eq("id", selectedCampaign.id);
                                                    showMsg("success", `Subject line ${idx + 1} selected!`);
                                                    loadCampaigns();
                                                }} style={{
                                                    display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
                                                    borderRadius: "8px", border: isSelected ? "2px solid #2d5a3d" : "1px solid #e2e8f0",
                                                    background: isSelected ? "#f0fdf4" : "white", cursor: "pointer", textAlign: "left",
                                                    boxShadow: isSelected ? "0 2px 8px rgba(45,90,61,0.15)" : "0 1px 2px rgba(0,0,0,0.04)",
                                                    transition: "all 0.15s", fontFamily: "inherit",
                                                }}>
                                                    <span style={{
                                                        padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700,
                                                        background: opt.angle === "research" ? "#dbeafe" : opt.angle === "benefit" ? "#dcfce7" : "#fef3c7",
                                                        color: opt.angle === "research" ? "#1e40af" : opt.angle === "benefit" ? "#166534" : "#92400e",
                                                        whiteSpace: "nowrap",
                                                    }}>{angleEmoji} {angleLabel}</span>
                                                    <span style={{ fontSize: "0.9rem", fontWeight: isSelected ? 700 : 500, color: "#1e293b", flex: 1 }}>{optSubject}</span>
                                                    {isSelected && <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "1.1rem" }}>✓</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ background: "white", borderRadius: "8px", padding: "12px 16px", marginBottom: "1rem", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600 }}>SUBJECT: </span>
                                    <span style={{ fontWeight: 700, color: "#1e293b" }}>
                                        {(selectedCampaign as unknown as Record<string, string>)[`subject_${locale}`] || selectedCampaign.subject_de}
                                    </span>
                                </div>
                            )}

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
                                    <textarea value={getPreviewHtml(selectedCampaign)} readOnly
                                        style={{ width: "100%", height: "700px", border: "none", padding: "16px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", lineHeight: 1.5, resize: "none", background: "#1e293b", color: "#e2e8f0", outline: "none" }} />
                                ) : (
                                    <iframe srcDoc={getPreviewHtml(selectedCampaign)}
                                        style={{ width: "100%", height: "700px", border: "none", background: "#f3f4f6" }} title="Campaign Preview" />
                                )}
                            </div>

                            {/* Action buttons */}
                            <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                                {selectedCampaign.status === "draft" && (
                                    <>
                                        <button onClick={() => handleApprove()} style={{ ...btnPrimary, background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>✅ Approve</button>
                                        <button onClick={() => { const d = new Date(Date.now() + 86400000); handleApprove(d.toISOString()); }} style={btnSecondary}>⏰ Schedule (tomorrow)</button>
                                    </>
                                )}
                                {(selectedCampaign.status === "draft" || selectedCampaign.status === "approved" || selectedCampaign.status === "generating") && (
                                    <button onClick={() => handleDelete(selectedCampaign.id)} style={btnDanger}>🗑️ Delete</button>
                                )}

                                {(selectedCampaign.status === "approved" || selectedCampaign.status === "draft") && (
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
                                        <input type="email" placeholder="test@email.com" value={testEmail}
                                            onChange={(e) => setTestEmail(e.target.value)}
                                            style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", width: "200px", fontFamily: "inherit" }} />
                                        <button onClick={() => handleSend(true)} disabled={!testEmail || sending}
                                            style={{ ...btnSecondary, opacity: testEmail ? 1 : 0.5 }}>📬 Test Send</button>
                                    </div>
                                )}

                                {selectedCampaign.status === "approved" && (
                                    <button onClick={() => handleSend(false)} disabled={sending} style={{
                                        ...btnBase, cursor: sending ? "wait" : "pointer",
                                        background: sending ? "#94a3b8" : "linear-gradient(135deg, #dc2626, #ef4444)",
                                        color: "white",
                                    }}>
                                        {sending ? "Sending..." : `🚀 Send to ${filteredCount !== null ? filteredCount : customerCount} recipients`}
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
                )
            }

            {/* ═══ TAB 4: Stats ═══ */}
            {
                tab === "stats" && (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                            {[
                                { label: "Total Campaigns", value: campaigns.length, icon: "📢", color: "#2d5a3d" },
                                { label: "Sent", value: campaigns.filter(c => c.status === "sent").length, icon: "✅", color: "#16a34a" },
                                { label: "Drafts", value: campaigns.filter(c => c.status === "draft").length, icon: "📝", color: "#f59e0b" },
                                { label: "Articles", value: articles.length, icon: "📰", color: "#8b5cf6" },
                                { label: "Subscribers", value: customerCount, icon: "👥", color: "#3b82f6" },
                                { label: "Emails Delivered", value: totalSent, icon: "✉️", color: "#64748b" },
                            ].map(stat => (
                                <div key={stat.label} style={{
                                    background: "white", borderRadius: "12px", padding: "20px",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderLeft: `4px solid ${stat.color}`,
                                }}>
                                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>
                                        {stat.icon} {stat.label}
                                    </div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                </div>
                            ))}
                        </div>

                        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Campaign History</h3>
                        {campaigns.filter(c => c.status === "sent").length === 0 ? (
                            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No campaigns sent yet</p>
                        ) : (
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Date</th><th>Subject</th><th>Sent</th><th>Failed</th><th>Coupon</th>
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
                )
            }
        </>
    );
}
