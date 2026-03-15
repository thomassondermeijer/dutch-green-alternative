"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import adminStyles from "../admin.module.css";
import styles from "./support.module.css";

type StatusFilter = "all" | "open" | "pending" | "closed";

type Ticket = {
    id: string;
    subject: string;
    customer_email: string;
    customer_name: string | null;
    status: string;
    priority: string;
    language: string;
    created_at: string;
    updated_at: string;
    message_count: number;
};

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
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState<Record<string, number>>({ all: 0, open: 0, pending: 0, closed: 0 });
    const router = useRouter();

    const loadTickets = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();

        // Fetch tickets
        let query = supabase
            .from("support_tickets")
            .select("*")
            .order("updated_at", { ascending: false });

        if (filter !== "all") {
            query = query.eq("status", filter);
        }

        const { data: ticketData } = await query;
        const allTickets = ticketData || [];

        // Get message counts per ticket
        const ticketIds = allTickets.map((t) => t.id);
        let messageCounts: Record<string, number> = {};
        if (ticketIds.length > 0) {
            const { data: messages } = await supabase
                .from("ticket_messages")
                .select("ticket_id")
                .in("ticket_id", ticketIds);

            for (const m of messages || []) {
                messageCounts[m.ticket_id] = (messageCounts[m.ticket_id] || 0) + 1;
            }
        }

        const enriched: Ticket[] = allTickets.map((t) => ({
            ...t,
            message_count: messageCounts[t.id] || 0,
        }));

        setTickets(enriched);

        // Get counts for all statuses
        const { count: allCount } = await supabase.from("support_tickets").select("id", { count: "exact", head: true });
        const { count: openCount } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open");
        const { count: pendingCount } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "pending");
        const { count: closedCount } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "closed");

        setCounts({
            all: allCount || 0,
            open: openCount || 0,
            pending: pendingCount || 0,
            closed: closedCount || 0,
        });

        setLoading(false);
    }, [filter]);

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    return (
        <>
            <div className={adminStyles.pageHeader}>
                <h1 className={adminStyles.pageTitle}>Support Tickets</h1>
            </div>

            {/* Filter Tabs */}
            <div className={styles.statusTabs}>
                {(["all", "open", "pending", "closed"] as StatusFilter[]).map((s) => (
                    <button
                        key={s}
                        className={`${styles.statusTab} ${filter === s ? styles.statusTabActive : ""}`}
                        onClick={() => setFilter(s)}
                    >
                        {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                        <span className={styles.ticketCount}>({counts[s] || 0})</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className={adminStyles.emptyState}>Loading tickets...</div>
            ) : tickets.length === 0 ? (
                <div className={adminStyles.emptyState}>
                    No {filter !== "all" ? filter : ""} tickets found
                </div>
            ) : (
                <table className={adminStyles.table}>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Subject</th>
                            <th>Customer</th>
                            <th>Lang</th>
                            <th>Priority</th>
                            <th>Messages</th>
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
                                <td>
                                    <span className={`${adminStyles.badge} ${styles[`status${ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}`]}`}>
                                        {ticket.status}
                                    </span>
                                </td>
                                <td>
                                    <div className={styles.ticketSubject}>{ticket.subject}</div>
                                </td>
                                <td>
                                    <div>{ticket.customer_name || "—"}</div>
                                    <div className={styles.ticketEmail}>{ticket.customer_email}</div>
                                </td>
                                <td>
                                    <span className={styles.langBadge}>
                                        {LANG_FLAGS[ticket.language] || "🌐"} {ticket.language.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    <span className={styles[`priority${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}`]}>
                                        {ticket.priority}
                                    </span>
                                </td>
                                <td>
                                    <span className={styles.messageCount}>💬 {ticket.message_count}</span>
                                </td>
                                <td>
                                    <span className={styles.ticketAge}>{timeAgo(ticket.updated_at)}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </>
    );
}
