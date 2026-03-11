import styles from "./Container.module.css";

type ContainerProps = {
    children: React.ReactNode;
    size?: "default" | "narrow" | "wide";
    className?: string;
    as?: "div" | "section" | "article" | "main";
};

export function Container({
    children,
    size = "default",
    className,
    as: Component = "div",
}: ContainerProps) {
    return (
        <Component
            className={`${styles.container} ${styles[size]} ${className || ""}`}
        >
            {children}
        </Component>
    );
}
