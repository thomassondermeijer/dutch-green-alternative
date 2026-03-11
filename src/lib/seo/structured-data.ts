type ProductStructuredData = {
    name: string;
    description: string;
    price: string;
    image?: string;
    slug: string;
    category: string;
};

export function generateProductJsonLd(product: ProductStructuredData, locale: string) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

    return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: product.image,
        url: `${siteUrl}/${locale}/shop/${product.slug}`,
        brand: {
            "@type": "Brand",
            name: "Dutch Green Alternative",
        },
        offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            seller: {
                "@type": "Organization",
                name: "Dutch Green Alternative",
            },
        },
        category: product.category,
    };
}

export function generateOrganizationJsonLd() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Dutch Green Alternative",
        url: siteUrl,
        logo: `${siteUrl}/logo.png`,
        contactPoint: {
            "@type": "ContactPoint",
            email: "info@dutchgreenalternative.nl",
            contactType: "customer service",
            availableLanguage: ["Dutch", "German", "English"],
        },
        sameAs: [],
    };
}

export function generateBreadcrumbJsonLd(
    items: { name: string; url: string }[]
) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };
}
