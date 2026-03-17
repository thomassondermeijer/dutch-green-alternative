import type { Metadata } from "next";
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { LabResultsGrid } from "./_components/LabResultsGrid";
import styles from "./lab-results.module.css";

const SUPABASE_STORAGE = "https://xburabmzlolrnywcyxwz.supabase.co/storage/v1/object/public/DGA";

/**
 * Maps product slug → lab result filename in Supabase storage.
 */
const LAB_RESULT_FILES: Record<string, string> = {
    "cbd-raw-5-5": "5,5 DGA.jpg",
    "cbd-raw-11": "11 DGA.jpg",
    "cbd-gold-35": "35 DGA.jpg",
    "golden-spectrum-35": "Golden Spectrum-min.jpg",
    "cbg-raw-12": "12 CBG.jpg",
    "mind-comfort-8": "MC.jpg",
    "good-night-8": "GN.jpg",
    "body-harmony-8": "BH.jpg",
};

/**
 * Product data with images — sorted by display order.
 */
const PRODUCTS = [
    { slug: "cbd-raw-5-5", image: "products/1773139585887-slnqsd.jpg", names: { nl: "RAW CBD Olie 5,5%", de: "RAW CBD Öl 5,5%", en: "RAW CBD Oil 5.5%" } },
    { slug: "cbd-raw-11", image: "products/1773139717273-5yl2mo.jpg", names: { nl: "RAW CBD Olie 11%", de: "RAW CBD Öl 11%", en: "RAW CBD Oil 11%" } },
    { slug: "cbd-gold-35", image: "products/1773139727997-ewqlsk.jpg", names: { nl: "CBD Gold 35%", de: "CBD Gold 35%", en: "CBD Gold 35%" } },
    { slug: "golden-spectrum-35", image: "products/1773139739796-wqfava.jpg", names: { nl: "Golden Spectrum 35% (CBD+CBG+CBN)", de: "Golden Spectrum 35% (CBD+CBG+CBN)", en: "Golden Spectrum 35% (CBD+CBG+CBN)" } },
    { slug: "cbg-raw-12", image: "products/1773139762441-37gzwk.jpg", names: { nl: "CBG RAW 12%", de: "CBG RAW 12%", en: "CBG RAW 12%" } },
    { slug: "mind-comfort-8", image: "products/1773139771853-90odql.jpg", names: { nl: "Mind Comfort", de: "Mind Comfort", en: "Mind Comfort" } },
    { slug: "good-night-8", image: "products/1773139780602-tlucvk.jpg", names: { nl: "Good Night", de: "Good Night", en: "Good Night" } },
    { slug: "body-harmony-8", image: "products/1773139789245-vjfedk.jpg", names: { nl: "Body Harmony", de: "Body Harmony", en: "Body Harmony" } },
];

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    const descriptions: Record<Locale, string> = {
        nl: "Bekijk de onafhankelijke laboratoriumresultaten van al onze CBD en CBG producten. Transparantie en kwaliteit staan bij ons voorop.",
        de: "Sehen Sie sich die unabhängigen Laborergebnisse aller unserer CBD- und CBG-Produkte an. Transparenz und Qualität stehen bei uns an erster Stelle.",
        en: "View the independent lab results for all our CBD and CBG products. Transparency and quality come first.",
    };

    return {
        title: dict.labResults.title,
        description: descriptions[locale],
        alternates: {
            canonical: `/${locale}/lab-results`,
            languages: {
                de: "/de/lab-results",
                nl: "/nl/lab-results",
                en: "/en/lab-results",
            },
        },
    };
}

export default async function LabResultsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    const products = PRODUCTS.map((p) => ({
        slug: p.slug,
        name: p.names[locale],
        productImage: `${SUPABASE_STORAGE}/${p.image}`,
        labResultImage: `${SUPABASE_STORAGE}/Labresults/${encodeURIComponent(LAB_RESULT_FILES[p.slug])}`,
    }));

    return (
        <main className={styles.page}>
            <Container>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>{dict.labResults.title}</h1>
                    <p className={styles.pageSubtitle}>{dict.labResults.subtitle}</p>
                    <div className={styles.pageLine} />
                </div>

                <LabResultsGrid
                    products={products}
                    hoverHint={dict.labResults.hoverHint}
                    clickHint={dict.labResults.clickHint}
                    verifiedBy={dict.labResults.verifiedBy}
                />
            </Container>
        </main>
    );
}
