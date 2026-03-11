"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container/Container";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./blog.module.css";

type BlogPost = {
    id: string;
    slug: string;
    featured_image: string | null;
    tags: string[];
    is_published: boolean;
    published_at: string;
    translations: Record<string, { title: string; excerpt: string; content: string }>;
};

type BlogListClientProps = {
    posts: BlogPost[];
    locale: Locale;
    dict: Dictionary;
    allTags: string[];
};

function estimateReadingTime(html: string): number {
    const text = html.replace(/<[^>]*>/g, "");
    const words = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
}

export function BlogListClient({ posts, locale, dict, allTags }: BlogListClientProps) {
    const [activeTag, setActiveTag] = useState<string | null>(null);

    const filtered = activeTag
        ? posts.filter((p) => p.tags?.includes(activeTag))
        : posts;

    return (
        <main className={styles.blogPage}>
            <Container>
                <div className={styles.header}>
                    <h1 className={styles.title}>{dict.blog.title}</h1>
                    <div className={styles.titleLine} />
                    <p className={styles.subtitle}>{dict.blog.subtitle || ""}</p>
                </div>

                {allTags.length > 0 && (
                    <div className={styles.tagFilter}>
                        <button
                            className={`${styles.tagPill} ${!activeTag ? styles.tagPillActive : ""}`}
                            onClick={() => setActiveTag(null)}
                        >
                            {dict.blog.allTags || "All"}
                        </button>
                        {allTags.map((tag) => (
                            <button
                                key={tag}
                                className={`${styles.tagPill} ${activeTag === tag ? styles.tagPillActive : ""}`}
                                onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                )}

                {filtered.length === 0 ? (
                    <div className={styles.empty}>
                        <p className={styles.emptyIcon}>📝</p>
                        <p>{dict.blog.noPosts}</p>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filtered.map((post) => {
                            const t = post.translations[locale] || post.translations.de || { title: "", excerpt: "", content: "" };
                            const readTime = estimateReadingTime(t.content || "");
                            const date = post.published_at
                                ? new Date(post.published_at).toLocaleDateString(locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-US", {
                                    year: "numeric", month: "long", day: "numeric",
                                })
                                : "";

                            return (
                                <Link key={post.id} href={`/${locale}/blog/${post.slug}`} className={styles.card}>
                                    {post.featured_image && (
                                        <div className={styles.cardImage}>
                                            <Image
                                                src={post.featured_image}
                                                alt={t.title}
                                                fill
                                                style={{ objectFit: "cover" }}
                                                sizes="(max-width: 768px) 100vw, 50vw"
                                            />
                                        </div>
                                    )}
                                    <div className={styles.cardBody}>
                                        {post.tags?.length > 0 && (
                                            <div className={styles.cardTags}>
                                                {post.tags.slice(0, 3).map((tag) => (
                                                    <span key={tag} className={styles.cardTag}>{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                        <h2 className={styles.cardTitle}>{t.title}</h2>
                                        <p className={styles.cardExcerpt}>{t.excerpt}</p>
                                        <div className={styles.cardMeta}>
                                            <span>{date}</span>
                                            <span className={styles.readMore}>
                                                {dict.blog.readMore} →
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </Container>
        </main>
    );
}
