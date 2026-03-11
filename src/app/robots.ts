import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/checkout/success"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
