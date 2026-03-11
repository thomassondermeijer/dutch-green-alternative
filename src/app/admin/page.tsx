import Link from "next/link";
import styles from "./admin.module.css";

export default function AdminDashboard() {
    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Dashboard</h1>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                {[
                    { label: "Products", count: "8", icon: "📦", href: "/admin/products" },
                    { label: "Orders", count: "0", icon: "🧾", href: "/admin/orders" },
                    { label: "Customers", count: "0", icon: "👥", href: "/admin/customers" },
                    { label: "Coupons", count: "0", icon: "🏷️", href: "/admin/coupons" },
                ].map((card) => (
                    <Link
                        key={card.label}
                        href={card.href}
                        style={{
                            background: "white",
                            borderRadius: "12px",
                            padding: "1.5rem",
                            textDecoration: "none",
                            color: "inherit",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        }}
                    >
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{card.icon}</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{card.count}</div>
                        <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>{card.label}</div>
                    </Link>
                ))}
            </div>
        </>
    );
}
