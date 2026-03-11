"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/cart-context";

/**
 * Client component that clears the cart when mounted (on success page).
 * Renders nothing — it's purely a side-effect component.
 */
export function CartClearer() {
    const { clearCart, items } = useCart();

    useEffect(() => {
        if (items.length > 0) {
            clearCart();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}
