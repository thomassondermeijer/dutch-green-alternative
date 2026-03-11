"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./admin.module.css";

const navItems = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/products", label: "Products", icon: "📦" },
    { href: "/admin/orders", label: "Orders", icon: "🧾" },
    { href: "/admin/invoices", label: "Invoices", icon: "📄" },
    { href: "/admin/coupons", label: "Coupons", icon: "🏷️" },
    { href: "/admin/customers", label: "Customers", icon: "👥" },
    { href: "/admin/blog", label: "Blog", icon: "✍️" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    return (
        <div className={styles.adminLayout}>
            <aside className={styles.sidebar}>
                <h2 className={styles.sidebarTitle}>
                    DGA <span>Admin</span>
                </h2>
                <nav className={styles.sidebarNav}>
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.sidebarLink} ${pathname === item.href ? styles.sidebarLinkActive : ""
                                }`}
                        >
                            {item.icon} {item.label}
                        </Link>
                    ))}
                </nav>
            </aside>
            <main className={styles.main}>{children}</main>
        </div>
    );
}
