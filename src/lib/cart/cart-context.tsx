"use client";

import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    type ReactNode,
} from "react";

// --- Types ---
export type CartItem = {
    id: string;
    slug: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    category: "raw" | "pure_formula";
};

type CartState = {
    items: CartItem[];
    isDrawerOpen: boolean;
};

type CartAction =
    | { type: "ADD_ITEM"; payload: CartItem }
    | { type: "REMOVE_ITEM"; payload: string }
    | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
    | { type: "CLEAR_CART" }
    | { type: "TOGGLE_DRAWER" }
    | { type: "OPEN_DRAWER" }
    | { type: "CLOSE_DRAWER" }
    | { type: "HYDRATE"; payload: CartItem[] };

type CartContextType = {
    items: CartItem[];
    isDrawerOpen: boolean;
    addItem: (item: CartItem) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    toggleDrawer: () => void;
    openDrawer: () => void;
    closeDrawer: () => void;
    itemCount: number;
    subtotal: number;
    freeShippingThreshold: number;
    hasReachedFreeShipping: boolean;
    amountToFreeShipping: number;
};

// --- Constants ---
const FREE_SHIPPING_THRESHOLD = 65;
const STORAGE_KEY = "dga-cart";

// --- Reducer ---
function cartReducer(state: CartState, action: CartAction): CartState {
    switch (action.type) {
        case "ADD_ITEM": {
            const existingIndex = state.items.findIndex(
                (item) => item.id === action.payload.id
            );
            if (existingIndex > -1) {
                const updatedItems = [...state.items];
                updatedItems[existingIndex] = {
                    ...updatedItems[existingIndex],
                    quantity:
                        updatedItems[existingIndex].quantity + action.payload.quantity,
                };
                return { ...state, items: updatedItems };
            }
            return { ...state, items: [...state.items, action.payload] };
        }
        case "REMOVE_ITEM":
            return {
                ...state,
                items: state.items.filter((item) => item.id !== action.payload),
            };
        case "UPDATE_QUANTITY": {
            if (action.payload.quantity <= 0) {
                return {
                    ...state,
                    items: state.items.filter(
                        (item) => item.id !== action.payload.id
                    ),
                };
            }
            return {
                ...state,
                items: state.items.map((item) =>
                    item.id === action.payload.id
                        ? { ...item, quantity: action.payload.quantity }
                        : item
                ),
            };
        }
        case "CLEAR_CART":
            return { ...state, items: [] };
        case "TOGGLE_DRAWER":
            return { ...state, isDrawerOpen: !state.isDrawerOpen };
        case "OPEN_DRAWER":
            return { ...state, isDrawerOpen: true };
        case "CLOSE_DRAWER":
            return { ...state, isDrawerOpen: false };
        case "HYDRATE":
            return { ...state, items: action.payload };
        default:
            return state;
    }
}

// --- Context ---
const CartContext = createContext<CartContextType | undefined>(undefined);

// --- Provider ---
export function CartProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(cartReducer, {
        items: [],
        isDrawerOpen: false,
    });

    // Hydrate from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    dispatch({ type: "HYDRATE", payload: parsed });
                }
            }
        } catch { }
    }, []);

    // Capture ?coupon= URL param globally (works on any page)
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const couponParam = params.get("coupon");
            if (couponParam) {
                const code = couponParam.toUpperCase();
                localStorage.setItem("dga_coupon", JSON.stringify({
                    code,
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                }));
            }
        } catch { /* ignore */ }
    }, []);

    // Persist to localStorage on change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
        } catch { }
    }, [state.items]);

    // Lock body scroll when drawer is open
    useEffect(() => {
        if (state.isDrawerOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [state.isDrawerOpen]);

    const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
    const hasReachedFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
    const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

    const value: CartContextType = {
        items: state.items,
        isDrawerOpen: state.isDrawerOpen,
        addItem: (item) => dispatch({ type: "ADD_ITEM", payload: item }),
        removeItem: (id) => dispatch({ type: "REMOVE_ITEM", payload: id }),
        updateQuantity: (id, quantity) =>
            dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } }),
        clearCart: () => dispatch({ type: "CLEAR_CART" }),
        toggleDrawer: () => dispatch({ type: "TOGGLE_DRAWER" }),
        openDrawer: () => dispatch({ type: "OPEN_DRAWER" }),
        closeDrawer: () => dispatch({ type: "CLOSE_DRAWER" }),
        itemCount,
        subtotal,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        hasReachedFreeShipping,
        amountToFreeShipping,
    };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// --- Hook ---
export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
}
