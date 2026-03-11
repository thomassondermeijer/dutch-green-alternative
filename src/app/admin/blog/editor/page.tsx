"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../admin.module.css";

const LOCALES = ["de", "en", "nl"] as const;

function BlogEditorInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const editId = searchParams.get("id");
    const supabase = createClient();

    const [slug, setSlug] = useState("");
    const [featuredImage, setFeaturedImage] = useState("");
    const [tags, setTags] = useState("");
    const [isPublished, setIsPublished] = useState(false);
    const [activeLocale, setActiveLocale] = useState<typeof LOCALES[number]>("de");
    const [translations, setTranslations] = useState<Record<string, { title: string; excerpt: string; content: string }>>({
        de: { title: "", excerpt: "", content: "" },
        en: { title: "", excerpt: "", content: "" },
        nl: { title: "", excerpt: "", content: "" },
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (editId) {
            (async () => {
                const { data } = await supabase
                    .from("blog_posts")
                    .select("*")
                    .eq("id", editId)
                    .single();
                if (data) {
                    setSlug(data.slug || "");
                    setFeaturedImage(data.featured_image || "");
                    setTags((data.tags || []).join(", "));
                    setIsPublished(data.is_published || false);
                    setTranslations({
                        de: { title: "", excerpt: "", content: "", ...data.translations?.de },
                        en: { title: "", excerpt: "", content: "", ...data.translations?.en },
                        nl: { title: "", excerpt: "", content: "", ...data.translations?.nl },
                    });
                }
            })();
        }
    }, [editId]);

    const handleTranslationChange = (field: string, value: string) => {
        setTranslations((prev) => ({
            ...prev,
            [activeLocale]: { ...prev[activeLocale], [field]: value },
        }));
    };

    const autoSlug = () => {
        const title = translations.de.title || translations.en.title;
        const s = title
            .toLowerCase()
            .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        setSlug(s);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);

        const payload = {
            slug,
            featured_image: featuredImage || null,
            tags: tagArray,
            is_published: isPublished,
            published_at: isPublished ? new Date().toISOString() : null,
            translations,
            updated_at: new Date().toISOString(),
        };

        if (editId) {
            const { error } = await supabase.from("blog_posts").update(payload).eq("id", editId);
            if (error) setMessage(`Error: ${error.message}`);
            else setMessage("Post updated!");
        } else {
            const { error } = await supabase.from("blog_posts").insert(payload);
            if (error) setMessage(`Error: ${error.message}`);
            else {
                setMessage("Post created!");
                setTimeout(() => router.push("/admin/blog"), 1000);
            }
        }
        setSaving(false);
    };

    const t = translations[activeLocale];

    return (
        <div>
            <div className={styles.pageHeader}>
                <h1>{editId ? "Edit Post" : "New Post"}</h1>
                <button onClick={() => router.push("/admin/blog")} className={styles.btnSmall}>
                    ← Back
                </button>
            </div>

            <div style={{ display: "grid", gap: "1.5rem", maxWidth: "900px" }}>
                {/* Slug & Image */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.85rem" }}>
                            Slug
                        </label>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="my-blog-post"
                                className={styles.input}
                                style={{ fontFamily: "monospace" }}
                            />
                            <button onClick={autoSlug} className={styles.btnSmall} type="button">Auto</button>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.85rem" }}>
                            Featured Image URL
                        </label>
                        <input
                            value={featuredImage}
                            onChange={(e) => setFeaturedImage(e.target.value)}
                            placeholder="https://..."
                            className={styles.input}
                        />
                    </div>
                </div>

                {/* Tags & Published */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "end" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.85rem" }}>
                            Tags (comma-separated)
                        </label>
                        <input
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="CBD, Gesundheit, Schlaf"
                            className={styles.input}
                        />
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "0.6rem 0" }}>
                        <input
                            type="checkbox"
                            checked={isPublished}
                            onChange={(e) => setIsPublished(e.target.checked)}
                            style={{ width: "18px", height: "18px" }}
                        />
                        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Published</span>
                    </label>
                </div>

                {/* Locale Tabs */}
                <div style={{ display: "flex", gap: "4px", background: "#f5f5f5", borderRadius: "8px", padding: "4px", width: "fit-content" }}>
                    {LOCALES.map((loc) => (
                        <button
                            key={loc}
                            onClick={() => setActiveLocale(loc)}
                            style={{
                                padding: "6px 16px",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                background: activeLocale === loc ? "var(--color-primary)" : "transparent",
                                color: activeLocale === loc ? "white" : "var(--color-text-light)",
                                transition: "all 0.2s",
                            }}
                        >
                            {loc.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Translation Fields */}
                <div style={{ display: "grid", gap: "1rem" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.85rem" }}>
                            Title ({activeLocale.toUpperCase()})
                        </label>
                        <input
                            value={t.title}
                            onChange={(e) => handleTranslationChange("title", e.target.value)}
                            className={styles.input}
                            placeholder="Blog post title..."
                        />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.85rem" }}>
                            Excerpt ({activeLocale.toUpperCase()})
                        </label>
                        <textarea
                            value={t.excerpt}
                            onChange={(e) => handleTranslationChange("excerpt", e.target.value)}
                            className={styles.input}
                            rows={2}
                            placeholder="Short description for card preview..."
                        />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.85rem" }}>
                            Content ({activeLocale.toUpperCase()}) — HTML
                        </label>
                        <textarea
                            value={t.content}
                            onChange={(e) => handleTranslationChange("content", e.target.value)}
                            className={styles.input}
                            rows={20}
                            style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                            placeholder="<h2>Heading</h2><p>Paragraph content...</p>"
                        />
                    </div>
                </div>

                {/* Save */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <button onClick={handleSave} disabled={saving || !slug} className={styles.btn}>
                        {saving ? "Saving…" : editId ? "Update Post" : "Create Post"}
                    </button>
                    {message && <span style={{ fontSize: "0.85rem", color: message.startsWith("Error") ? "red" : "green" }}>{message}</span>}
                </div>
            </div>
        </div>
    );
}

export default function BlogEditorPage() {
    return (
        <Suspense fallback={<div>Loading editor…</div>}>
            <BlogEditorInner />
        </Suspense>
    );
}
