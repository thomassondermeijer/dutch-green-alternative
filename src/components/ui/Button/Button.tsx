import { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

type BaseProps = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    children: React.ReactNode;
};

type ButtonAsButton = BaseProps &
    ButtonHTMLAttributes<HTMLButtonElement> & {
        href?: never;
    };

type ButtonAsLink = BaseProps &
    AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
    };

type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
    variant = "primary",
    size = "md",
    fullWidth = false,
    children,
    className,
    ...props
}: ButtonProps) {
    const classNames = [
        styles.button,
        styles[variant],
        size !== "md" ? styles[size] : "",
        fullWidth ? styles.fullWidth : "",
        className || "",
    ]
        .filter(Boolean)
        .join(" ");

    if ("href" in props && props.href) {
        return (
            <a className={classNames} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {children}
            </a>
        );
    }

    return (
        <button className={classNames} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
            {children}
        </button>
    );
}
