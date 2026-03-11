import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { BlogListClient } from "./BlogListClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getBlogPosts() {
    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/blog_posts?is_published=eq.true&order=published_at.desc`,
            {
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                },
                next: { revalidate: 600 },
            }
        );
        if (res.ok) return await res.json();
    } catch {
        // fallback
    }
    return [];
}

export default async function BlogPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);
    const posts = await getBlogPosts();

    // Collect all unique tags
    const allTags = [...new Set(posts.flatMap((p: { tags?: string[] }) => p.tags || []))].sort() as string[];

    return <BlogListClient posts={posts} locale={locale} dict={dict} allTags={allTags} />;
}
