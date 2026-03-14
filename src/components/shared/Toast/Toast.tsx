"use client";

import { useState, createContext, useContext, useCallback, type ReactNode } from "react";
import styles from "./Toast.module.css";

type ToastVariant = "default" | "coupon";

type ToastMessage = {
    id: number;
    text: string;
    variant: ToastVariant;
    leaving?: boolean;
};

type ToastContextType = {
    showToast: (text: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((text: string, variant: ToastVariant = "default") => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, text, variant }]);

        const stayDuration = variant === "coupon" ? 4000 : 2500;

        // Start leaving animation
        setTimeout(() => {
            setToasts((prev) =>
                prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
            );
        }, stayDuration);

        // Remove after animation
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, stayDuration + 400);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            {toasts.map((toast) => {
                const variantClass = toast.variant === "coupon" ? styles.couponToast : styles.toast;
                const leavingClass = toast.variant === "coupon" ? styles.couponLeaving : styles.leaving;

                return (
                    <div
                        key={toast.id}
                        className={`${variantClass} ${toast.leaving ? leavingClass : ""}`}
                    >
                        {toast.variant === "coupon" ? (
                            <span className={styles.couponToastIcon}>🎟️</span>
                        ) : (
                            <svg
                                className={styles.toastIcon}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        )}
                        {toast.text}
                    </div>
                );
            })}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
