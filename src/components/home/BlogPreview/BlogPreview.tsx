"use client";

import { Container } from "@/components/ui/Container/Container";
import { useScrollReveal } from "@/lib/animations/scroll-animations";
import Image from "next/image";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import styles from "./BlogPreview.module.css";

type BlogPost = {
    slug: string;
    featured_image: string | null;
    tags: string[];
    translations: Record<string, { title: string; excerpt: string }>;
};

type BlogPreviewProps = {
    locale: Locale;
    dict: Dictionary;
    posts: BlogPost[];
};

export function BlogPreview({ locale, dict, posts }: BlogPreviewProps) {
    const [sectionRef, isVisible] = useScrollReveal<HTMLElement>();

    if (!posts || posts.length === 0) return null;

    return (
        <section className={styles.section} ref={sectionRef}>
            <Container>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{dict.home.blogTitle}</h2>
                    <div className={styles.sectionLine} />
                </div>

                <div className={styles.grid}>
                    {posts.map((post) => {
                        const t = post.translations?.[locale] || post.translations?.de || post.translations?.en;
                        if (!t) return null;

                        return (
                            <a
                                key={post.slug}
                                href={`/${locale}/blog/${post.slug}`}
                                className={`${styles.card} ${isVisible ? styles.visible : ""}`}
                            >
                                <div className={styles.cardImage}>
                                    {post.featured_image ? (
                                        <Image
                                            src={post.featured_image}
                                            alt={t.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 33vw"
                                            style={{ objectFit: "cover" }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "2.5rem",
                                            }}
                                        >
                                            📖
                                        </div>
                                    )}
                                </div>
                                <div className={styles.cardBody}>
                                    {post.tags?.[0] && (
                                        <span className={styles.cardTag}>{post.tags[0]}</span>
                                    )}
                                    <h3 className={styles.cardTitle}>{t.title}</h3>
                                    <p className={styles.cardExcerpt}>{t.excerpt}</p>
                                    <span className={styles.readMore}>
                                        {dict.blog.readMore} →
                                    </span>
                                </div>
                            </a>
                        );
                    })}
                </div>
            </Container>
        </section>
    );
}
