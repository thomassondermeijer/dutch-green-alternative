import type { Metadata } from "next";
import { i18n, type Locale } from "@/i18n/config";
import styles from "../legal.module.css";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const titles: Record<string, string> = {
        de: "Datenschutzerklärung",
        nl: "Privacybeleid",
        en: "Privacy Policy",
    };
    return {
        title: titles[locale] || titles.de,
    };
}

// ─── Content per locale ────────────────────────────────────────────────────────

const content: Record<Locale, {
    title: string;
    lastUpdated: string;
    sections: { type: "p" | "h2" | "h3"; text: string }[];
}> = {
    de: {
        title: "Datenschutzerklärung",
        lastUpdated: "Letzte Aktualisierung: 03.03.2022",
        sections: [
            { type: "p", text: "GreenResults OÜ achtet auf Ihre Privatsphäre. Daher verarbeiten wir nur Daten, die wir für die (Verbesserung) unserer Dienste benötigen, und wir gehen sorgfältig mit den Informationen um, die wir über Sie und Ihre Nutzung unserer Dienste gesammelt haben. Wir geben Ihre Daten niemals zu kommerziellen Zwecken an Dritte weiter." },
            { type: "p", text: "Diese Datenschutzpolitik gilt für die Nutzung der Website und der von ihr abgerufenen Dienste von GreenResults OÜ. Der Stichtag für die Gültigkeit dieser Bedingungen ist der 03.03.2022, mit der Veröffentlichung einer neuen Version erlischt die Gültigkeit aller vorherigen Versionen. Diese Datenschutzrichtlinie beschreibt, welche Informationen über Sie von uns gesammelt werden, wo diese Informationen verwendet werden und mit wem und unter welchen Bedingungen diese Informationen an Dritte weitergegeben werden können." },
            { type: "p", text: "Wenn Sie Fragen zu unserer Datenschutzrichtlinie haben, wenden Sie sich bitte an unseren Datenschutzbeauftragten, dessen Kontaktdaten Sie am Ende unserer Datenschutzrichtlinie finden." },
            { type: "h2", text: "Über die Datenverarbeitung" },
            { type: "p", text: "Im Folgenden können Sie nachlesen, wie wir Ihre Daten verarbeiten, wo wir sie speichern (lassen), welche Sicherheitstechniken wir anwenden und wem die Daten zugänglich sind." },
            { type: "h3", text: "Webshop-Software — WooCommerce" },
            { type: "p", text: "Unser Shop ist mit der Software von WooCommerce entwickelt. Persönliche Daten, die Sie für unsere Dienste zur Verfügung stellen, werden mit dieser Partei geteilt. WooCommerce hat Zugang zu Ihren Daten, um uns (technischen) Support zu leisten, sie werden Ihre Daten niemals für andere Zwecke verwenden. Zu den Sicherheitsmaßnahmen gehören die Verwendung der SSL-Verschlüsselung und eine strenge Passwortpolitik." },
            { type: "h3", text: "Webhosting — Vimexx" },
            { type: "p", text: "Wir beziehen Webhosting- und E-Mail-Dienste von Vimexx. Vimexx verarbeitet personenbezogene Daten in unserem Auftrag und verwendet Ihre Daten nicht für eigene Zwecke. Vimexx hat geeignete technische und organisatorische Maßnahmen getroffen, um den Verlust und die unbefugte Nutzung Ihrer personenbezogenen Daten zu verhindern." },
            { type: "h3", text: "E-Mail und Verteilerlisten — SendinBlue" },
            { type: "p", text: "Unsere Website nutzt SendinBlue, um den E-Mail-Verkehr und den Versand von Newslettern zu verwalten. SendinBlue wird Ihren Namen und Ihre E-Mail-Adresse niemals für eigene Zwecke verwenden. Ihre persönlichen Daten werden sicher übertragen, gespeichert und abgerufen." },
            { type: "h3", text: "Zahlungsabwickler — Mollie" },
            { type: "p", text: "Für die Abwicklung der Zahlungen in unserem Webshop verwenden wir die Plattform von Mollie. Mollie verarbeitet Ihren Namen, Ihre Adresse und Ihre Zahlungsinformationen. Mollie hat angemessene technische und organisatorische Maßnahmen zum Schutz Ihrer personenbezogenen Daten getroffen. Mollie wird Ihre Daten nicht länger aufbewahren, als dies gesetzlich zulässig ist." },
            { type: "h3", text: "Versand und Logistik — DHL" },
            { type: "p", text: "Wir nutzen die Dienste von DHL für die Durchführung der Lieferungen. Daher ist es notwendig, dass wir Ihren Namen, Ihre Adresse und Ihren Wohnort an DHL weitergeben. DHL wird diese Daten nur zur Erfüllung des Vertrags verwenden." },
            { type: "h3", text: "Rechnungsstellung und Buchführung — MoneyBird" },
            { type: "p", text: "Für unsere Verwaltung und Buchhaltung nutzen wir die Dienste von MoneyBird. Ihre personenbezogenen Daten werden in geschützter Weise übertragen und gespeichert. MoneyBird ist zur Verschwiegenheit verpflichtet und wird Ihre Daten vertraulich behandeln." },
            { type: "h2", text: "Zweck der Datenverarbeitung" },
            { type: "h3", text: "Allgemeiner Zweck der Verarbeitung" },
            { type: "p", text: "Wir verwenden Ihre Daten ausschließlich zum Zweck der Erbringung unserer Dienstleistungen. Das bedeutet, dass der Zweck der Verarbeitung immer in direktem Zusammenhang mit dem von Ihnen erteilten Auftrag steht. Wir verwenden Ihre Daten nicht für (gezieltes) Marketing. Ihre Daten werden nicht an Dritte weitergegeben, es sei denn, sie dienen zur Erfüllung von Buchführungs- und anderen Verwaltungspflichten." },
            { type: "h3", text: "Automatisch erfasste Daten" },
            { type: "p", text: "Daten, die von unserer Website automatisch erfasst werden, werden mit dem Ziel verarbeitet, unsere Dienstleistungen weiter zu verbessern. Diese Daten (z. B. Ihre IP-Adresse, Ihr Webbrowser und Ihr Betriebssystem) sind keine personenbezogenen Daten." },
            { type: "h3", text: "Zusammenarbeit bei Steuer- und Strafermittlungen" },
            { type: "p", text: "Gegebenenfalls kann GreenResults OÜ gesetzlich verpflichtet sein, Ihre Daten im Zusammenhang mit steuerlichen oder strafrechtlichen Ermittlungen der Behörden weiterzugeben." },
            { type: "h2", text: "Lagerzeiten" },
            { type: "p", text: "Wir bewahren Ihre Daten auf, solange Sie Kunde bei uns sind. Wenn Sie uns mitteilen, dass Sie unsere Dienste nicht mehr nutzen möchten, betrachten wir dies als Antrag auf Vergessenwerden. Gemäß den geltenden verwaltungstechnischen Verpflichtungen sind wir verpflichtet, Rechnungen mit Ihren Daten aufzubewahren." },
            { type: "h2", text: "Ihre Rechte" },
            { type: "p", text: "Nach den geltenden niederländischen und europäischen Rechtsvorschriften haben Sie als betroffene Person bestimmte Rechte in Bezug auf die von uns verarbeiteten personenbezogenen Daten. Sie haben jederzeit das Recht, eine Beschwerde bei der Behörde für personenbezogene Daten einzureichen." },
            { type: "h3", text: "Recht auf Einsichtnahme" },
            { type: "p", text: "Sie haben jederzeit das Recht auf Einsicht in die Daten, die wir verarbeiten und die sich auf Sie beziehen." },
            { type: "h3", text: "Recht auf Berichtigung" },
            { type: "p", text: "Sie haben jederzeit das Recht, die von uns verarbeiteten Daten ändern zu lassen." },
            { type: "h3", text: "Recht auf Einschränkung der Verarbeitung" },
            { type: "p", text: "Sie haben jederzeit das Recht, die Verarbeitung Ihrer Daten einzuschränken." },
            { type: "h3", text: "Recht auf Übertragbarkeit" },
            { type: "p", text: "Sie haben jederzeit das Recht, die von uns verarbeiteten Daten von einer anderen Stelle ausführen zu lassen." },
            { type: "h3", text: "Widerspruchsrecht" },
            { type: "p", text: "Sie haben das Recht, der Verarbeitung Ihrer personenbezogenen Daten durch GreenResults OÜ zu widersprechen." },
            { type: "h2", text: "Cookies" },
            { type: "h3", text: "Google Analytics" },
            {
                type: "p", text: "Über unsere Website werden Cookies von Google im Rahmen des Dienstes Analytics gesetzt. Wir nutzen diesen Dienst, um zu verfolgen und Berichte darüber zu erhalten, wie Besucher die Website nutzen."
            },
            { type: "h3", text: "Cookies von Dritten" },
            { type: "p", text: "Für den Fall, dass Softwarelösungen von Drittanbietern Cookies verwenden, wird dies in dieser Datenschutzerklärung angegeben." },
            { type: "h2", text: "Änderungen der Datenschutzrichtlinie" },
            { type: "p", text: "Wir behalten uns das Recht vor, unsere Datenschutzpolitik jederzeit zu ändern. Auf dieser Seite finden Sie immer die aktuellste Version." },
            { type: "h2", text: "Kontaktangaben" },
            { type: "p", text: "GreenResults OÜ · Tornimäe 3, 10145 Tallinn, Estonia · T: (062) 441-4138 · E: thomas@dutchgreenalternative.com" },
            { type: "p", text: "Kontaktperson für Datenschutzfragen: Thomas Sondermeijer" },
        ],
    },
    nl: {
        title: "Privacybeleid",
        lastUpdated: "Laatst bijgewerkt: 03-03-2022",
        sections: [
            { type: "p", text: "GreenResults OÜ respecteert uw privacy. Daarom verwerken wij alleen gegevens die wij nodig hebben voor (het verbeteren van) onze diensten en gaan wij zorgvuldig om met de informatie die wij over u en uw gebruik van onze diensten verzamelen. Wij verstrekken uw gegevens nooit voor commerciële doeleinden aan derden." },
            { type: "p", text: "Dit privacybeleid is van toepassing op het gebruik van de website en de diensten van GreenResults OÜ. De ingangsdatum voor dit beleid is 03-03-2022. Bij publicatie van een nieuwe versie vervalt de geldigheid van alle voorgaande versies. Dit privacybeleid beschrijft welke informatie over u door ons wordt verzameld, waarvoor deze informatie wordt gebruikt en met wie en onder welke voorwaarden deze informatie eventueel aan derden kan worden verstrekt." },
            { type: "p", text: "Als u vragen heeft over ons privacybeleid, neem dan contact op met onze privacy contactpersoon, waarvan u de contactgegevens aan het einde van ons privacybeleid vindt." },
            { type: "h2", text: "Over de gegevensverwerking" },
            { type: "p", text: "Hieronder kunt u lezen hoe wij uw gegevens verwerken, waar wij ze opslaan (laten), welke beveiligingstechnieken wij toepassen en voor wie de gegevens toegankelijk zijn." },
            { type: "h3", text: "Webshopsoftware — WooCommerce" },
            { type: "p", text: "Onze webshop is ontwikkeld met de software van WooCommerce. Persoonsgegevens die u voor onze diensten beschikbaar stelt, worden met deze partij gedeeld. WooCommerce heeft toegang tot uw gegevens om ons (technische) ondersteuning te bieden; zij zullen uw gegevens nooit voor andere doeleinden gebruiken. Beveiliginsmaatregelen zijn onder andere het gebruik van SSL-encryptie en een streng wachtwoordbeleid." },
            { type: "h3", text: "Webhosting — Vimexx" },
            { type: "p", text: "Wij maken gebruik van de webhosting- en e-maildiensten van Vimexx. Vimexx verwerkt persoonsgegevens namens ons en gebruikt uw gegevens niet voor eigen doeleinden. Vimexx heeft passende technische en organisatorische maatregelen getroffen om verlies en ongeautoriseerd gebruik van uw persoonsgegevens te voorkomen." },
            { type: "h3", text: "E-mail en mailinglijsten — SendinBlue" },
            { type: "p", text: "Onze website maakt gebruik van SendinBlue voor het beheren van e-mailverkeer en het verzenden van nieuwsbrieven. SendinBlue zal uw naam en e-mailadres nooit voor eigen doeleinden gebruiken. Uw persoonlijke gegevens worden veilig verzonden, opgeslagen en opgehaald." },
            { type: "h3", text: "Betalingsverwerker — Mollie" },
            { type: "p", text: "Voor de verwerking van betalingen in onze webshop gebruiken wij het platform van Mollie. Mollie verwerkt uw naam, adres en betalingsgegevens. Mollie heeft passende technische en organisatorische maatregelen genomen om uw persoonsgegevens te beschermen. Mollie bewaart uw gegevens niet langer dan wettelijk is toegestaan." },
            { type: "h3", text: "Verzending en logistiek — DHL" },
            { type: "p", text: "Wij maken gebruik van de diensten van DHL voor het uitvoeren van leveringen. Daarom is het noodzakelijk dat wij uw naam, adres en woonplaats aan DHL doorgeven. DHL zal deze gegevens alleen gebruiken voor de uitvoering van de overeenkomst." },
            { type: "h3", text: "Facturering en boekhouding — MoneyBird" },
            { type: "p", text: "Voor onze administratie en boekhouding maken wij gebruik van de diensten van MoneyBird. Uw persoonsgegevens worden op een beveiligde manier verzonden en opgeslagen. MoneyBird is gebonden aan geheimhouding en zal uw gegevens vertrouwelijk behandelen." },
            { type: "h2", text: "Doel van de gegevensverwerking" },
            { type: "h3", text: "Algemeen doel van de verwerking" },
            { type: "p", text: "Wij gebruiken uw gegevens uitsluitend ten behoeve van onze dienstverlening. Dit betekent dat het doel van de verwerking altijd direct verband houdt met de opdracht die u ons geeft. Wij gebruiken uw gegevens niet voor (gerichte) marketing. Uw gegevens worden niet aan derden verstrekt, tenzij dit nodig is voor de uitvoering van boekhoudkundige en andere administratieve verplichtingen." },
            { type: "h3", text: "Automatisch verzamelde gegevens" },
            { type: "p", text: "Gegevens die automatisch door onze website worden verzameld, worden verwerkt met als doel onze dienstverlening verder te verbeteren. Deze gegevens (bijvoorbeeld uw IP-adres, webbrowser en besturingssysteem) zijn geen persoonsgegevens." },
            { type: "h3", text: "Medewerking aan fiscale en strafrechtelijke onderzoeken" },
            { type: "p", text: "GreenResults OÜ kan in voorkomende gevallen wettelijk verplicht zijn uw gegevens te verstrekken in het kader van fiscale of strafrechtelijke onderzoeken door de autoriteiten." },
            { type: "h2", text: "Bewaartermijnen" },
            { type: "p", text: "Wij bewaren uw gegevens zolang u klant bij ons bent. Wanneer u ons meedeelt dat u geen gebruik meer wilt maken van onze diensten, beschouwen wij dit als een verzoek om vergeten te worden. Op grond van toepasselijke administratieve verplichtingen zijn wij verplicht facturen met uw gegevens te bewaren." },
            { type: "h2", text: "Uw rechten" },
            { type: "p", text: "Op grond van de geldende Nederlandse en Europese wetgeving heeft u als betrokkene bepaalde rechten met betrekking tot de persoonsgegevens die door ons worden verwerkt. U heeft te allen tijde het recht een klacht in te dienen bij de toezichthouder." },
            { type: "h3", text: "Recht op inzage" },
            { type: "p", text: "U heeft te allen tijde het recht op inzage in de gegevens die wij over u verwerken." },
            { type: "h3", text: "Recht op rectificatie" },
            { type: "p", text: "U heeft te allen tijde het recht om de door ons verwerkte gegevens te laten wijzigen." },
            { type: "h3", text: "Recht op beperking van de verwerking" },
            { type: "p", text: "U heeft te allen tijde het recht de verwerking van uw gegevens te beperken." },
            { type: "h3", text: "Recht op overdraagbaarheid" },
            { type: "p", text: "U heeft te allen tijde het recht om uw door ons verwerkte gegevens door een andere partij te laten uitvoeren." },
            { type: "h3", text: "Recht van bezwaar" },
            { type: "p", text: "U heeft het recht bezwaar te maken tegen de verwerking van uw persoonsgegevens door GreenResults OÜ." },
            { type: "h2", text: "Cookies" },
            { type: "h3", text: "Google Analytics" },
            { type: "p", text: "Via onze website worden cookies geplaatst van Google in het kader van de dienst 'Analytics'. Wij gebruiken deze dienst om bij te houden en rapporten te krijgen over hoe bezoekers de website gebruiken." },
            { type: "h3", text: "Cookies van derden" },
            { type: "p", text: "Indien softwareoplossingen van derden gebruik maken van cookies, wordt dit in dit privacybeleid aangegeven." },
            { type: "h2", text: "Wijzigingen in het privacybeleid" },
            { type: "p", text: "Wij behouden ons het recht voor ons privacybeleid op elk moment te wijzigen. Op deze pagina vindt u altijd de meest recente versie." },
            { type: "h2", text: "Contactgegevens" },
            { type: "p", text: "GreenResults OÜ · Tornimäe 3, 10145 Tallinn, Estonia · T: (062) 441-4138 · E: thomas@dutchgreenalternative.com" },
            { type: "p", text: "Privacy contactpersoon: Thomas Sondermeijer" },
        ],
    },
    en: {
        title: "Privacy Policy",
        lastUpdated: "Last updated: March 3, 2022",
        sections: [
            { type: "p", text: "GreenResults OÜ respects your privacy. Therefore, we only process data that we need for (improving) our services and we handle the information we have collected about you and your use of our services with care. We never share your data with third parties for commercial purposes." },
            { type: "p", text: "This privacy policy applies to the use of the website and services provided by GreenResults OÜ. The effective date for the validity of these terms is March 3, 2022. With the publication of a new version, the validity of all previous versions is cancelled. This privacy policy describes what information about you is collected by us, where this information is used and with whom and under what conditions this information may be shared with third parties." },
            { type: "p", text: "If you have any questions about our privacy policy, please contact our Data Protection Officer, whose contact details can be found at the end of this privacy policy." },
            { type: "h2", text: "About Data Processing" },
            { type: "p", text: "Below you can read how we process your data, where we store it, what security techniques we use and who has access to the data." },
            { type: "h3", text: "Webshop Software — WooCommerce" },
            { type: "p", text: "Our shop is developed with WooCommerce software. Personal data you provide for our services is shared with this party. WooCommerce has access to your data to provide us with (technical) support; they will never use your data for any other purpose. Security measures include SSL encryption and a strict password policy." },
            { type: "h3", text: "Web Hosting — Vimexx" },
            { type: "p", text: "We use web hosting and email services from Vimexx. Vimexx processes personal data on our behalf and does not use your data for its own purposes. Vimexx has taken appropriate technical and organizational measures to prevent loss and unauthorized use of your personal data." },
            { type: "h3", text: "Email and Mailing Lists — SendinBlue" },
            { type: "p", text: "Our website uses SendinBlue to manage email traffic and send newsletters. SendinBlue will never use your name and email address for its own purposes. Your personal data is securely transmitted, stored and retrieved." },
            { type: "h3", text: "Payment Processor — Mollie" },
            { type: "p", text: "We use the Mollie platform for processing payments in our webshop. Mollie processes your name, address and payment information. Mollie has taken appropriate technical and organizational measures to protect your personal data. Mollie will not retain your data longer than legally permitted." },
            { type: "h3", text: "Shipping and Logistics — DHL" },
            { type: "p", text: "We use DHL services for deliveries. Therefore, it is necessary for us to share your name, address and place of residence with DHL. DHL will only use this data for the performance of the contract." },
            { type: "h3", text: "Invoicing and Bookkeeping — MoneyBird" },
            { type: "p", text: "We use MoneyBird services for our administration and bookkeeping. Your personal data is transmitted and stored in a protected manner. MoneyBird is bound by confidentiality and will treat your data with confidence." },
            { type: "h2", text: "Purpose of Data Processing" },
            { type: "h3", text: "General Purpose of Processing" },
            { type: "p", text: "We use your data exclusively for the purpose of providing our services. This means the purpose of processing is always directly related to the assignment you give us. We do not use your data for (targeted) marketing. Your data will not be shared with third parties unless necessary for the fulfilment of bookkeeping and other administrative obligations." },
            { type: "h3", text: "Automatically Collected Data" },
            { type: "p", text: "Data automatically collected by our website is processed with the aim of further improving our services. This data (e.g. your IP address, web browser and operating system) is not personal data." },
            { type: "h3", text: "Cooperation in Tax and Criminal Investigations" },
            { type: "p", text: "GreenResults OÜ may in certain cases be legally obliged to share your data in connection with tax or criminal investigations by the authorities." },
            { type: "h2", text: "Retention Periods" },
            { type: "p", text: "We retain your data for as long as you are a customer with us. When you inform us that you no longer wish to use our services, we treat this as a request to be forgotten. Under applicable administrative obligations, we are required to retain invoices containing your data." },
            { type: "h2", text: "Your Rights" },
            { type: "p", text: "Under applicable Dutch and European legislation, as a data subject you have certain rights in relation to the personal data we process. You always have the right to file a complaint with the supervisory authority." },
            { type: "h3", text: "Right of Access" },
            { type: "p", text: "You always have the right to access the data we process about you." },
            { type: "h3", text: "Right to Rectification" },
            { type: "p", text: "You always have the right to have the data we process about you amended." },
            { type: "h3", text: "Right to Restriction of Processing" },
            { type: "p", text: "You always have the right to have the processing of your data restricted." },
            { type: "h3", text: "Right to Data Portability" },
            { type: "p", text: "You always have the right to have the data we process about you carried out by another party." },
            { type: "h3", text: "Right to Object" },
            { type: "p", text: "You have the right to object to the processing of your personal data by GreenResults OÜ." },
            { type: "h2", text: "Cookies" },
            { type: "h3", text: "Google Analytics" },
            { type: "p", text: "Cookies from Google are placed via our website as part of the 'Analytics' service. We use this service to track and receive reports on how visitors use the website." },
            { type: "h3", text: "Third-Party Cookies" },
            { type: "p", text: "In the event that third-party software solutions use cookies, this will be indicated in this privacy policy." },
            { type: "h2", text: "Changes to the Privacy Policy" },
            { type: "p", text: "We reserve the right to change our privacy policy at any time. On this page you will always find the most recent version." },
            { type: "h2", text: "Contact Details" },
            { type: "p", text: "GreenResults OÜ · Tornimäe 3, 10145 Tallinn, Estonia · T: (062) 441-4138 · E: thomas@dutchgreenalternative.com" },
            { type: "p", text: "Data Protection Contact: Thomas Sondermeijer" },
        ],
    },
};

export default async function PrivacyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const c = content[locale];

    return (
        <main className={styles.legal}>
            <div className={styles.legalInner}>
                <h1 className={styles.legalTitle}>{c.title}</h1>
                <p className={styles.legalSubtitle}>{c.lastUpdated}</p>

                <div className={styles.legalContent}>
                    {c.sections.map((s, i) => {
                        if (s.type === "h2") return <h2 key={i}>{s.text}</h2>;
                        if (s.type === "h3") return <h3 key={i}>{s.text}</h3>;
                        return <p key={i}>{s.text}</p>;
                    })}
                </div>
            </div>
        </main>
    );
}
