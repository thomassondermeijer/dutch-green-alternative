"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import styles from "./dashboard.module.css";
import adminStyles from "./admin.module.css";

// ─── Types ───
type Period = "7d" | "30d" | "90d" | "all" | "custom";
type KPI = { label: string; value: string; change: number | null; prefix?: string };
type ChartPoint = { label: string; revenue: number; orders: number };
type ProductRow = { name: string; quantity: number; revenue: number };
type CountryRow = { country: string; count: number; pct: number };
type PaymentRow = { method: string; count: number; pct: number };
type LTVRow = { email: string; name: string; total: number; orders: number };
type CouponRow = { code: string; uses: number; revenue: number };

type FeedItem = {
    id: string;
    type: "order" | "ticket" | "campaign" | "bounce";
    text: string;
    time: string;
    icon: string;
    iconBg: string;
};

type QuickStats = {
    todayRevenue: number;
    todayOrders: number;
    openTickets: number;
    activeCampaigns: number;
    recentBounces: number;
};

type ActionItem = {
    id: string;
    type: "urgent" | "warning" | "info";
    icon: string;
    title: string;
    desc: string;
    count: number;
    href: string;
};

const COLORS = ["#2d5a3d", "#6fcf97", "#34d399", "#a3e635", "#fbbf24", "#f97316", "#ef4444", "#8b5cf6"];
const PAYMENT_COLORS: Record<string, string> = {
    ideal: "#CC0066", creditcard: "#1a1a2e", invoice: "#f59e0b", paypal: "#003087",
    giropay: "#003a7d", sofort: "#ef6c00", klarna: "#ffb3c7", bancontact: "#005498",
    other: "#94a3b8",
};

function periodDays(p: Period): number | null {
    return p === "7d" ? 7 : p === "30d" ? 30 : p === "90d" ? 90 : null;
}

function fmtCurrency(n: number): string {
    if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
    return `€${n.toFixed(0)}`;
}

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
}

export default function AdminDashboard() {
    const [period, setPeriod] = useState<Period>("30d");
    const [customFrom, setCustomFrom] = useState(() => {
        const d = new Date(); d.setDate(1);
        return d.toISOString().split("T")[0];
    });
    const [customTo, setCustomTo] = useState(() => new Date().toISOString().split("T")[0]);
    const [loading, setLoading] = useState(true);

    // Activity Hub
    const [quickStats, setQuickStats] = useState<QuickStats>({ todayRevenue: 0, todayOrders: 0, openTickets: 0, activeCampaigns: 0, recentBounces: 0 });
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

    // KPIs
    const [kpis, setKpis] = useState<KPI[]>([]);
    // Charts
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    // Tier 2
    const [topProducts, setTopProducts] = useState<ProductRow[]>([]);
    const [countries, setCountries] = useState<CountryRow[]>([]);
    const [payments, setPayments] = useState<PaymentRow[]>([]);
    const [repeatRate, setRepeatRate] = useState<{ first: number; repeat: number } | null>(null);
    // Tier 3
    const [categoryRevenue, setCategoryRevenue] = useState<{ name: string; value: number }[]>([]);
    const [topLTV, setTopLTV] = useState<LTVRow[]>([]);
    const [couponReport, setCouponReport] = useState<CouponRow[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const days = periodDays(period);

        let since: string | null = null;
        let until: string | null = null;
        let prevSince: string | null = null;
        let prevUntil: string | null = null;

        if (period === "custom") {
            since = new Date(customFrom + "T00:00:00").toISOString();
            until = new Date(customTo + "T23:59:59").toISOString();
            const duration = new Date(customTo).getTime() - new Date(customFrom).getTime();
            prevSince = new Date(new Date(customFrom).getTime() - duration).toISOString();
            prevUntil = since;
        } else if (days) {
            since = new Date(Date.now() - days * 86400000).toISOString();
            prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString();
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // ═══ ACTIVITY HUB DATA ═══
        const [ticketsRes, campaignsRes, bouncesRes, recentOrdersRes] = await Promise.all([
            supabase.from("support_tickets").select("id, subject, customer_email, customer_name, status, created_at").in("status", ["open", "pending"]).order("created_at", { ascending: false }).limit(20),
            supabase.from("marketing_campaigns").select("id, name, status, subject, created_at").in("status", ["sending", "scheduled"]),
            supabase.from("email_suppression").select("id, email, reason, created_at").order("created_at", { ascending: false }).limit(10),
            supabase.from("orders").select("id, total, status, payment_status, customer_email, created_at, shipping_address").order("created_at", { ascending: false }).limit(15),
        ]);

        const openTickets = ticketsRes.data || [];
        const activeCampaigns = campaignsRes.data || [];
        const recentBounces = bouncesRes.data || [];
        const recentOrders = recentOrdersRes.data || [];

        // Today's stats
        const todayOrders = recentOrders.filter(o => new Date(o.created_at) >= todayStart);
        const todayRevenue = todayOrders.filter(o => o.payment_status === "paid" || o.status === "delivered").reduce((s, o) => s + Number(o.total || 0), 0);
        const last24hBounces = recentBounces.filter(b => Date.now() - new Date(b.created_at).getTime() < 86400000);

        setQuickStats({
            todayRevenue,
            todayOrders: todayOrders.length,
            openTickets: openTickets.length,
            activeCampaigns: activeCampaigns.length,
            recentBounces: last24hBounces.length,
        });

        // Action items
        const actions: ActionItem[] = [];
        if (openTickets.length > 0) {
            actions.push({
                id: "tickets", type: "urgent", icon: "🎫",
                title: `${openTickets.length} open support ticket${openTickets.length > 1 ? "s" : ""}`,
                desc: openTickets[0]?.subject || "Customer needs a reply",
                count: openTickets.length, href: "/admin/support",
            });
        }
        if (activeCampaigns.filter(c => c.status === "sending").length > 0) {
            const sending = activeCampaigns.filter(c => c.status === "sending");
            actions.push({
                id: "campaigns", type: "info", icon: "📢",
                title: `Campaign in progress`,
                desc: sending[0]?.name || "Sending in daily batches",
                count: sending.length, href: "/admin/marketing",
            });
        }
        if (last24hBounces.length > 0) {
            actions.push({
                id: "bounces", type: "warning", icon: "⚠️",
                title: `${last24hBounces.length} bounced email${last24hBounces.length > 1 ? "s" : ""} today`,
                desc: "Check email suppression list",
                count: last24hBounces.length, href: "/admin/marketing",
            });
        }
        setActionItems(actions);

        // Activity feed
        const feed: FeedItem[] = [];
        for (const o of recentOrders.slice(0, 8)) {
            const addr = o.shipping_address as { first_name?: string; last_name?: string } | null;
            const name = addr ? `${addr.first_name || ""} ${addr.last_name || ""}`.trim() : o.customer_email;
            feed.push({
                id: `order-${o.id}`,
                type: "order",
                text: `<strong>${name}</strong> placed an order for <strong>€${Number(o.total || 0).toFixed(2)}</strong>`,
                time: o.created_at,
                icon: "🛒",
                iconBg: "#dcfce7",
            });
        }
        for (const t of openTickets.slice(0, 4)) {
            feed.push({
                id: `ticket-${t.id}`,
                type: "ticket",
                text: `<strong>${t.customer_name || t.customer_email}</strong> — ${t.subject}`,
                time: t.created_at,
                icon: "🎫",
                iconBg: "#fef2f2",
            });
        }
        for (const c of activeCampaigns) {
            feed.push({
                id: `campaign-${c.id}`,
                type: "campaign",
                text: `Campaign <strong>${c.name}</strong> is ${c.status}`,
                time: c.created_at,
                icon: "📢",
                iconBg: "#dbeafe",
            });
        }
        feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setFeedItems(feed.slice(0, 12));

        // ─── Fetch all orders ───
        let query = supabase.from("orders").select("id, total, status, payment_status, payment_method, customer_email, coupon_code, created_at, shipping_address, discount_amount");
        if (since) query = query.gte("created_at", since);
        if (until) query = query.lte("created_at", until);
        const { data: orders } = await query.order("created_at", { ascending: true });
        const allOrders = orders || [];

        // Previous period for comparison
        let prevOrders: { id: string; total: number; payment_status: string; customer_email: string; created_at: string; status?: string }[] = [];
        if (prevSince && (prevUntil || since)) {
            const { data } = await supabase.from("orders").select("id, total, payment_status, customer_email, created_at, status")
                .gte("created_at", prevSince).lt("created_at", prevUntil || since);
            prevOrders = (data || []) as typeof prevOrders;
        }

        // ─── KPIs ───
        const paidOrders = allOrders.filter(o => o.payment_status === "paid" || o.status === "delivered");
        const revenue = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
        const orderCount = allOrders.length;
        const aov = orderCount > 0 ? revenue / paidOrders.length : 0;
        const uniqueCustomers = new Set(allOrders.map(o => o.customer_email)).size;

        const prevPaid = prevOrders.filter(o => o.payment_status === "paid" || o.status === "delivered");
        const prevRevenue = prevPaid.reduce((s, o) => s + Number(o.total || 0), 0);
        const prevCount = prevOrders.length;
        const prevAov = prevCount > 0 ? prevRevenue / prevPaid.length : 0;
        const prevUniqueCustomers = new Set(prevOrders.map(o => o.customer_email)).size;

        const pctChange = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

        setKpis([
            { label: "Revenue", value: fmtCurrency(revenue), change: pctChange(revenue, prevRevenue), prefix: "" },
            { label: "Orders", value: orderCount.toString(), change: pctChange(orderCount, prevCount) },
            { label: "Avg. Order Value", value: `€${aov.toFixed(2)}`, change: pctChange(aov, prevAov) },
            { label: "Customers", value: uniqueCustomers.toString(), change: pctChange(uniqueCustomers, prevUniqueCustomers) },
        ]);

        // ─── Revenue/Orders Chart ───
        const rangeLen = period === "custom"
            ? Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000)
            : days;
        const buckets = new Map<string, { revenue: number; orders: number }>();
        for (const o of allOrders) {
            const d = new Date(o.created_at);
            const key = rangeLen && rangeLen <= 30
                ? `${d.getMonth() + 1}/${d.getDate()}`
                : rangeLen && rangeLen <= 90
                    ? `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString("default", { month: "short" })}`
                    : `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear().toString().slice(-2)}`;
            const b = buckets.get(key) || { revenue: 0, orders: 0 };
            b.revenue += (o.payment_status === "paid" || o.status === "delivered") ? Number(o.total || 0) : 0;
            b.orders += 1;
            buckets.set(key, b);
        }
        setChartData(Array.from(buckets, ([label, v]) => ({ label, revenue: Math.round(v.revenue * 100) / 100, orders: v.orders })));

        // ─── Top Products ───
        const { data: items } = await supabase.from("order_items").select("product_name, quantity, total_price, order_id");
        const validOrderIds = new Set(allOrders.map(o => o.id));
        const productMap = new Map<string, { quantity: number; revenue: number }>();
        for (const item of (items || [])) {
            if (!validOrderIds.has(item.order_id)) continue;
            const name = item.product_name;
            const p = productMap.get(name) || { quantity: 0, revenue: 0 };
            p.quantity += Number(item.quantity || 0);
            p.revenue += Number(item.total_price || 0);
            productMap.set(name, p);
        }
        setTopProducts(
            Array.from(productMap, ([name, v]) => ({ name, ...v }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 8)
        );

        // ─── Countries ───
        const countryMap = new Map<string, number>();
        for (const o of allOrders) {
            const c = (o.shipping_address as { country?: string })?.country || "Unknown";
            countryMap.set(c, (countryMap.get(c) || 0) + 1);
        }
        const totalCountry = allOrders.length;
        setCountries(
            Array.from(countryMap, ([country, count]) => ({ country, count, pct: Math.round((count / totalCountry) * 100) }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8)
        );

        // ─── Payment Methods ───
        const pmMap = new Map<string, number>();
        for (const o of allOrders) {
            const m = o.payment_method || "other";
            pmMap.set(m, (pmMap.get(m) || 0) + 1);
        }
        const totalPm = allOrders.length;
        setPayments(
            Array.from(pmMap, ([method, count]) => ({ method, count, pct: Math.round((count / totalPm) * 100) }))
                .sort((a, b) => b.count - a.count)
        );

        // ─── Repeat vs First-time ───
        const { data: allOrdersForRepeat } = await supabase.from("orders").select("customer_email");
        const emailCounts = new Map<string, number>();
        for (const o of (allOrdersForRepeat || [])) {
            emailCounts.set(o.customer_email, (emailCounts.get(o.customer_email) || 0) + 1);
        }
        let firstTime = 0, repeat = 0;
        for (const count of emailCounts.values()) {
            if (count === 1) firstTime++;
            else repeat++;
        }
        setRepeatRate({ first: firstTime, repeat });

        // ─── Tier 3: Revenue by Category ───
        const { data: products } = await supabase.from("products").select("id, category");
        const productCategoryMap = new Map<string, string>();
        for (const p of (products || [])) {
            productCategoryMap.set(p.id, p.category === "raw" ? "RAW" : "Pure Formula+");
        }
        const catRevMap = new Map<string, number>();
        for (const item of (items || [])) {
            if (!validOrderIds.has(item.order_id)) continue;
            const cat = productCategoryMap.get(item.product_name) || "Other"; // fallback
            // Need product_id on items — use a different approach
        }
        // Actually build from order_items with product lookup
        const { data: itemsWithProduct } = await supabase.from("order_items").select("product_id, total_price, order_id");
        const catRev = new Map<string, number>();
        for (const item of (itemsWithProduct || [])) {
            if (!validOrderIds.has(item.order_id)) continue;
            const cat = item.product_id ? (productCategoryMap.get(item.product_id) || "Other") : "Other";
            catRev.set(cat, (catRev.get(cat) || 0) + Number(item.total_price || 0));
        }
        setCategoryRevenue(Array.from(catRev, ([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value));

        // ─── Tier 3: Customer LTV ───
        const ltvMap = new Map<string, { total: number; orders: number; name: string }>();
        for (const o of (allOrdersForRepeat || []) as Array<{ customer_email: string; total?: number; status?: string; shipping_address?: { first_name?: string; last_name?: string } }>) {
            // Need more data — re-fetch
        }
        const { data: allOrdersFull } = await supabase.from("orders").select("customer_email, total, payment_status, status, shipping_address").eq("payment_status", "paid");
        for (const o of (allOrdersFull || [])) {
            const email = o.customer_email;
            const l = ltvMap.get(email) || { total: 0, orders: 0, name: "" };
            l.total += Number(o.total || 0);
            l.orders += 1;
            if (!l.name && o.shipping_address) {
                const addr = o.shipping_address as { first_name?: string; last_name?: string };
                l.name = `${addr.first_name || ""} ${addr.last_name || ""}`.trim();
            }
            ltvMap.set(email, l);
        }
        setTopLTV(
            Array.from(ltvMap, ([email, v]) => ({ email, name: v.name, total: Math.round(v.total * 100) / 100, orders: v.orders }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10)
        );

        // ─── Tier 3: Coupon Report ───
        const couponMap = new Map<string, { uses: number; revenue: number }>();
        for (const o of allOrders) {
            if (o.coupon_code) {
                const c = couponMap.get(o.coupon_code) || { uses: 0, revenue: 0 };
                c.uses += 1;
                c.revenue += Number(o.total || 0);
                couponMap.set(o.coupon_code, c);
            }
        }
        setCouponReport(
            Array.from(couponMap, ([code, v]) => ({ code, ...v }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)
        );

        setLoading(false);
    }, [period, customFrom, customTo]);

    useEffect(() => { loadData(); }, [loadData]);

    if (loading) {
        return (
            <>
                <div className={adminStyles.pageHeader}>
                    <h1 className={adminStyles.pageTitle}>Dashboard</h1>
                </div>
                <div className={styles.dashboardLoading}>Loading analytics...</div>
            </>
        );
    }

    return (
        <>
            <div className={adminStyles.pageHeader}>
                <h1 className={adminStyles.pageTitle}>Dashboard</h1>
                <div className={styles.periodControls}>
                    <div className={styles.periodSelector}>
                        {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
                            <button
                                key={p}
                                className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ""}`}
                                onClick={() => setPeriod(p)}
                            >
                                {p === "all" ? "All Time" : p}
                            </button>
                        ))}
                        <button
                            className={`${styles.periodBtn} ${period === "custom" ? styles.periodBtnActive : ""}`}
                            onClick={() => setPeriod("custom")}
                        >
                            📅 Custom
                        </button>
                    </div>
                    {period === "custom" && (
                        <div className={styles.customDateRange}>
                            <input
                                type="date"
                                className={styles.dateInput}
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                max={customTo}
                            />
                            <span className={styles.dateRangeSep}>→</span>
                            <input
                                type="date"
                                className={styles.dateInput}
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                min={customFrom}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.dashboard}>
                {/* ═══ Activity Hub ═══ */}
                <div className={styles.activityHub}>
                    {/* Quick Stats Strip */}
                    <div className={styles.quickStats}>
                        <div className={styles.quickStat}>
                            <div className={styles.quickStatIcon} style={{ background: "#dcfce7" }}>💰</div>
                            <div className={styles.quickStatInfo}>
                                <span className={styles.quickStatValue}>€{quickStats.todayRevenue.toFixed(0)}</span>
                                <span className={styles.quickStatLabel}>Today&apos;s Revenue</span>
                            </div>
                        </div>
                        <div className={styles.quickStat}>
                            <div className={styles.quickStatIcon} style={{ background: "#dbeafe" }}>📦</div>
                            <div className={styles.quickStatInfo}>
                                <span className={styles.quickStatValue}>{quickStats.todayOrders}</span>
                                <span className={styles.quickStatLabel}>Orders Today</span>
                            </div>
                        </div>
                        <div className={styles.quickStat}>
                            <div className={styles.quickStatIcon} style={{ background: quickStats.openTickets > 0 ? "#fef2f2" : "#f0fdf4" }}>
                                🎫
                            </div>
                            <div className={styles.quickStatInfo}>
                                <span className={styles.quickStatValue} style={quickStats.openTickets > 0 ? { color: "#dc2626" } : undefined}>
                                    {quickStats.openTickets}
                                </span>
                                <span className={styles.quickStatLabel}>Open Tickets</span>
                            </div>
                        </div>
                        <div className={styles.quickStat}>
                            <div className={styles.quickStatIcon} style={{ background: "#ede9fe" }}>📢</div>
                            <div className={styles.quickStatInfo}>
                                <span className={styles.quickStatValue}>{quickStats.activeCampaigns}</span>
                                <span className={styles.quickStatLabel}>Active Campaigns</span>
                            </div>
                        </div>
                        <div className={styles.quickStat}>
                            <div className={styles.quickStatIcon} style={{ background: quickStats.recentBounces > 0 ? "#fef3c7" : "#f0fdf4" }}>
                                {quickStats.recentBounces > 0 ? "⚠️" : "✅"}
                            </div>
                            <div className={styles.quickStatInfo}>
                                <span className={styles.quickStatValue} style={quickStats.recentBounces > 0 ? { color: "#d97706" } : undefined}>
                                    {quickStats.recentBounces}
                                </span>
                                <span className={styles.quickStatLabel}>Bounces (24h)</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Required */}
                    <div className={styles.actionCards}>
                        {actionItems.length === 0 ? (
                            <div className={styles.actionCardEmpty}>✅ All clear — nothing needs attention</div>
                        ) : (
                            actionItems.map((item) => (
                                <a
                                    key={item.id}
                                    href={item.href}
                                    className={`${styles.actionCard} ${
                                        item.type === "urgent" ? styles.actionCardUrgent
                                        : item.type === "warning" ? styles.actionCardWarning
                                        : styles.actionCardInfo
                                    }`}
                                >
                                    <div className={styles.actionCardIcon}>{item.icon}</div>
                                    <div className={styles.actionCardBody}>
                                        <div className={styles.actionCardTitle}>{item.title}</div>
                                        <div className={styles.actionCardDesc}>{item.desc}</div>
                                    </div>
                                    <div
                                        className={styles.actionCardBadge}
                                        style={{
                                            color: item.type === "urgent" ? "#dc2626"
                                                 : item.type === "warning" ? "#d97706"
                                                 : "#2563eb"
                                        }}
                                    >
                                        {item.count}
                                    </div>
                                </a>
                            ))
                        )}
                    </div>

                    {/* Live Activity Feed */}
                    <div className={styles.feedCard}>
                        <div className={styles.feedHeader}>
                            <div className={styles.feedTitle}>
                                <span className={styles.liveDot} />
                                Activity Feed
                            </div>
                        </div>
                        <div className={styles.feedList}>
                            {feedItems.length === 0 ? (
                                <div className={styles.feedEmpty}>No recent activity</div>
                            ) : (
                                feedItems.map((item) => (
                                    <div key={item.id} className={styles.feedItem}>
                                        <div className={styles.feedIcon} style={{ background: item.iconBg }}>
                                            {item.icon}
                                        </div>
                                        <div className={styles.feedContent}>
                                            <div
                                                className={styles.feedText}
                                                dangerouslySetInnerHTML={{ __html: item.text }}
                                            />
                                            <div className={styles.feedTime}>{relativeTime(item.time)}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ═══ KPI Cards ═══ */}
                <div className={styles.kpiGrid}>
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className={styles.kpiCard}>
                            <div className={styles.kpiLabel}>{kpi.label}</div>
                            <div className={styles.kpiValueRow}>
                                <span className={styles.kpiValue}>{kpi.value}</span>
                                {kpi.change !== null && (
                                    <span className={`${styles.kpiChange} ${kpi.change > 0 ? styles.kpiUp : kpi.change < 0 ? styles.kpiDown : styles.kpiNeutral}`}>
                                        {kpi.change > 0 ? "↑" : kpi.change < 0 ? "↓" : "→"} {Math.abs(kpi.change)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ═══ Revenue + Orders Charts ═══ */}
                <div className={styles.chartRow}>
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Revenue Over Time</div>
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2d5a3d" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#2d5a3d" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `€${v}`} />
                                <Tooltip formatter={(v) => [`€${Number(v).toFixed(2)}`, "Revenue"]} />
                                <Area type="monotone" dataKey="revenue" stroke="#2d5a3d" strokeWidth={2} fill="url(#revGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Orders</div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <Tooltip />
                                <Bar dataKey="orders" fill="#6fcf97" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ═══ Tier 2: Product & Customer Insights ═══ */}
                <div className={styles.insightsGrid}>
                    {/* Top Products */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Top Products</div>
                        <table className={styles.miniTable}>
                            <thead>
                                <tr><th>Product</th><th>Qty</th><th>Revenue</th></tr>
                            </thead>
                            <tbody>
                                {topProducts.map((p, i) => (
                                    <tr key={p.name}>
                                        <td>
                                            <span className={`${styles.rankBadge} ${i === 0 ? styles.rank1 : i === 1 ? styles.rank2 : i === 2 ? styles.rank3 : styles.rankOther}`}>
                                                {i + 1}
                                            </span>
                                            {p.name}
                                        </td>
                                        <td>{p.quantity}</td>
                                        <td>€{p.revenue.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Countries */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Orders by Country</div>
                        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                            <ResponsiveContainer width={140} height={140}>
                                <PieChart>
                                    <Pie data={countries} dataKey="count" nameKey="country" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2}>
                                        {countries.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v, name) => [`${v} orders`, name]} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ flex: 1 }}>
                                {countries.map((c, i) => (
                                    <div key={c.country} className={styles.statBar}>
                                        <span className={styles.statBarLabel}>
                                            <span className={styles.legendDot} style={{ background: COLORS[i % COLORS.length], display: "inline-block", marginRight: 6 }} />
                                            {c.country}
                                        </span>
                                        <div className={styles.statBarTrack}>
                                            <div className={styles.statBarFill} style={{ width: `${c.pct}%`, background: COLORS[i % COLORS.length] }} />
                                        </div>
                                        <span className={styles.statBarValue}>{c.pct}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Payment Methods</div>
                        {payments.map((p) => (
                            <div key={p.method} className={styles.statBar}>
                                <span className={styles.statBarLabel}>{p.method}</span>
                                <div className={styles.statBarTrack}>
                                    <div className={styles.statBarFill} style={{ width: `${p.pct}%`, background: PAYMENT_COLORS[p.method] || "#94a3b8" }} />
                                </div>
                                <span className={styles.statBarValue}>{p.count} ({p.pct}%)</span>
                            </div>
                        ))}
                    </div>

                    {/* Repeat vs First-Time */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Customer Retention</div>
                        {repeatRate && (
                            <>
                                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                                    <ResponsiveContainer width={140} height={140}>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: "First-time", value: repeatRate.first },
                                                    { name: "Repeat", value: repeatRate.repeat },
                                                ]}
                                                dataKey="value"
                                                cx="50%" cy="50%"
                                                innerRadius={35} outerRadius={65}
                                                paddingAngle={3}
                                            >
                                                <Cell fill="#94a3b8" />
                                                <Cell fill="#2d5a3d" />
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ flex: 1 }}>
                                        <div className={styles.statBar}>
                                            <span className={styles.statBarLabel}>
                                                <span className={styles.legendDot} style={{ background: "#2d5a3d", display: "inline-block", marginRight: 6 }} />
                                                Repeat
                                            </span>
                                            <span className={styles.statBarValue} style={{ fontWeight: 700, fontSize: "1.1rem" }}>{repeatRate.repeat}</span>
                                        </div>
                                        <div className={styles.statBar}>
                                            <span className={styles.statBarLabel}>
                                                <span className={styles.legendDot} style={{ background: "#94a3b8", display: "inline-block", marginRight: 6 }} />
                                                First-time
                                            </span>
                                            <span className={styles.statBarValue} style={{ fontWeight: 700, fontSize: "1.1rem" }}>{repeatRate.first}</span>
                                        </div>
                                        <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#64748b" }}>
                                            Repeat rate: <strong>{Math.round((repeatRate.repeat / (repeatRate.first + repeatRate.repeat)) * 100)}%</strong>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ═══ Tier 3: Advanced ═══ */}
                <div className={styles.insightsGrid}>
                    {/* Revenue by Category */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Revenue by Category</div>
                        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                            <ResponsiveContainer width={140} height={140}>
                                <PieChart>
                                    <Pie data={categoryRevenue} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                                        <Cell fill="#2d5a3d" />
                                        <Cell fill="#6fcf97" />
                                        <Cell fill="#94a3b8" />
                                    </Pie>
                                    <Tooltip formatter={(v) => [`€${Number(v).toFixed(2)}`, "Revenue"]} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ flex: 1 }}>
                                {categoryRevenue.map((c, i) => (
                                    <div key={c.name} className={styles.statBar}>
                                        <span className={styles.statBarLabel}>
                                            <span className={styles.legendDot} style={{ background: ["#2d5a3d", "#6fcf97", "#94a3b8"][i], display: "inline-block", marginRight: 6 }} />
                                            {c.name}
                                        </span>
                                        <span className={styles.statBarValue}>€{c.value.toFixed(0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Coupon Report */}
                    <div className={styles.chartCard}>
                        <div className={styles.chartTitle}>Coupon Performance</div>
                        {couponReport.length === 0 ? (
                            <div style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "1rem 0" }}>No coupons used in this period</div>
                        ) : (
                            <table className={styles.miniTable}>
                                <thead>
                                    <tr><th>Code</th><th>Uses</th><th>Revenue</th></tr>
                                </thead>
                                <tbody>
                                    {couponReport.map((c) => (
                                        <tr key={c.code}>
                                            <td><code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: "0.8rem" }}>{c.code}</code></td>
                                            <td>{c.uses}</td>
                                            <td>€{c.revenue.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Customer LTV */}
                <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>Top Customers by Lifetime Value</div>
                    <table className={styles.miniTable}>
                        <thead>
                            <tr><th>Customer</th><th>Email</th><th>Orders</th><th>LTV</th></tr>
                        </thead>
                        <tbody>
                            {topLTV.map((c, i) => (
                                <tr key={c.email}>
                                    <td>
                                        <span className={`${styles.rankBadge} ${i === 0 ? styles.rank1 : i === 1 ? styles.rank2 : i === 2 ? styles.rank3 : styles.rankOther}`}>
                                            {i + 1}
                                        </span>
                                        {c.name || "—"}
                                    </td>
                                    <td style={{ color: "#64748b" }}>{c.email}</td>
                                    <td>{c.orders}</td>
                                    <td style={{ fontWeight: 700 }}>€{c.total.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
