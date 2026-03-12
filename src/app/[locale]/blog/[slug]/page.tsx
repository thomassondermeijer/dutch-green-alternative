import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { blogPostJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
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

async function getRelatedPosts(currentSlug: string, tags: string[]) {
    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/blog_posts?is_published=eq.true&slug=neq.${currentSlug}&order=published_at.desc&limit=3`,
            {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
                next: { revalidate: 600 },
            }
        );
        if (res.ok) return await res.json();
    } catch { /* fallback */ }
    return [];
}

function estimateReadingTime(html: string): number {
    const text = html.replace(/<[^>]*>/g, "");
    return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

function extractHeadings(html: string): { id: string; text: string }[] {
    const headings: { id: string; text: string }[] = [];
    const regex = /<h2[^>]*>(.*?)<\/h2>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]*>/g, "");
        const id = text
            .toLowerCase()
            .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        headings.push({ id, text });
    }
    return headings;
}

function addIdsToHeadings(html: string): string {
    return html.replace(/<h2([^>]*)>(.*?)<\/h2>/gi, (_, attrs, content) => {
        const text = content.replace(/<[^>]*>/g, "");
        const id = text
            .toLowerCase()
            .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        return `<h2 id="${id}"${attrs}>${content}</h2>`;
    });
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
            type: "article",
            publishedTime: post.published_at,
            modifiedTime: post.updated_at || post.published_at,
            images: post.featured_image ? [post.featured_image] : [],
        },
        alternates: {
            canonical: `/${locale}/blog/${slug}`,
            languages: {
                de: `/de/blog/${slug}`,
                nl: `/nl/blog/${slug}`,
                en: `/en/blog/${slug}`,
            },
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

    const t = post.translations[locale] || post.translations.de || { title: "", excerpt: "", content: "", sources: [] };
    const readTime = estimateReadingTime(t.content || "");
    const date = post.published_at
        ? new Date(post.published_at).toLocaleDateString(
            locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-US",
            { year: "numeric", month: "long", day: "numeric" }
        )
        : "";

    const headings = extractHeadings(t.content || "");
    const contentWithIds = addIdsToHeadings(t.content || "");
    const sources: { text: string; url?: string }[] = t.sources || [];
    const relatedPosts = await getRelatedPosts(slug, post.tags || []);

    const disclaimerText: Record<string, string> = {
        de: "Die Informationen in diesem Artikel dienen ausschließlich zu Bildungszwecken und sind kein Ersatz für professionelle medizinische Beratung.",
        en: "The information in this article is for educational purposes only and is not a substitute for professional medical advice.",
        nl: "De informatie in dit artikel is uitsluitend bedoeld voor educatieve doeleinden en is geen vervanging voor professioneel medisch advies.",
    };

    const tocLabel: Record<string, string> = { de: "Inhaltsverzeichnis", en: "Table of Contents", nl: "Inhoudsopgave" };
    const sourcesLabel: Record<string, string> = { de: "Quellen", en: "Sources", nl: "Bronnen" };
    const relatedLabel: Record<string, string> = { de: "Weitere Artikel", en: "More Articles", nl: "Meer Artikelen" };

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

    const articleSchema = blogPostJsonLd({
        title: t.title,
        excerpt: t.excerpt || "",
        slug,
        locale,
        publishedAt: post.published_at,
        updatedAt: post.updated_at,
        image: post.featured_image,
        readingTime: readTime,
    });

    const breadcrumb = breadcrumbJsonLd([
        { name: "Home", url: `${siteUrl}/${locale}` },
        { name: "Blog", url: `${siteUrl}/${locale}/blog` },
        { name: t.title, url: `${siteUrl}/${locale}/blog/${slug}` },
    ]);

    return (
        <main className={styles.articlePage}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
            />
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

                {/* Table of Contents */}
                {headings.length > 2 && (
                    <nav className={styles.toc}>
                        <h3 className={styles.tocTitle}>{tocLabel[locale] || tocLabel.de}</h3>
                        <ol className={styles.tocList}>
                            {headings.map((h, i) => (
                                <li key={i}>
                                    <a href={`#${h.id}`} className={styles.tocLink}>{h.text}</a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                )}

                <div
                    className={styles.prose}
                    dangerouslySetInnerHTML={{ __html: contentWithIds }}
                />

                {/* Sources */}
                {sources.length > 0 && (
                    <div className={styles.sources}>
                        <h3 className={styles.sourcesTitle}>{sourcesLabel[locale] || sourcesLabel.de}</h3>
                        <ol className={styles.sourcesList}>
                            {sources.map((s, i) => (
                                <li key={i}>
                                    {s.url ? (
                                        <a href={s.url} target="_blank" rel="noopener noreferrer">{s.text}</a>
                                    ) : (
                                        <span>{s.text}</span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}

                <div className={styles.disclaimer}>
                    {disclaimerText[locale] || disclaimerText.de}
                </div>

                {/* Related Posts */}
                {relatedPosts.length > 0 && (
                    <div className={styles.related}>
                        <h3 className={styles.relatedTitle}>{relatedLabel[locale] || relatedLabel.de}</h3>
                        <div className={styles.relatedGrid}>
                            {relatedPosts.map((rp: { id: string; slug: string; featured_image: string | null; translations: Record<string, { title: string; excerpt: string }> }) => {
                                const rt = rp.translations[locale] || rp.translations.de || { title: "", excerpt: "" };
                                return (
                                    <Link key={rp.id} href={`/${locale}/blog/${rp.slug}`} className={styles.relatedCard}>
                                        {rp.featured_image && (
                                            <div className={styles.relatedImage}>
                                                <Image src={rp.featured_image} alt={rt.title} fill style={{ objectFit: "cover" }} sizes="33vw" />
                                            </div>
                                        )}
                                        <h4 className={styles.relatedCardTitle}>{rt.title}</h4>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Container>
        </main>
    );
}
