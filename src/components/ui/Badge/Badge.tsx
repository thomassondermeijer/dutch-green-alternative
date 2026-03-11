import styles from "./Badge.module.css";

type BadgeProps = {
    children: React.ReactNode;
    variant?: "default" | "success" | "warning" | "error" | "gold";
    size?: "sm" | "md";
    className?: string;
};

export function Badge({
    children,
    variant = "default",
    size = "md",
    className,
}: BadgeProps) {
    return (
        <span
            className={`${styles.badge} ${styles[variant]} ${styles[size]} ${className || ""}`}
        >
            {children}
        </span>
    );
}
