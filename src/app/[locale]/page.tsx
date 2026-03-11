import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Hero } from "@/components/home/Hero/Hero";
import { FeaturedProducts } from "@/components/home/FeaturedProducts/FeaturedProducts";
import { EducationSection } from "@/components/home/EducationSection/EducationSection";
import { TrustSignals } from "@/components/home/TrustSignals/TrustSignals";
import { ReviewsCarousel } from "@/components/home/ReviewsCarousel/ReviewsCarousel";
import { BlogPreview } from "@/components/home/BlogPreview/BlogPreview";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton/WhatsAppButton";

async function getProducts() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Skip fetch if Supabase is not configured (build-time)
    if (!supabaseUrl || !supabaseKey) return [];

    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/products?is_active=eq.true&order=sort_order.asc`,
            {
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                },
                next: { revalidate: 3600 },
            }
        );
        if (res.ok) {
            return await res.json();
        }
    } catch {
        // Supabase not reachable — return empty
    }
    return [];
}

export default async function Home({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);
    const products = await getProducts();

    return (
        <>
            <Hero locale={locale} dict={dict} />
            <FeaturedProducts products={products} locale={locale} dict={dict} />
            <EducationSection dict={dict} />
            <TrustSignals dict={dict} />
            <ReviewsCarousel dict={dict} />
            <BlogPreview locale={locale} dict={dict} />
            <WhatsAppButton dict={dict} />
        </>
    );
}
