/**
 * Unsubscribe copy, in the three languages the newsletter goes out in.
 *
 * Deliberately short and free of retention arguments: someone who reached this
 * page has already decided, and a page that argues with them is the reason
 * people press "mark as spam" instead.
 */
export type UnsubscribeCopy = {
    title: string;
    /** Contains the literal placeholder {email}. */
    intro: string;
    confirm: string;
    working: string;
    doneTitle: string;
    doneBody: string;
    stillTransactional: string;
    invalidTitle: string;
    invalidBody: string;
    manualPrompt: string;
    emailLabel: string;
    error: string;
    backToShop: string;
};

export const COPY: Record<string, UnsubscribeCopy> = {
    de: {
        title: "Newsletter abmelden",
        intro: "Möchten Sie {email} von unserem Newsletter abmelden?",
        confirm: "Abmeldung bestätigen",
        working: "Wird abgemeldet …",
        doneTitle: "Sie sind abgemeldet",
        doneBody: "Sie erhalten von uns keine Newsletter mehr. Das gilt ab sofort.",
        stillTransactional: "E-Mails zu Ihren Bestellungen (Bestellbestätigung, Versand, Rechnung) erhalten Sie weiterhin.",
        invalidTitle: "Dieser Link ist nicht mehr gültig",
        invalidBody: "Der Abmeldelink ist unvollständig oder abgelaufen.",
        manualPrompt: "Geben Sie Ihre E-Mail-Adresse ein und wir melden Sie ab:",
        emailLabel: "E-Mail-Adresse",
        error: "Das hat nicht geklappt. Bitte versuchen Sie es erneut oder schreiben Sie an info@dutchgreenalternative.nl.",
        backToShop: "Zurück zum Shop",
    },
    nl: {
        title: "Nieuwsbrief opzeggen",
        intro: "Wilt u {email} afmelden voor onze nieuwsbrief?",
        confirm: "Afmelding bevestigen",
        working: "Bezig met afmelden …",
        doneTitle: "U bent afgemeld",
        doneBody: "U ontvangt geen nieuwsbrieven meer van ons. Dit gaat direct in.",
        stillTransactional: "E-mails over uw bestellingen (bevestiging, verzending, factuur) blijft u ontvangen.",
        invalidTitle: "Deze link is niet meer geldig",
        invalidBody: "De afmeldlink is onvolledig of verlopen.",
        manualPrompt: "Vul uw e-mailadres in, dan melden wij u af:",
        emailLabel: "E-mailadres",
        error: "Dat is niet gelukt. Probeer het opnieuw of mail naar info@dutchgreenalternative.nl.",
        backToShop: "Terug naar de shop",
    },
    en: {
        title: "Unsubscribe",
        intro: "Would you like to unsubscribe {email} from our newsletter?",
        confirm: "Confirm unsubscribe",
        working: "Unsubscribing …",
        doneTitle: "You're unsubscribed",
        doneBody: "You won't receive any more newsletters from us. This takes effect immediately.",
        stillTransactional: "You'll still get emails about your orders — confirmations, shipping and invoices.",
        invalidTitle: "This link is no longer valid",
        invalidBody: "The unsubscribe link is incomplete or has expired.",
        manualPrompt: "Enter your email address and we'll unsubscribe you:",
        emailLabel: "Email address",
        error: "That didn't work. Please try again, or email info@dutchgreenalternative.nl.",
        backToShop: "Back to the shop",
    },
};
