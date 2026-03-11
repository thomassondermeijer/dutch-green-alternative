import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "../globals.css";
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Header } from "@/components/layout/Header/Header";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar/AnnouncementBar";
import { Footer } from "@/components/layout/Footer/Footer";
import { ClientProviders } from "@/components/providers/ClientProviders";

const outfit = Outfit({
    variable: "--font-heading",
    subsets: ["latin"],
    display: "swap",
});

const inter = Inter({
    variable: "--font-body",
    subsets: ["latin"],
    display: "swap",
});

export async function generateStaticParams() {
    return i18n.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;

    const titles: Record<Locale, string> = {
        de: "Dutch Green Alternative — Premium CBD & CBG Öle",
        nl: "Dutch Green Alternative — Premium CBD & CBG Oliën",
        en: "Dutch Green Alternative — Premium CBD & CBG Oils",
    };

    const descriptions: Record<Locale, string> = {
        de: "Hochwertige RAW CBD & CBG Öle aus den Niederlanden. Laborgetestet, natürlich und wirksam. Kostenloser Versand ab €65.",
        nl: "Hoogwaardige RAW CBD & CBG oliën uit Nederland. Laboratorium getest, natuurlijk en effectief. Gratis verzending vanaf €65.",
        en: "Premium RAW CBD & CBG oils from the Netherlands. Lab-tested, natural and effective. Free shipping on orders over €65.",
    };

    return {
        title: {
            default: titles[locale],
            template: `%s | Dutch Green Alternative`,
        },
        description: descriptions[locale],
        metadataBase: new URL(
            process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl"
        ),
        alternates: {
            canonical: `/${locale}`,
            languages: {
                de: "/de",
                nl: "/nl",
                en: "/en",
            },
        },
        openGraph: {
            type: "website",
            locale: locale === "de" ? "de_DE" : locale === "nl" ? "nl_NL" : "en_US",
            siteName: "Dutch Green Alternative",
        },
    };
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return (
        <div className={`${outfit.variable} ${inter.variable}`}>
            <ClientProviders locale={locale} dict={dict}>
                <AnnouncementBar dict={dict} />
                <Header locale={locale} dict={dict} />
                {children}
                <Footer locale={locale} dict={dict} />
            </ClientProviders>
        </div>
    );
}

