"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

type BlogPost = {
    id: string;
    slug: string;
    is_published: boolean;
    published_at: string | null;
    tags: string[];
    translations: Record<string, { title: string }>;
    created_at: string;
};

export default function AdminBlogPage() {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const loadPosts = async () => {
        const { data } = await supabase
            .from("blog_posts")
            .select("*")
            .order("created_at", { ascending: false });
        setPosts(data || []);
        setLoading(false);
    };

    useEffect(() => { loadPosts(); }, []);

    const togglePublish = async (id: string, current: boolean) => {
        await supabase.from("blog_posts").update({
            is_published: !current,
            published_at: !current ? new Date().toISOString() : null,
        }).eq("id", id);
        loadPosts();
    };

    const deletePost = async (id: string) => {
        if (!confirm("Delete this post?")) return;
        await supabase.from("blog_posts").delete().eq("id", id);
        loadPosts();
    };

    return (
        <div>
            <div className={styles.pageHeader}>
                <h1>Blog Posts</h1>
                <Link href="/admin/blog/editor" className={styles.btn}>
                    + New Post
                </Link>
            </div>

            {loading ? (
                <p>Loading…</p>
            ) : posts.length === 0 ? (
                <p style={{ color: "var(--color-text-light)" }}>No blog posts yet.</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Slug</th>
                            <th>Tags</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map((post) => (
                            <tr key={post.id}>
                                <td>
                                    <strong>{post.translations?.de?.title || post.translations?.en?.title || "Untitled"}</strong>
                                </td>
                                <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{post.slug}</td>
                                <td>
                                    {post.tags?.map((t) => (
                                        <span key={t} style={{
                                            display: "inline-block",
                                            padding: "2px 8px",
                                            margin: "2px",
                                            background: "rgba(45,90,61,0.1)",
                                            borderRadius: "12px",
                                            fontSize: "0.75rem",
                                            color: "var(--color-primary)",
                                        }}>{t}</span>
                                    ))}
                                </td>
                                <td>
                                    <span style={{
                                        padding: "4px 10px",
                                        borderRadius: "12px",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        background: post.is_published ? "#e8f5e9" : "#fff3e0",
                                        color: post.is_published ? "#2e7d32" : "#e65100",
                                    }}>
                                        {post.is_published ? "Published" : "Draft"}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <Link href={`/admin/blog/editor?id=${post.id}`} className={styles.btnSmall}>
                                            Edit
                                        </Link>
                                        <button
                                            className={styles.btnSmall}
                                            onClick={() => togglePublish(post.id, post.is_published)}
                                        >
                                            {post.is_published ? "Unpublish" : "Publish"}
                                        </button>
                                        <button
                                            className={styles.btnSmallDanger}
                                            onClick={() => deletePost(post.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
