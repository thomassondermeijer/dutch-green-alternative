"use client";

import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from "react";
import styles from "./Toast.module.css";

type ToastMessage = {
    id: number;
    text: string;
    leaving?: boolean;
};

type ToastContextType = {
    showToast: (text: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((text: string) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, text }]);

        // Start leaving animation after 2.5s
        setTimeout(() => {
            setToasts((prev) =>
                prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
            );
        }, 2500);

        // Remove after animation
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2800);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`${styles.toast} ${toast.leaving ? styles.leaving : ""}`}
                >
                    <svg
                        className={styles.toastIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {toast.text}
                </div>
            ))}
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
