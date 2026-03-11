"use client";

import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { CartProvider } from "@/lib/cart/cart-context";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ToastProvider } from "@/components/shared/Toast/Toast";
import { CartDrawer } from "@/components/cart/CartDrawer/CartDrawer";

type ClientProvidersProps = {
    locale: Locale;
    dict: Dictionary;
    children: ReactNode;
};

export function ClientProviders({ locale, dict, children }: ClientProvidersProps) {
    return (
        <AuthProvider>
            <CartProvider>
                <ToastProvider>
                    {children}
                    <CartDrawer locale={locale} dict={dict} />
                </ToastProvider>
            </CartProvider>
        </AuthProvider>
    );
}

