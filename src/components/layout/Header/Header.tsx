"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { i18n } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useCart } from "@/lib/cart/cart-context";
import styles from "./Header.module.css";

type HeaderProps = {
    locale: Locale;
    dict: Dictionary;
};

export function Header({ locale, dict }: HeaderProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [megaMenuOpen, setMegaMenuOpen] = useState<string | null>(null);
    const lastScrollY = useRef(0);
    const pathname = usePathname();
    const { itemCount, toggleDrawer } = useCart();
    const megaMenuTimeout = useRef<NodeJS.Timeout | null>(null);

    // Progressive reveal: hide on scroll down, show on scroll up
    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            setScrolled(currentY > 20);

            if (currentY > lastScrollY.current && currentY > 200) {
                setHidden(true);
                setMegaMenuOpen(null);
            } else {
                setHidden(false);
            }
            lastScrollY.current = currentY;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
        setMegaMenuOpen(null);
    }, [pathname]);

    const getLocalePath = (targetLocale: string) => {
        const segments = pathname.split("/");
        segments[1] = targetLocale;
        const basePath = segments.join("/");
        // Preserve query params (e.g. ?token=xxx on review page)
        const search = typeof window !== "undefined" ? window.location.search : "";
        return basePath + search;
    };

    const handleMegaEnter = (key: string) => {
        if (megaMenuTimeout.current) clearTimeout(megaMenuTimeout.current);
        setMegaMenuOpen(key);
    };

    const handleMegaLeave = () => {
        megaMenuTimeout.current = setTimeout(() => setMegaMenuOpen(null), 200);
    };

    // Product categories for mega menu
    const shopCategories = {
        raw: {
            label: "RAW CBD & CBG",
            items: [
                { name: "CBD Öl 5,5%", slug: "cbd-raw-5-5" },
                { name: "CBD Öl 11%", slug: "cbd-raw-11" },
                { name: "CBD Gold 35%", slug: "cbd-gold-35" },
                { name: "Golden Spectrum 35%", slug: "golden-spectrum-35" },
                { name: "CBG Öl 12%", slug: "cbg-raw-12" },
            ],
        },
        pure: {
            label: "Pure Formula+",
            items: [
                { name: "Mind Comfort 8%", slug: "mind-comfort-8" },
                { name: "Good Night 8%", slug: "good-night-8" },
                { name: "Body Harmony 8%", slug: "body-harmony-8" },
            ],
        },
    };

    const navLinks = [
        { href: `/${locale}/about`, label: dict.nav.about },
        { href: `/${locale}/blog`, label: dict.nav.blog },
        { href: `/${locale}/faq`, label: dict.nav.faq },
        { href: `/${locale}/contact`, label: dict.nav.contact },
    ];

    const headerClasses = [
        styles.header,
        scrolled ? styles.scrolled : "",
        hidden ? styles.hidden : "",
        megaMenuOpen ? styles.megaOpen : "",
    ].filter(Boolean).join(" ");

    return (
        <header className={headerClasses}>
            <div className={styles.inner}>
                {/* Logo */}
                <div className={styles.logo}>
                    <Link href={`/${locale}`}>
                        <Image
                            src="https://xburabmzlolrnywcyxwz.supabase.co/storage/v1/object/public/DGA/7b916501f07e951077f90984c3584bfd_1773127181_8txf1jx1%20(1).jpg"
                            alt="Dutch Green Alternative"
                            width={160}
                            height={48}
                            priority
                            className={styles.logoImg}
                        />
                    </Link>
                </div>

                {/* Desktop Navigation */}
                <nav className={styles.nav}>
                    {/* Shop with mega menu */}
                    <div
                        className={styles.navItemWithMega}
                        onMouseEnter={() => handleMegaEnter("shop")}
                        onMouseLeave={handleMegaLeave}
                    >
                        <Link href={`/${locale}/shop`} className={`${styles.navLink} ${megaMenuOpen === "shop" ? styles.navLinkActive : ""}`}>
                            {dict.nav.shop}
                            <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 5l3 3 3-3" />
                            </svg>
                        </Link>

                        {/* Mega Menu Dropdown */}
                        <div className={`${styles.megaMenu} ${megaMenuOpen === "shop" ? styles.megaMenuVisible : ""}`}>
                            <div className={styles.megaInner}>
                                {Object.entries(shopCategories).map(([key, cat]) => (
                                    <div key={key} className={styles.megaColumn}>
                                        <span className={styles.megaColumnTitle}>{cat.label}</span>
                                        {cat.items.map((item) => (
                                            <Link
                                                key={item.slug}
                                                href={`/${locale}/shop/${item.slug}`}
                                                className={styles.megaLink}
                                            >
                                                {item.name}
                                            </Link>
                                        ))}
                                    </div>
                                ))}
                                <div className={styles.megaPromo}>
                                    <div className={styles.megaPromoContent}>
                                        <span className={styles.megaPromoLabel}>{dict.nav.bestseller}</span>
                                        <h4 className={styles.megaPromoTitle}>Golden Spectrum 35%</h4>
                                        <p className={styles.megaPromoDesc}>{dict.nav.promoDesc}</p>
                                        <Link href={`/${locale}/shop/golden-spectrum-35`} className={styles.megaPromoCta}>
                                            {dict.nav.promoCta}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {navLinks.map((link) => (
                        <Link key={link.href} href={link.href} className={styles.navLink}>
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Actions */}
                <div className={styles.actions}>
                    {/* Language Switcher */}
                    <div className={styles.langSwitcher}>
                        {i18n.locales.map((loc) => (
                            <Link
                                key={loc}
                                href={getLocalePath(loc)}
                                className={`${styles.langBtn} ${loc === locale ? styles.langBtnActive : ""}`}
                            >
                                {loc}
                            </Link>
                        ))}
                    </div>

                    {/* Account Link */}
                    <Link href={`/${locale}/account`} className={styles.actionBtn} aria-label={dict.nav.account}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </Link>

                    {/* Cart Button */}
                    <button onClick={toggleDrawer} className={styles.actionBtn} aria-label={dict.nav.cart}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 01-8 0" />
                        </svg>
                        {itemCount > 0 && (
                            <span className={styles.cartBadge}>{itemCount}</span>
                        )}
                    </button>

                    {/* Mobile Menu Toggle */}
                    <button
                        className={`${styles.menuToggle} ${mobileMenuOpen ? styles.menuToggleActive : ""}`}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Menu"
                        aria-expanded={mobileMenuOpen}
                    >
                        <span className={styles.menuBar} />
                        <span className={styles.menuBar} />
                        <span className={styles.menuBar} />
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ""}`}>
                <div className={styles.mobileMenuInner}>
                    <Link
                        href={`/${locale}/shop`}
                        className={styles.mobileNavLink}
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        {dict.nav.shop}
                    </Link>
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={styles.mobileNavLink}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <Link
                        href={`/${locale}/account`}
                        className={styles.mobileNavLink}
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        {dict.nav.account}
                    </Link>

                    {/* Mobile Language Switcher */}
                    <div className={styles.mobileLangSwitcher}>
                        {i18n.locales.map((loc) => (
                            <Link
                                key={loc}
                                href={getLocalePath(loc)}
                                className={`${styles.langBtn} ${loc === locale ? styles.langBtnActive : ""}`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {loc}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </header>
    );
}
