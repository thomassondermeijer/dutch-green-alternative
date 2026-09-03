"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { describeReason } from "@/lib/support/reasons";
import adminStyles from "../admin.module.css";
import styles from "./support.module.css";

type View = "open" | "pending" | "closed" | "all" | "spam";

type Ticket = {
    id: string;
    subject: string;
    customer_email: string;
    customer_name: string | null;
    status: string;
    priority: string;
    language: string;
    assignee: string | null;
    is_spam: boolean;
    spam_score: number | null;
    spam_reasons: string[];
    created_at: string;
    updated_at: string;
    message_count: number;
    body_preview: string;
};

type Counts = { all: number; open: number; pending: number; closed: number; spam: number };

const VIEWS: { key: View; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "pending", label: "Pending" },
    { key: "closed", label: "Closed" },
    { key: "all", label: "All" },
    { key: "spam", label: "Spam" },
];

const LANG_FLAGS: Record<string, string> = { de: "🇩🇪", nl: "🇳🇱", en: "🇬🇧" };

function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
}

export default function SupportPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [view, setView] = useState<View>("open");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [working, setWorking] = useState(false);
    const [counts, setCounts] = useState<Counts>({ all: 0, open: 0, pending: 0, closed: 0, spam: 0 });
    const router = useRouter();

    // Debounce typing so each keystroke doesn't hit the server.
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setQuery(search.trim());
            setPage(0);
        }, 300);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [search]);

    const loadTickets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ view, page: String(page) });
            if (query) params.set("q", query);

            const res = await fetch(`/api/admin/support/list?${params}`);
            if (!res.ok) throw new Error(`Request failed (${res.status})`);

            const data = await res.json();
            setTickets(data.tickets || []);
            setCounts(data.counts);
            setTotal(data.total || 0);
            setHasMore(Boolean(data.hasMore));
        } catch (err) {
            console.error("[support] Failed to load tickets:", err);
            setError("Could not load tickets. Reload to try again.");
            setTickets([]);
        }
        setLoading(false);
    }, [view, query, page]);

    useEffect(() => { loadTickets(); }, [loadTickets]);
    useEffect(() => { setSelected(new Set()); }, [view, query, page]);

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const allOnPageSelected = tickets.length > 0 && tickets.every((t) => selected.has(t.id));
    const toggleAll = () => {
        setSelected(allOnPageSelected ? new Set() : new Set(tickets.map((t) => t.id)));
    };

    const runBulk = async (url: string, body: Record<string, unknown>) => {
        if (selected.size === 0) return;
        setWorking(true);
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [...selected], ...body }),
            });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            setSelected(new Set());
            await loadTickets();
        } catch (err) {
            console.error("[support] Bulk action failed:", err);
            setError("That action didn't go through. Try again.");
        }
        setWorking(false);
    };

    return (
        <>
            <div className={adminStyles.pageHeader}>
                <h1 className={adminStyles.pageTitle}>Support Tickets</h1>
            </div>

            <div className={styles.statusTabs}>
                {VIEWS.map((v) => (
                    <button
                        key={v.key}
                        className={`${styles.statusTab} ${view === v.key ? styles.statusTabActive : ""}`}
                        onClick={() => { setView(v.key); setPage(0); }}
                    >
                        {v.label}
                        <span className={styles.ticketCount}>({counts[v.key] ?? 0})</span>
                    </button>
                ))}
            </div>

            <div className={styles.toolbar}>
                <input
                    type="search"
                    className={styles.searchInput}
                    placeholder="Search subject, sender or message text…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {query && (
                    <span className={styles.resultCount}>
                        {total} {total === 1 ? "result" : "results"}
                    </span>
                )}
            </div>

            {selected.size > 0 && (
                <div className={styles.bulkBar}>
                    <span className={styles.bulkCount}>{selected.size} selected</span>
                    <div className={styles.bulkActions}>
                        {view !== "spam" ? (
                            <>
                                <button disabled={working} onClick={() => runBulk("/api/admin/support/update", { status: "closed" })}>Close</button>
                                <button disabled={working} onClick={() => runBulk("/api/admin/support/update", { status: "open" })}>Reopen</button>
                                <button disabled={working} onClick={() => runBulk("/api/admin/support/spam", { spam: true, scope: "sender" })}>Mark as spam</button>
                                <button disabled={working} onClick={() => runBulk("/api/admin/support/spam", { spam: true, scope: "domain" })}>Block domain</button>
                            </>
                        ) : (
                            <button disabled={working} onClick={() => runBulk("/api/admin/support/spam", { spam: false })}>Not spam</button>
                        )}
                        <button className={styles.bulkClear} onClick={() => setSelected(new Set())}>Clear</button>
                    </div>
                </div>
            )}

            {error && <div className={adminStyles.error}>{error}</div>}

            {loading ? (
                <div className={adminStyles.emptyState}>Loading tickets…</div>
            ) : tickets.length === 0 ? (
                <div className={adminStyles.emptyState}>
                    {query ? `No tickets match “${query}”` : view === "spam" ? "Nothing in quarantine" : `No ${view === "all" ? "" : view} tickets`}
                </div>
            ) : (
                <>
                    <table className={adminStyles.table}>
                        <thead>
                            <tr>
                                <th className={styles.checkCell}>
                                    <input
                                        type="checkbox"
                                        checked={allOnPageSelected}
                                        onChange={toggleAll}
                                        aria-label="Select all on this page"
                                    />
                                </th>
                                <th>Status</th>
                                <th>Subject</th>
                                <th>Customer</th>
                                <th>Lang</th>
                                <th>Priority</th>
                                <th>Msgs</th>
                                <th>Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map((ticket) => (
                                <tr
                                    key={ticket.id}
                                    className={styles.ticketRow}
                                    onClick={() => router.push(`/admin/support/${ticket.id}`)}
                                >
                                    <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selected.has(ticket.id)}
                                            onChange={() => toggle(ticket.id)}
                                            aria-label={`Select ${ticket.subject}`}
                                        />
                                    </td>
                                    <td>
                                        <span className={`${adminStyles.badge} ${styles[`status${ticket.status.charAt(0).toUpperCase()}${ticket.status.slice(1)}`]}`}>
                                            {ticket.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.ticketSubject}>{ticket.subject}</div>
                                        {ticket.body_preview && (
                                            <div className={styles.ticketPreview}>{ticket.body_preview}…</div>
                                        )}
                                        {ticket.is_spam && ticket.spam_reasons?.length > 0 && (
                                            <div className={styles.spamReasons}>
                                                {ticket.spam_reasons.slice(0, 2).map((r) => (
                                                    <span key={r} className={styles.spamReason}>{describeReason(r)}</span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div>{ticket.customer_name || "—"}</div>
                                        <div className={styles.ticketEmail}>{ticket.customer_email}</div>
                                        {ticket.assignee && <div className={styles.assigneeTag}>→ {ticket.assignee}</div>}
                                    </td>
                                    <td>
                                        <span className={styles.langBadge}>
                                            {LANG_FLAGS[ticket.language] || "🌐"} {ticket.language.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={styles[`priority${ticket.priority.charAt(0).toUpperCase()}${ticket.priority.slice(1)}`]}>
                                            {ticket.priority}
                                        </span>
                                    </td>
                                    <td><span className={styles.messageCount}>💬 {ticket.message_count}</span></td>
                                    <td><span className={styles.ticketAge}>{timeAgo(ticket.updated_at)}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {(page > 0 || hasMore) && (
                        <div className={styles.pager}>
                            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                                ← Previous
                            </button>
                            <span className={styles.pagerInfo}>
                                {page * 25 + 1}–{Math.min((page + 1) * 25, total)} of {total}
                            </span>
                            <button disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </>
    );
}
