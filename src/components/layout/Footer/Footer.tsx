import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { i18n } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./Footer.module.css";

type FooterProps = {
    locale: Locale;
    dict: Dictionary;
};

export function Footer({ locale, dict }: FooterProps) {
    const currentYear = new Date().getFullYear();

    const quickLinks = [
        { href: `/${locale}/shop`, label: dict.nav.shop },
        { href: `/${locale}/about`, label: dict.nav.about },
        { href: `/${locale}/blog`, label: dict.nav.blog },
        { href: `/${locale}/lab-results`, label: dict.nav.labResults },
    ];

    const serviceLinks = [
        { href: `/${locale}/faq`, label: dict.nav.faq },
        { href: `/${locale}/shipping-returns`, label: dict.nav.shippingReturns },
        { href: `/${locale}/contact`, label: dict.nav.contact },
        { href: `/${locale}/account`, label: dict.nav.account },
    ];

    return (
        <footer className={styles.footer}>
            <div className={styles.grid} style={{ maxWidth: 'var(--container-wide)', margin: '0 auto', padding: '0 var(--space-lg)' }}>
                {/* Brand Column */}
                <div className={styles.brand}>
                    <div className={styles.brandName}>
                        Dutch<span className={styles.brandAccent}>Green</span>Alternative
                    </div>
                    <p className={styles.tagline}>{dict.footer.tagline}</p>

                    {/* Trust Badges */}
                    <div className={styles.trustBadges}>
                        <div className={styles.trustBadge}>
                            <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            {dict.footer.labTested}
                        </div>
                        <div className={styles.trustBadge}>
                            <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                <line x1="1" y1="10" x2="23" y2="10" />
                            </svg>
                            {dict.footer.securePayment}
                        </div>
                    </div>
                </div>

                {/* Quick Links */}
                <div>
                    <h4 className={styles.sectionTitle}>{dict.footer.quickLinks}</h4>
                    <div className={styles.sectionLinks}>
                        {quickLinks.map((link) => (
                            <Link key={link.href} href={link.href} className={styles.sectionLink}>
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Customer Service */}
                <div>
                    <h4 className={styles.sectionTitle}>{dict.footer.customerService}</h4>
                    <div className={styles.sectionLinks}>
                        {serviceLinks.map((link) => (
                            <Link key={link.href} href={link.href} className={styles.sectionLink}>
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Language */}
                <div>
                    <h4 className={styles.sectionTitle}>{dict.footer.language}</h4>
                    <div className={styles.langSelector}>
                        {i18n.locales.map((loc) => (
                            <Link
                                key={loc}
                                href={`/${loc}`}
                                className={`${styles.langBtn} ${loc === locale ? styles.langBtnActive : ""}`}
                            >
                                {loc}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className={styles.bottom} style={{ maxWidth: 'var(--container-wide)', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg) 0' }}>
                <span className={styles.copyright}>
                    {dict.footer.copyright.replace("{year}", String(currentYear))}
                    {" "}
                    <Link href="/admin" className={styles.bottomLink} style={{ opacity: 0.4, fontSize: '0.75rem' }}>⚙</Link>
                </span>
                <div className={styles.bottomLinks}>
                    <Link href={`/${locale}/privacy`} className={styles.bottomLink}>
                        {dict.footer.privacy}
                    </Link>
                    <Link href={`/${locale}/terms`} className={styles.bottomLink}>
                        {dict.footer.terms}
                    </Link>
                </div>
            </div>
        </footer>
    );
}
