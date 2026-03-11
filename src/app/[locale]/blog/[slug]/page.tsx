import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import styles from "./article.module.css";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getPost(slug: string) {
    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/blog_posts?slug=eq.${slug}&is_published=eq.true&limit=1`,
            {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
                next: { revalidate: 600 },
            }
        );
        if (res.ok) {
            const data = await res.json();
            return data[0] || null;
        }
    } catch { /* fallback */ }
    return null;
}

function estimateReadingTime(html: string): number {
    const text = html.replace(/<[^>]*>/g, "");
    return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale, slug } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const post = await getPost(slug);
    if (!post) return {};
    const t = post.translations[locale] || post.translations.de || {};
    return {
        title: t.title,
        description: t.excerpt,
        openGraph: {
            title: t.title,
            description: t.excerpt,
            images: post.featured_image ? [post.featured_image] : [],
        },
    };
}

export default async function BlogArticlePage({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}) {
    const { locale: rawLocale, slug } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);
    const post = await getPost(slug);

    if (!post) notFound();

    const t = post.translations[locale] || post.translations.de || { title: "", excerpt: "", content: "" };
    const readTime = estimateReadingTime(t.content || "");
    const date = post.published_at
        ? new Date(post.published_at).toLocaleDateString(
            locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-US",
            { year: "numeric", month: "long", day: "numeric" }
        )
        : "";

    const disclaimerText: Record<string, string> = {
        de: "Die Informationen in diesem Artikel dienen ausschließlich zu Bildungszwecken und sind kein Ersatz für professionelle medizinische Beratung.",
        en: "The information in this article is for educational purposes only and is not a substitute for professional medical advice.",
        nl: "De informatie in dit artikel is uitsluitend bedoeld voor educatieve doeleinden en is geen vervanging voor professioneel medisch advies.",
    };

    return (
        <main className={styles.articlePage}>
            <Container>
                <Link href={`/${locale}/blog`} className={styles.backLink}>
                    ← {dict.blog.backToBlog || "Back to Blog"}
                </Link>

                <div className={styles.articleHeader}>
                    {post.tags?.length > 0 && (
                        <div className={styles.articleTags}>
                            {post.tags.map((tag: string) => (
                                <span key={tag} className={styles.articleTag}>{tag}</span>
                            ))}
                        </div>
                    )}
                    <h1 className={styles.articleTitle}>{t.title}</h1>
                    <div className={styles.articleMeta}>
                        <span>{date}</span>
                        <span className={styles.metaDivider} />
                        <span>{readTime} min {dict.blog.readingTime || "read"}</span>
                    </div>
                </div>

                {post.featured_image && (
                    <div className={styles.heroImage}>
                        <Image
                            src={post.featured_image}
                            alt={t.title}
                            fill
                            style={{ objectFit: "cover" }}
                            sizes="100vw"
                            priority
                        />
                    </div>
                )}

                <div
                    className={styles.prose}
                    dangerouslySetInnerHTML={{ __html: t.content }}
                />

                <div className={styles.disclaimer}>
                    {disclaimerText[locale] || disclaimerText.de}
                </div>
            </Container>
        </main>
    );
}
