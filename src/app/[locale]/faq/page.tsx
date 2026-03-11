import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { FaqAccordion } from "./_components/FaqAccordion";
import styles from "../content.module.css";

const faqData: Record<string, Record<string, { q: string; a: string }[]>> = {
    de: {
        "Über CBD": [
            { q: "Was ist CBD?", a: "CBD (Cannabidiol) ist ein natürlicher Pflanzenstoff aus der Hanfpflanze. Im Gegensatz zu THC hat CBD keine psychoaktive Wirkung und ist in der EU legal." },
            { q: "Was ist der Unterschied zwischen CBD und CBG?", a: "CBD und CBG sind beides Cannabinoide. CBG gilt als ‚Mutter aller Cannabinoide' und hat andere Eigenschaften als CBD. Beide wirken über das Endocannabinoid-System." },
            { q: "Was ist RAW CBD-Öl?", a: "RAW CBD-Öl wird kaltgepresst und minimal verarbeitet, sodass das volle Spektrum an Cannabinoiden, Terpenen und Flavonoiden erhalten bleibt." },
        ],
        "Dosierung": [
            { q: "Wie dosiere ich CBD-Öl?", a: "Beginnen Sie mit 2-3 Tropfen unter der Zunge, zweimal täglich. Halten Sie die Tropfen 60 Sekunden lang, bevor Sie schlucken. Passen Sie die Dosis schrittweise an." },
            { q: "Kann ich CBD zu viel nehmen?", a: "CBD gilt als sehr sicher. Falls Sie Medikamente einnehmen, konsultieren Sie jedoch Ihren Arzt, da CBD mit einigen Medikamenten interagieren kann." },
        ],
        "Versand": [
            { q: "Wie lange dauert der Versand?", a: "Bestellungen werden innerhalb von 1-2 Werktagen versendet. Die Lieferung dauert in der Regel 2-4 Werktage innerhalb der EU." },
            { q: "Ab welchem Betrag ist der Versand kostenlos?", a: "Ab einem Bestellwert von €65 liefern wir versandkostenfrei innerhalb der EU." },
        ],
    },
    nl: {
        "Over CBD": [
            { q: "Wat is CBD?", a: "CBD (cannabidiol) is een natuurlijke plantenstof uit de hennepplant. In tegenstelling tot THC heeft CBD geen psychoactieve werking en is het legaal in de EU." },
            { q: "Wat is het verschil tussen CBD en CBG?", a: "CBD en CBG zijn allebei cannabinoïden. CBG wordt beschouwd als de 'moeder van alle cannabinoïden' en heeft andere eigenschappen dan CBD. Beide werken via het endocannabinoïde systeem." },
            { q: "Wat is RAW CBD-olie?", a: "RAW CBD-olie wordt koudgeperst en minimaal verwerkt, waardoor het volledige spectrum aan cannabinoïden, terpenen en flavonoïden behouden blijft." },
        ],
        "Dosering": [
            { q: "Hoe doseer ik CBD-olie?", a: "Begin met 2-3 druppels onder de tong, tweemaal daags. Houd de druppels 60 seconden vast voordat u slikt. Pas de dosis geleidelijk aan." },
            { q: "Kan ik te veel CBD nemen?", a: "CBD wordt als zeer veilig beschouwd. Neem echter contact op met uw arts als u medicijnen gebruikt, omdat CBD met sommige medicijnen kan interageren." },
        ],
        "Verzending": [
            { q: "Hoe lang duurt de verzending?", a: "Bestellingen worden binnen 1-2 werkdagen verzonden. De levering duurt doorgaans 2-4 werkdagen binnen de EU." },
            { q: "Vanaf welk bedrag is de verzending gratis?", a: "Vanaf een bestelwaarde van €65 leveren wij gratis binnen de EU." },
        ],
    },
    en: {
        "About CBD": [
            { q: "What is CBD?", a: "CBD (cannabidiol) is a natural plant compound from the hemp plant. Unlike THC, CBD has no psychoactive effects and is legal in the EU." },
            { q: "What is the difference between CBD and CBG?", a: "CBD and CBG are both cannabinoids. CBG is considered the 'mother of all cannabinoids' and has different properties than CBD. Both work through the endocannabinoid system." },
            { q: "What is RAW CBD oil?", a: "RAW CBD oil is cold-pressed and minimally processed, preserving the full spectrum of cannabinoids, terpenes, and flavonoids." },
        ],
        "Dosage": [
            { q: "How do I dose CBD oil?", a: "Start with 2-3 drops under the tongue, twice daily. Hold the drops for 60 seconds before swallowing. Gradually adjust the dose." },
            { q: "Can I take too much CBD?", a: "CBD is considered very safe. However, consult your doctor if you are taking medication, as CBD can interact with some drugs." },
        ],
        "Shipping": [
            { q: "How long does shipping take?", a: "Orders are shipped within 1-2 business days. Delivery typically takes 2-4 business days within the EU." },
            { q: "What is the free shipping threshold?", a: "We offer free shipping on orders over €65 within the EU." },
        ],
    },
};

export default async function FaqPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);
    const categories = faqData[locale] || faqData.de;

    return (
        <main className={styles.page}>
            <Container size="narrow">
                <div className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>{dict.faq.title}</h1>
                    <div className={styles.pageLine} />
                </div>

                <div className={styles.faqCategories}>
                    {Object.entries(categories).map(([category, items]) => (
                        <div key={category}>
                            <h2 className={styles.faqCategoryTitle}>{category}</h2>
                            <FaqAccordion
                                items={items.map((item) => ({
                                    question: item.q,
                                    answer: item.a,
                                }))}
                            />
                        </div>
                    ))}
                </div>
            </Container>
        </main>
    );
}
