import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const locales = ["de", "nl", "en"];
    const staticPages = [
        "",
        "/shop",
        "/about",
        "/faq",
        "/contact",
        "/shipping-returns",
        "/blog",
    ];

    // Static pages for all locales
    const staticEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
        staticPages.map((page) => ({
            url: `${SITE_URL}/${locale}${page}`,
            lastModified: new Date(),
            changeFrequency: page === "" ? "weekly" as const : "monthly" as const,
            priority: page === "" ? 1 : page === "/shop" ? 0.9 : 0.7,
            alternates: {
                languages: Object.fromEntries(
                    locales.map((l) => [l, `${SITE_URL}/${l}${page}`])
                ),
            },
        }))
    );

    // Dynamic product pages
    let productEntries: MetadataRoute.Sitemap = [];
    let blogEntries: MetadataRoute.Sitemap = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
        };

        // Products
        try {
            const res = await fetch(
                `${supabaseUrl}/rest/v1/products?is_active=eq.true&select=slug,updated_at`,
                { headers, next: { revalidate: 3600 } }
            );

            if (res.ok) {
                const products: { slug: string; updated_at: string }[] = await res.json();
                productEntries = locales.flatMap((locale) =>
                    products.map((product) => ({
                        url: `${SITE_URL}/${locale}/shop/${product.slug}`,
                        lastModified: new Date(product.updated_at),
                        changeFrequency: "weekly" as const,
                        priority: 0.8,
                        alternates: {
                            languages: Object.fromEntries(
                                locales.map((l) => [l, `${SITE_URL}/${l}/shop/${product.slug}`])
                            ),
                        },
                    }))
                );
            }
        } catch { }

        // Blog posts
        try {
            const res = await fetch(
                `${supabaseUrl}/rest/v1/blog_posts?is_published=eq.true&select=slug,updated_at,published_at`,
                { headers, next: { revalidate: 3600 } }
            );

            if (res.ok) {
                const posts: { slug: string; updated_at: string; published_at: string }[] = await res.json();
                blogEntries = locales.flatMap((locale) =>
                    posts.map((post) => ({
                        url: `${SITE_URL}/${locale}/blog/${post.slug}`,
                        lastModified: new Date(post.updated_at || post.published_at),
                        changeFrequency: "monthly" as const,
                        priority: 0.7,
                        alternates: {
                            languages: Object.fromEntries(
                                locales.map((l) => [l, `${SITE_URL}/${l}/blog/${post.slug}`])
                            ),
                        },
                    }))
                );
            }
        } catch { }
    }

    return [...staticEntries, ...productEntries, ...blogEntries];
}
