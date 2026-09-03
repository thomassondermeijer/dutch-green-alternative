/** Turn a reason code from the spam cascade into something readable. */
export function describeReason(reason: string): string {
    if (reason.startsWith("llm_")) {
        const [category, ...rest] = reason.slice(4).split(":");
        const label = category.replace(/_/g, " ");
        return rest.length ? `${label} —${rest.join(":")}` : label;
    }
    if (reason.startsWith("spamassassin_")) return `SpamAssassin ${reason.slice(13)}`;
    if (reason.startsWith("manual_by_")) return `marked by ${reason.slice(10)}`;
    if (reason.startsWith("released_by_")) return `released by ${reason.slice(12)}`;
    const map: Record<string, string> = {
        auto_submitted: "automated sender",
        bulk_precedence: "bulk mail",
        auto_response_suppress: "auto-responder",
        bulk_mailing_list: "mailing list",
        autoresponder: "auto-responder",
        null_return_path: "bounce",
        bounce_dsn: "delivery failure",
        noreply_sender: "no-reply address",
        mail_loop_own_domain: "mail loop",
        subject_loop_nesting: "reply loop",
        upstream_spam_flag: "flagged upstream",
        dmarc_fail: "DMARC fail",
        spf_fail: "SPF fail",
        dkim_fail: "DKIM fail",
        blocklist_sender: "blocked sender",
        blocklist_domain: "blocked domain",
        allowlisted_customer: "known customer",
        cross_tenant: "other business",
        clean: "clean",
    };
    return map[reason] || reason.replace(/_/g, " ");
}
