import { i18n, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/Container/Container";
import { ReviewForm } from "./_components/ReviewForm";

export default async function ReviewPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ token?: string }>;
}) {
    const { locale: rawLocale } = await params;
    const { token } = await searchParams;
    const locale = (i18n.locales.includes(rawLocale as Locale) ? rawLocale : i18n.defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return (
        <main style={{ padding: "3rem 0 4rem", minHeight: "60vh" }}>
            <Container>
                <ReviewForm locale={locale} dict={dict} token={token || ""} />
            </Container>
        </main>
    );
}
