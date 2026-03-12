/**
 * JSON-LD structured data helpers for SEO.
 * Generates schema.org compliant structured data.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

export function organizationJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Dutch Green Alternative",
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        sameAs: [],
        contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            email: "info@dutchgreenalternative.nl",
            availableLanguage: ["German", "Dutch", "English"],
        },
    };
}

export function productJsonLd({
    name,
    description,
    price,
    image,
    slug,
    locale,
    inStock,
    sku,
    reviews,
}: {
    name: string;
    description: string;
    price: string;
    image?: string;
    slug: string;
    locale: string;
    inStock: boolean;
    sku?: string;
    reviews?: { rating: number; count: number };
}) {
    const schema: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description,
        url: `${SITE_URL}/${locale}/shop/${slug}`,
        brand: {
            "@type": "Brand",
            name: "Dutch Green Alternative",
        },
        offers: {
            "@type": "Offer",
            priceCurrency: "EUR",
            price,
            availability: inStock
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            url: `${SITE_URL}/${locale}/shop/${slug}`,
            seller: {
                "@type": "Organization",
                name: "Dutch Green Alternative",
            },
        },
    };

    if (image) schema.image = image;
    if (sku) schema.sku = sku;

    if (reviews && reviews.count > 0) {
        schema.aggregateRating = {
            "@type": "AggregateRating",
            ratingValue: reviews.rating.toFixed(1),
            reviewCount: reviews.count,
            bestRating: "5",
            worstRating: "1",
        };
    }

    return schema;
}

export function blogPostJsonLd({
    title,
    excerpt,
    slug,
    locale,
    publishedAt,
    updatedAt,
    image,
    readingTime,
}: {
    title: string;
    excerpt: string;
    slug: string;
    locale: string;
    publishedAt: string;
    updatedAt?: string;
    image?: string;
    readingTime: number;
}) {
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description: excerpt,
        url: `${SITE_URL}/${locale}/blog/${slug}`,
        datePublished: publishedAt,
        dateModified: updatedAt || publishedAt,
        author: {
            "@type": "Organization",
            name: "Dutch Green Alternative",
        },
        publisher: {
            "@type": "Organization",
            name: "Dutch Green Alternative",
            logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/logo.png`,
            },
        },
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `${SITE_URL}/${locale}/blog/${slug}`,
        },
        wordCount: readingTime * 200,
        ...(image ? { image } : {}),
    };
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
    if (!faqs || faqs.length === 0) return null;
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.a,
            },
        })),
    };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: item.url,
        })),
    };
}
