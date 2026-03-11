import Image from "next/image";
import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import styles from "../content.module.css";

export default async function AboutPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    const values = [
        { icon: "🌿", title: dict.home.trustQualityTitle, desc: dict.home.trustQualitySubtitle },
        { icon: "💰", title: dict.home.trustPromiseTitle, desc: dict.home.trustPromiseSubtitle },
        { icon: "🤝", title: dict.home.trustSupportTitle, desc: dict.home.trustSupportSubtitle },
    ];

    const story = locale === "de"
        ? "Dutch Green Alternative wurde gegründet, um Menschen Zugang zu hochwertigen, laborgetesteten CBD- und CBG-Ölen zu fairen Preisen zu ermöglichen. Wir glauben an die Kraft der Natur und daran, dass jeder Mensch Zugang zu natürlichen Gesundheitsprodukten verdient."
        : locale === "nl"
            ? "Dutch Green Alternative is opgericht om mensen toegang te geven tot hoogwaardige, laboratorium-geteste CBD- en CBG-oliën tegen eerlijke prijzen. Wij geloven in de kracht van de natuur en dat iedereen toegang verdient tot natuurlijke gezondheidsproducten."
            : "Dutch Green Alternative was founded to give people access to high-quality, lab-tested CBD and CBG oils at fair prices. We believe in the power of nature and that everyone deserves access to natural health products.";

    const mission = locale === "de"
        ? "Unsere Mission ist einfach: die besten CBD- und CBG-Produkte aus den Niederlanden direkt zu Ihnen nach Hause zu liefern — ohne Umwege, ohne überhöhte Preise. Jede Charge wird von unabhängigen Laboren getestet, um höchste Qualität und Reinheit zu gewährleisten."
        : locale === "nl"
            ? "Onze missie is eenvoudig: de beste CBD- en CBG-producten uit Nederland rechtstreeks bij u thuis bezorgen — zonder omwegen, zonder hoge prijzen. Elke batch wordt getest door onafhankelijke laboratoria om de hoogste kwaliteit en zuiverheid te garanderen."
            : "Our mission is simple: to deliver the best CBD and CBG products from the Netherlands directly to your door — without detours, without inflated prices. Every batch is tested by independent laboratories to ensure the highest quality and purity.";

    return (
        <main className={styles.page}>
            <Container>
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>{dict.about.title}</h1>
                    <div className={styles.pageLine} />
                </div>

                {/* Story Section */}
                <div className={styles.storySection}>
                    <div className={styles.storyContent}>
                        <h2>{dict.about.ourStory}</h2>
                        <p>{story}</p>
                        <p>{mission}</p>
                    </div>
                    <div className={styles.storyImage}>
                        <Image
                            src="https://xburabmzlolrnywcyxwz.supabase.co/storage/v1/object/public/DGA/image_1773129292555_bb1gv3%20(1)%20(1).jpg"
                            alt="Dutch Green Alternative products"
                            fill
                            style={{ objectFit: "cover" }}
                            sizes="(max-width: 768px) 100vw, 50vw"
                        />
                    </div>
                </div>

                {/* Values */}
                <div className={styles.pageHeader}>
                    <h2 className={styles.pageTitle} style={{ fontSize: "var(--font-size-2xl)" }}>
                        {dict.about.values}
                    </h2>
                    <div className={styles.pageLine} />
                </div>

                <div className={styles.valuesGrid}>
                    {values.map((value, idx) => (
                        <div key={idx} className={styles.valueCard}>
                            <div className={styles.valueIcon}>{value.icon}</div>
                            <h3 className={styles.valueTitle}>{value.title}</h3>
                            <p className={styles.valueDesc}>{value.desc}</p>
                        </div>
                    ))}
                </div>
            </Container>
        </main>
    );
}
