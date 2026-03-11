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
        de: "Allgemeine Geschäftsbedingungen",
        nl: "Algemene Voorwaarden",
        en: "Terms & Conditions",
    };
    return {
        title: titles[locale] || titles.de,
    };
}

// ─── Structured content per locale ─────────────────────────────────────────────

type Article = { id: string; title: string; paragraphs: string[] };

const content: Record<Locale, {
    title: string;
    lastUpdated: string;
    tocTitle: string;
    articles: Article[];
}> = {
    de: {
        title: "Allgemeine Geschäftsbedingungen",
        lastUpdated: "Letzte Aktualisierung: 03.03.2022",
        tocTitle: "Inhaltsübersicht",
        articles: [
            {
                id: "art1", title: "Artikel 1 – Begriffsbestimmungen", paragraphs: [
                    "Bedenkzeit: die Frist, innerhalb derer der Verbraucher von seinem Widerrufsrecht Gebrauch machen kann.",
                    "Verbraucher: die natürliche Person, die nicht in Ausübung eines Berufes oder Gewerbes handelt und die mit dem Unternehmer einen Fernabsatzvertrag abschließt.",
                    "Laufzeitgeschäft: ein Fernabsatzvertrag, der sich auf eine Reihe von Produkten und/oder Dienstleistungen bezieht, deren Liefer- und/oder Kaufverpflichtung über einen bestimmten Zeitraum verteilt ist.",
                    "Widerrufsrecht: die Möglichkeit für den Verbraucher, innerhalb der Bedenkzeit auf den Fernabsatzvertrag zu verzichten.",
                    "Unternehmer: die natürliche oder juristische Person, die Verbrauchern Produkte und/oder Dienstleistungen aus der Ferne anbietet.",
                    "Fernabsatzvertrag: ein Vertrag, bei dem ausschließlich Fernkommunikationstechniken eingesetzt werden.",
                ]
            },
            {
                id: "art2", title: "Artikel 2 – Identität des Unternehmers", paragraphs: [
                    "GreenResults OÜ · Tornimäe 3, 10145 Tallinn, Estonia",
                    "T: (020) 221-6195 · E: thomas@dutchgreenalternative.com · Handelskammer: 16624464 · USt-IdNr: EE102564897",
                ]
            },
            {
                id: "art3", title: "Artikel 3 – Anwendbarkeit", paragraphs: [
                    "Diese allgemeinen Geschäftsbedingungen gelten für jedes Angebot des Gewerbetreibenden und für jeden Fernabsatzvertrag und jede Bestellung, die zwischen dem Gewerbetreibenden und dem Verbraucher geschlossen wird.",
                    "Vor Abschluss des Fernabsatzvertrags wird dem Verbraucher der Text dieser allgemeinen Geschäftsbedingungen zur Verfügung gestellt. Wird der Vertrag auf elektronischem Wege geschlossen, wird der Text in elektronischer Form bereitgestellt.",
                    "Falls zusätzlich zu diesen allgemeinen Bedingungen besondere Produkt- oder Dienstleistungsbedingungen gelten, kann sich der Verbraucher im Falle widersprüchlicher Bedingungen immer auf die für ihn günstigste Bestimmung berufen.",
                ]
            },
            {
                id: "art4", title: "Artikel 4 – Das Angebot", paragraphs: [
                    "Wenn ein Angebot eine begrenzte Gültigkeitsdauer hat oder an Bedingungen geknüpft ist, wird dies ausdrücklich angegeben. Das Angebot ist freibleibend.",
                    "Das Angebot enthält eine vollständige und genaue Beschreibung der angebotenen Produkte und/oder Dienstleistungen. Offensichtliche Irrtümer oder Fehler im Angebot sind für den Unternehmer nicht bindend.",
                ]
            },
            {
                id: "art5", title: "Artikel 5 – Die Vereinbarung", paragraphs: [
                    "Der Vertrag kommt in dem Moment zustande, in dem der Verbraucher das Angebot annimmt und die darin festgelegten Bedingungen erfüllt sind.",
                    "Wenn der Verbraucher das Angebot auf elektronischem Wege angenommen hat, bestätigt der Unternehmer unverzüglich den Eingang. Solange diese Annahme nicht bestätigt wurde, kann der Verbraucher den Vertrag auflösen.",
                    "Jede Vereinbarung wird unter der aufschiebenden Bedingung einer ausreichenden Verfügbarkeit der Produkte geschlossen.",
                ]
            },
            {
                id: "art6", title: "Artikel 6 – Recht auf Widerruf", paragraphs: [
                    "Beim Kauf von Produkten hat der Verbraucher die Möglichkeit, den Vertrag innerhalb von 14 Tagen ohne Angabe von Gründen aufzulösen. Diese Widerrufsfrist beginnt am Tag nach Erhalt des Produkts.",
                    "Während der Bedenkzeit geht der Verbraucher mit dem Produkt und der Verpackung vorsichtig um. Macht er von seinem Widerrufsrecht Gebrauch, hat er das Produkt mit allem Zubehör und – soweit möglich – im Originalzustand zurückzusenden.",
                    "Bei Dienstleistungen hat der Verbraucher die Möglichkeit, den Vertrag ohne Angabe von Gründen innerhalb von mindestens 14 Tagen, beginnend mit dem Tag des Vertragsabschlusses, zu kündigen.",
                ]
            },
            {
                id: "art7", title: "Artikel 7 – Kosten im Falle des Rücktritts", paragraphs: [
                    "Macht der Verbraucher von seinem Widerrufsrecht Gebrauch, so hat er lediglich die Kosten der Rücksendung zu tragen.",
                    "Die Erstattung erfolgt so schnell wie möglich, spätestens innerhalb von 14 Tagen nach dem Widerruf, über dieselbe Zahlungsmethode.",
                ]
            },
            {
                id: "art8", title: "Artikel 8 – Ausschluss des Widerrufsrechts", paragraphs: [
                    "Der Ausschluss des Widerrufsrechts ist nur gültig, wenn der Gewerbetreibende dies rechtzeitig vor Vertragsabschluss deutlich gemacht hat.",
                    "Der Ausschluss ist möglich für: nach Vorgabe des Verbrauchers erstellte Produkte, Produkte persönlicher Natur, schnell verderbliche Produkte, entsiegelte Hygieneprodukte, entsiegelte Audio-/Video-/Softwareträger.",
                ]
            },
            {
                id: "art9", title: "Artikel 9 – Der Preis", paragraphs: [
                    "Während der Gültigkeitsdauer des Angebots werden die Preise nicht erhöht, außer bei Änderungen der Mehrwertsteuersätze.",
                    "Die Preise enthalten die Mehrwertsteuer. Alle Preise sind vorbehaltlich von Druckfehlern und Irrtümern.",
                ]
            },
            {
                id: "art10", title: "Artikel 10 – Konformität und Garantie", paragraphs: [
                    "Der Gewerbetreibende garantiert, dass die Produkte dem Vertrag und den geltenden gesetzlichen Bestimmungen entsprechen.",
                    "Mängel oder fehlerhaft gelieferte Produkte sind innerhalb von 2 Monaten nach Lieferung schriftlich mitzuteilen.",
                ]
            },
            {
                id: "art11", title: "Artikel 11 – Lieferung und Durchführung", paragraphs: [
                    "Der Unternehmer führt angenommene Bestellungen zügig, aber nicht später als 30 Tage aus. Verzögert sich die Lieferung, hat der Verbraucher das Recht, den Vertrag kostenlos aufzulösen.",
                    "Das Risiko der Beschädigung und/oder des Verlusts von Produkten liegt beim Unternehmer bis zum Zeitpunkt der Übergabe.",
                ]
            },
            {
                id: "art12", title: "Artikel 12 – Laufzeitgeschäfte: Dauer, Beendigung und Verlängerung", paragraphs: [
                    "Der Verbraucher hat jederzeit das Recht, einen unbefristeten Vertrag unter Einhaltung einer Kündigungsfrist von höchstens einem Monat zu kündigen.",
                    "Ein befristeter Vertrag kann nicht stillschweigend verlängert werden.",
                    "Dauert ein Vertrag länger als ein Jahr, kann der Verbraucher nach Ablauf eines Jahres jederzeit mit einer Frist von einem Monat kündigen.",
                ]
            },
            {
                id: "art13", title: "Artikel 13 – Zahlung", paragraphs: [
                    "Die vom Verbraucher zu zahlenden Beträge sind innerhalb von 7 Werktagen nach Beginn der Bedenkzeit zu zahlen.",
                    "Im Falle der Nichtzahlung ist der Unternehmer berechtigt, dem Verbraucher alle angemessenen Kosten in Rechnung zu stellen.",
                ]
            },
            {
                id: "art14", title: "Artikel 14 – Beschwerdeverfahren", paragraphs: [
                    "Beschwerden über die Durchführung des Vertrages müssen innerhalb von 2 Monaten vollständig und klar beschrieben dem Unternehmer vorgelegt werden.",
                    "Beschwerden werden innerhalb von 14 Tagen beantwortet. Wird eine Reklamation für berechtigt befunden, werden die Produkte kostenlos ersetzt oder repariert.",
                ]
            },
            {
                id: "art15", title: "Artikel 15 – Streitigkeiten", paragraphs: [
                    "Auf Verträge zwischen dem Unternehmer und dem Verbraucher ist ausschließlich niederländisches Recht anwendbar. Das Wiener Kaufrechtsübereinkommen ist nicht anwendbar.",
                ]
            },
            {
                id: "art16", title: "Artikel 16 – Zusätzliche oder abweichende Bestimmungen", paragraphs: [
                    "Zusätzliche oder abweichende Bestimmungen dürfen dem Verbraucher nicht zum Nachteil gereichen und sollten schriftlich festgehalten werden.",
                ]
            },
            {
                id: "art17", title: "Artikel 17 – Abonnement", paragraphs: [
                    "1. Angebot und Annahme: Mit der Bestellung des kostenlosen Produkts akzeptiert der Kunde die AGB und erklärt sich einverstanden, nach einem Monat eine neue Flasche CBD-Öl zum vereinbarten Preis zu erhalten.",
                    "2. Automatische Erneuerung: Das Abonnement verlängert sich automatisch, es sei denn, der Kunde kündigt. Der Kunde wird per E-Mail über die bevorstehende Verlängerung informiert.",
                    "3. Recht auf Kündigung: Der Kunde hat das Recht, das Abonnement jederzeit zu kündigen oder zu pausieren. Die Kündigung wird sofort wirksam.",
                    "4. Nicht rückgabefähige Abonnementprodukte: Abonnementprodukte können nach dem Versand nicht zurückgegeben werden, es sei denn, das Produkt ist defekt. Probleme sind innerhalb von 14 Tagen zu melden.",
                    "Diese Bedingungen stehen im Einklang mit den EU-Rechtsvorschriften, einschließlich der EU-Richtlinie 2011/83/EU und der DSGVO (EU) 2016/679.",
                ]
            },
        ],
    },
    nl: {
        title: "Algemene Voorwaarden",
        lastUpdated: "Laatst bijgewerkt: 03-03-2022",
        tocTitle: "Inhoudsopgave",
        articles: [
            {
                id: "art1", title: "Artikel 1 – Definities", paragraphs: [
                    "Bedenktijd: de termijn waarbinnen de consument gebruik kan maken van zijn herroepingsrecht.",
                    "Consument: de natuurlijke persoon die niet handelt in de uitoefening van een beroep of bedrijf en een overeenkomst op afstand aangaat met de ondernemer.",
                    "Duurtransactie: een overeenkomst op afstand met betrekking tot een reeks producten en/of diensten, waarvan de leverings- en/of afnameverplichting over een bepaalde periode is verspreid.",
                    "Herroepingsrecht: de mogelijkheid voor de consument om binnen de bedenktijd af te zien van de overeenkomst op afstand.",
                    "Ondernemer: de natuurlijke of rechtspersoon die producten en/of diensten op afstand aan consumenten aanbiedt.",
                    "Overeenkomst op afstand: een overeenkomst waarbij uitsluitend gebruik wordt gemaakt van technieken voor communicatie op afstand.",
                ]
            },
            {
                id: "art2", title: "Artikel 2 – Identiteit van de ondernemer", paragraphs: [
                    "GreenResults OÜ · Tornimäe 3, 10145 Tallinn, Estonia",
                    "T: (020) 221-6195 · E: thomas@dutchgreenalternative.com · KvK: 16624464 · BTW-nr: EE102564897",
                ]
            },
            {
                id: "art3", title: "Artikel 3 – Toepasselijkheid", paragraphs: [
                    "Deze algemene voorwaarden zijn van toepassing op elk aanbod van de ondernemer en op elke overeenkomst op afstand en bestelling tussen ondernemer en consument.",
                    "Voordat de overeenkomst op afstand wordt gesloten, wordt de tekst van deze algemene voorwaarden aan de consument beschikbaar gesteld. Indien elektronisch gesloten, wordt de tekst in elektronische vorm verstrekt.",
                    "Indien naast deze algemene voorwaarden ook specifieke product- of dienstenvoorwaarden van toepassing zijn, kan de consument zich bij tegenstrijdigheid altijd beroepen op de voor hem meest gunstige bepaling.",
                ]
            },
            {
                id: "art4", title: "Artikel 4 – Het aanbod", paragraphs: [
                    "Indien een aanbod een beperkte geldigheidsduur heeft of onder voorwaarden geschiedt, wordt dit uitdrukkelijk vermeld. Het aanbod is vrijblijvend.",
                    "Het aanbod bevat een volledige en nauwkeurige omschrijving van de aangeboden producten en/of diensten. Kennelijke vergissingen of fouten in het aanbod binden de ondernemer niet.",
                ]
            },
            {
                id: "art5", title: "Artikel 5 – De overeenkomst", paragraphs: [
                    "De overeenkomst komt tot stand op het moment dat de consument het aanbod aanvaardt en aan de daarbij gestelde voorwaarden is voldaan.",
                    "Indien de consument het aanbod langs elektronische weg heeft aanvaard, bevestigt de ondernemer onverwijld de ontvangst. Zolang de aanvaarding niet is bevestigd, kan de consument de overeenkomst ontbinden.",
                    "Iedere overeenkomst wordt aangegaan onder de opschortende voorwaarde van voldoende beschikbaarheid van de producten.",
                ]
            },
            {
                id: "art6", title: "Artikel 6 – Herroepingsrecht", paragraphs: [
                    "Bij de aankoop van producten heeft de consument de mogelijkheid de overeenkomst zonder opgave van redenen te ontbinden gedurende 14 dagen. Deze bedenktijd gaat in op de dag na ontvangst van het product.",
                    "Tijdens de bedenktijd gaat de consument zorgvuldig om met het product en de verpakking. Bij gebruikmaking van het herroepingsrecht retourneert hij het product met alle toebehoren en – indien mogelijk – in originele staat en verpakking.",
                    "Bij diensten heeft de consument de mogelijkheid de overeenkomst zonder opgave van redenen te ontbinden gedurende ten minste 14 dagen, ingaande op de dag van het aangaan van de overeenkomst.",
                ]
            },
            {
                id: "art7", title: "Artikel 7 – Kosten in geval van herroeping", paragraphs: [
                    "Indien de consument gebruikmaakt van zijn herroepingsrecht, betaalt hij enkel de kosten van terugzending.",
                    "Terugbetaling vindt zo snel mogelijk plaats, uiterlijk binnen 14 dagen na herroeping, via dezelfde betaalmethode.",
                ]
            },
            {
                id: "art8", title: "Artikel 8 – Uitsluiting herroepingsrecht", paragraphs: [
                    "De uitsluiting is alleen geldig indien de ondernemer dit tijdig voor het sluiten van de overeenkomst duidelijk heeft gemaakt.",
                    "Uitsluiting is mogelijk voor: op specificatie van de consument vervaardigde producten, producten van persoonlijke aard, snel bederfelijke producten, ontzegelde hygiëneproducten, ontzegelde audio-/video-/softwaredragers.",
                ]
            },
            {
                id: "art9", title: "Artikel 9 – De prijs", paragraphs: [
                    "Gedurende de geldigheidsduur van het aanbod worden de prijzen niet verhoogd, behoudens wijziging van btw-tarieven.",
                    "Alle prijzen zijn inclusief btw. Alle prijzen zijn onder voorbehoud van druk- en zetfouten.",
                ]
            },
            {
                id: "art10", title: "Artikel 10 – Conformiteit en garantie", paragraphs: [
                    "De ondernemer garandeert dat de producten voldoen aan de overeenkomst en de geldende wettelijke bepalingen.",
                    "Eventuele gebreken of verkeerd geleverde producten moeten binnen 2 maanden na levering schriftelijk worden gemeld.",
                ]
            },
            {
                id: "art11", title: "Artikel 11 – Levering en uitvoering", paragraphs: [
                    "De ondernemer voert aanvaarde bestellingen met bekwame spoed uit, maar uiterlijk binnen 30 dagen. Bij vertraging heeft de consument het recht de overeenkomst kosteloos te ontbinden.",
                    "Het risico van beschadiging en/of vermissing van producten berust bij de ondernemer tot het moment van bezorging.",
                ]
            },
            {
                id: "art12", title: "Artikel 12 – Duurtransacties: duur, opzegging en verlenging", paragraphs: [
                    "De consument kan een overeenkomst voor onbepaalde tijd te allen tijde opzeggen met inachtneming van een opzegtermijn van ten hoogste één maand.",
                    "Een overeenkomst voor bepaalde tijd kan niet stilzwijgend worden verlengd.",
                    "Duurt een overeenkomst langer dan een jaar, dan kan de consument na afloop van een jaar te allen tijde opzeggen met een termijn van ten hoogste één maand.",
                ]
            },
            {
                id: "art13", title: "Artikel 13 – Betaling", paragraphs: [
                    "De door de consument verschuldigde bedragen dienen binnen 7 werkdagen na het ingaan van de bedenktijd te worden voldaan.",
                    "Bij niet-betaling is de ondernemer gerechtigd de consument alle redelijke kosten in rekening te brengen.",
                ]
            },
            {
                id: "art14", title: "Artikel 14 – Klachtenprocedure", paragraphs: [
                    "Klachten over de uitvoering van de overeenkomst moeten binnen 2 maanden volledig en duidelijk omschreven worden ingediend bij de ondernemer.",
                    "Klachten worden binnen 14 dagen beantwoord. Indien een klacht gegrond wordt bevonden, worden de producten kosteloos vervangen of gerepareerd.",
                ]
            },
            {
                id: "art15", title: "Artikel 15 – Geschillen", paragraphs: [
                    "Op overeenkomsten tussen de ondernemer en de consument is uitsluitend Nederlands recht van toepassing. Het Weens Koopverdrag is niet van toepassing.",
                ]
            },
            {
                id: "art16", title: "Artikel 16 – Aanvullende of afwijkende bepalingen", paragraphs: [
                    "Aanvullende of afwijkende bepalingen mogen niet ten nadele van de consument zijn en dienen schriftelijk te worden vastgelegd.",
                ]
            },
            {
                id: "art17", title: "Artikel 17 – Abonnement", paragraphs: [
                    "1. Aanbod en aanvaarding: Door het bestellen van het gratis product accepteert de klant de Algemene Voorwaarden en stemt ermee in na een maand een nieuwe fles CBD-olie te ontvangen tegen de afgesproken prijs.",
                    "2. Automatische verlenging: Het abonnement wordt automatisch verlengd, tenzij de klant opzegt. De klant wordt per e-mail geïnformeerd over de naderende verlenging.",
                    "3. Recht op opzegging: De klant heeft het recht het abonnement op elk moment op te zeggen of te pauzeren. De opzegging wordt onmiddellijk van kracht.",
                    "4. Niet-retourneerbare abonnementsproducten: Abonnementsproducten kunnen na verzending niet worden geretourneerd, tenzij het product defect is. Problemen dienen binnen 14 dagen te worden gemeld.",
                    "Deze voorwaarden zijn in overeenstemming met de EU-wetgeving, waaronder EU-richtlijn 2011/83/EU en de AVG (EU) 2016/679.",
                ]
            },
        ],
    },
    en: {
        title: "Terms & Conditions",
        lastUpdated: "Last updated: March 3, 2022",
        tocTitle: "Table of Contents",
        articles: [
            {
                id: "art1", title: "Article 1 – Definitions", paragraphs: [
                    "Cooling-off period: the period within which the consumer may exercise their right of withdrawal.",
                    "Consumer: the natural person who is not acting in the exercise of a profession or business and who enters into a distance contract with the entrepreneur.",
                    "Duration transaction: a distance contract relating to a series of products and/or services, the supply and/or purchase obligation of which is spread over a period of time.",
                    "Right of withdrawal: the option for the consumer to waive the distance contract within the cooling-off period.",
                    "Entrepreneur: the natural or legal person who offers products and/or services to consumers at a distance.",
                    "Distance contract: a contract in which exclusively one or more distance communication techniques are used.",
                ]
            },
            {
                id: "art2", title: "Article 2 – Identity of the Entrepreneur", paragraphs: [
                    "GreenResults OÜ · Tornimäe 3, 10145 Tallinn, Estonia",
                    "T: (020) 221-6195 · E: thomas@dutchgreenalternative.com · Chamber of Commerce: 16624464 · VAT: EE102564897",
                ]
            },
            {
                id: "art3", title: "Article 3 – Applicability", paragraphs: [
                    "These general terms and conditions apply to every offer by the entrepreneur and to every distance contract and order concluded between the entrepreneur and the consumer.",
                    "Before the distance contract is concluded, the text of these general terms and conditions shall be made available to the consumer. If concluded electronically, the text is provided in electronic form.",
                    "If specific product or service conditions also apply in addition to these general terms and conditions, the consumer may always invoke the provision that is most favourable to them in the event of conflicting conditions.",
                ]
            },
            {
                id: "art4", title: "Article 4 – The Offer", paragraphs: [
                    "If an offer has a limited period of validity or is subject to conditions, this shall be expressly stated. The offer is without obligation.",
                    "The offer contains a complete and accurate description of the products and/or services offered. Obvious errors or mistakes in the offer are not binding on the entrepreneur.",
                ]
            },
            {
                id: "art5", title: "Article 5 – The Agreement", paragraphs: [
                    "The contract is concluded at the moment the consumer accepts the offer and the conditions set therein are met.",
                    "If the consumer has accepted the offer electronically, the entrepreneur shall immediately confirm receipt. As long as this acceptance has not been confirmed, the consumer may dissolve the contract.",
                    "Each agreement is entered into under the condition of sufficient availability of the products concerned.",
                ]
            },
            {
                id: "art6", title: "Article 6 – Right of Withdrawal", paragraphs: [
                    "When purchasing products, the consumer has the option to dissolve the contract without giving reasons within 14 days. This cooling-off period starts on the day after receipt of the product.",
                    "During the cooling-off period, the consumer shall handle the product and packaging with care. If they exercise their right of withdrawal, they shall return the product with all accessories and – if possible – in its original condition and packaging.",
                    "For services, the consumer has the option to cancel the contract without giving reasons within at least 14 days from the date of concluding the contract.",
                ]
            },
            {
                id: "art7", title: "Article 7 – Costs in Case of Withdrawal", paragraphs: [
                    "If the consumer exercises their right of withdrawal, they shall only bear the costs of returning the product.",
                    "Refund shall take place as soon as possible, but no later than 14 days after withdrawal, via the same payment method.",
                ]
            },
            {
                id: "art8", title: "Article 8 – Exclusion of the Right of Withdrawal", paragraphs: [
                    "The exclusion is only valid if the entrepreneur has made this clear in good time before the conclusion of the agreement.",
                    "Exclusion is possible for: products manufactured to the consumer's specifications, products of a personal nature, perishable products, unsealed hygiene products, unsealed audio/video/software carriers.",
                ]
            },
            {
                id: "art9", title: "Article 9 – The Price", paragraphs: [
                    "During the period of validity of the offer, prices of products shall not be increased, except for price changes due to changes in VAT rates.",
                    "All prices include VAT. All prices are subject to printing and typographical errors.",
                ]
            },
            {
                id: "art10", title: "Article 10 – Conformity and Warranty", paragraphs: [
                    "The entrepreneur guarantees that the products comply with the agreement and the applicable legal provisions.",
                    "Any defects or incorrectly delivered products must be reported in writing to the entrepreneur within 2 months of delivery.",
                ]
            },
            {
                id: "art11", title: "Article 11 – Delivery and Execution", paragraphs: [
                    "The entrepreneur shall execute accepted orders with all due speed but no later than 30 days. If delivery is delayed, the consumer has the right to dissolve the contract free of charge.",
                    "The risk of damage and/or loss of products lies with the entrepreneur until the moment of delivery.",
                ]
            },
            {
                id: "art12", title: "Article 12 – Duration Transactions: Duration, Termination and Extension", paragraphs: [
                    "The consumer may terminate an open-ended contract at any time, subject to a notice period of no more than one month.",
                    "A fixed-term contract may not be tacitly extended.",
                    "If a contract lasts longer than one year, the consumer may terminate it at any time after the first year with a notice period of no more than one month.",
                ]
            },
            {
                id: "art13", title: "Article 13 – Payment", paragraphs: [
                    "Amounts owed by the consumer must be paid within 7 working days of the start of the cooling-off period.",
                    "In case of non-payment, the entrepreneur is entitled to charge the consumer all reasonable costs.",
                ]
            },
            {
                id: "art14", title: "Article 14 – Complaints Procedure", paragraphs: [
                    "Complaints about the performance of the agreement must be submitted to the entrepreneur fully and clearly described within 2 months.",
                    "Complaints will be answered within 14 days. If a complaint is found to be justified, the products will be replaced or repaired free of charge.",
                ]
            },
            {
                id: "art15", title: "Article 15 – Disputes", paragraphs: [
                    "Contracts between the entrepreneur and the consumer are exclusively governed by Dutch law. The United Nations Convention on Contracts for the International Sale of Goods does not apply.",
                ]
            },
            {
                id: "art16", title: "Article 16 – Additional or Deviating Provisions", paragraphs: [
                    "Additional or deviating provisions may not be to the detriment of the consumer and should be recorded in writing.",
                ]
            },
            {
                id: "art17", title: "Article 17 – Subscription", paragraphs: [
                    "1. Offer and acceptance: By ordering the free product, the customer accepts the General Terms and Conditions and agrees to receive a new bottle of CBD oil at the agreed price after one month.",
                    "2. Automatic renewal: The subscription renews automatically unless the customer cancels. The customer will be informed by email of the upcoming renewal.",
                    "3. Right to cancel: The customer has the right to cancel or pause the subscription at any time. Cancellation takes effect immediately.",
                    "4. Non-returnable subscription products: Subscription products cannot be returned after dispatch unless the product is defective. Issues must be reported within 14 days.",
                    "These terms are in accordance with EU legislation, including EU Directive 2011/83/EU and the GDPR (EU) 2016/679.",
                ]
            },
        ],
    },
};

export default async function TermsPage({
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

                {/* Table of Contents */}
                <div className={styles.toc}>
                    <p className={styles.tocTitle}>{c.tocTitle}</p>
                    <ol>
                        {c.articles.map((art) => (
                            <li key={art.id}>
                                <a href={`#${art.id}`}>{art.title}</a>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className={styles.legalContent}>
                    {c.articles.map((art) => (
                        <div key={art.id}>
                            <h2 id={art.id}>{art.title}</h2>
                            {art.paragraphs.map((p, i) => (
                                <p key={i}>{p}</p>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
