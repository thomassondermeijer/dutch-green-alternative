"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart/cart-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "./CartDrawer.module.css";

type CartDrawerProps = {
    locale: Locale;
    dict: Dictionary;
};

export function CartDrawer({ locale, dict }: CartDrawerProps) {
    const [savedCoupon, setSavedCoupon] = useState<string | null>(null);
    const [couponDiscount, setCouponDiscount] = useState<{
        type: "percentage" | "fixed";
        value: number;
        maxDiscount: number | null;
    } | null>(null);
    const {
        items,
        isDrawerOpen,
        closeDrawer,
        removeItem,
        updateQuantity,
        itemCount,
        subtotal,
        hasReachedFreeShipping,
        amountToFreeShipping,
        freeShippingThreshold,
    } = useCart();

    // Check localStorage for saved coupon and validate when drawer opens
    useEffect(() => {
        if (isDrawerOpen) {
            try {
                const saved = localStorage.getItem("dga_coupon");
                if (saved) {
                    const { code, expires } = JSON.parse(saved);
                    if (expires && Date.now() > expires) {
                        localStorage.removeItem("dga_coupon");
                        setSavedCoupon(null);
                        setCouponDiscount(null);
                    } else if (code) {
                        setSavedCoupon(code);
                        // Validate coupon to get discount details
                        fetch("/api/coupons/validate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ code: code.toUpperCase(), cartItems: [] }),
                        })
                            .then((r) => r.json())
                            .then((data) => {
                                if (data.valid && data.coupon) {
                                    setCouponDiscount({
                                        type: data.coupon.discount_type,
                                        value: data.coupon.discount_value,
                                        maxDiscount: data.coupon.max_discount_amount,
                                    });
                                }
                            })
                            .catch(() => { /* silent */ });
                    }
                } else {
                    setSavedCoupon(null);
                    setCouponDiscount(null);
                }
            } catch {
                setSavedCoupon(null);
                setCouponDiscount(null);
            }
        }
    }, [isDrawerOpen]);

    if (!isDrawerOpen) return null;

    const shippingProgress = Math.min(
        (subtotal / freeShippingThreshold) * 100,
        100
    );

    // Calculate discount amount
    let discountAmount = 0;
    if (couponDiscount) {
        if (couponDiscount.type === "percentage") {
            discountAmount = subtotal * (couponDiscount.value / 100);
            if (couponDiscount.maxDiscount && discountAmount > couponDiscount.maxDiscount) {
                discountAmount = couponDiscount.maxDiscount;
            }
        } else {
            discountAmount = couponDiscount.value;
        }
    }
    const estimatedTotal = subtotal + (hasReachedFreeShipping ? 0 : 4.95) - discountAmount;

    return (
        <>
            {/* Backdrop */}
            <div className={styles.overlay} onClick={closeDrawer} />

            {/* Drawer */}
            <div className={styles.drawer}>
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {dict.cart.title} ({itemCount})
                    </h2>
                    <button
                        className={styles.closeBtn}
                        onClick={closeDrawer}
                        aria-label={dict.common.close}
                    >
                        ✕
                    </button>
                </div>

                {/* Items */}
                <div className={styles.items}>
                    {items.length === 0 ? (
                        <div className={styles.empty}>
                            <span className={styles.emptyIcon}>🛒</span>
                            <p>{dict.cart.empty}</p>
                            <Button
                                variant="outline"
                                href={`/${locale}/shop`}
                                onClick={closeDrawer}
                            >
                                {dict.cart.continueShopping}
                            </Button>
                        </div>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className={styles.item}>
                                <div className={styles.itemImage}>
                                    {item.image ? (
                                        <Image
                                            src={item.image}
                                            alt={item.name}
                                            fill
                                            sizes="72px"
                                            style={{ objectFit: "cover" }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "1.5rem",
                                            }}
                                        >
                                            🌿
                                        </div>
                                    )}
                                </div>

                                <div className={styles.itemInfo}>
                                    <span className={styles.itemName}>{item.name}</span>
                                    <span className={styles.itemPrice}>
                                        €{(item.price * item.quantity).toFixed(2)}
                                    </span>

                                    <div className={styles.itemActions}>
                                        <div className={styles.qtyControl}>
                                            <button
                                                className={styles.qtyBtn}
                                                onClick={() =>
                                                    updateQuantity(item.id, item.quantity - 1)
                                                }
                                            >
                                                −
                                            </button>
                                            <span className={styles.qtyValue}>{item.quantity}</span>
                                            <button
                                                className={styles.qtyBtn}
                                                onClick={() =>
                                                    updateQuantity(item.id, item.quantity + 1)
                                                }
                                            >
                                                +
                                            </button>
                                        </div>

                                        <button
                                            className={styles.removeBtn}
                                            onClick={() => removeItem(item.id)}
                                        >
                                            {dict.cart.remove}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className={styles.footer}>
                        {/* Free Shipping Progress */}
                        <div
                            className={`${styles.shippingProgress} ${hasReachedFreeShipping
                                    ? styles.shippingReached
                                    : styles.shippingRemaining
                                }`}
                        >
                            {hasReachedFreeShipping
                                ? `✓ ${dict.cart.freeShipping}`
                                : dict.cart.freeShippingRemaining.replace(
                                    "{amount}",
                                    `€${amountToFreeShipping.toFixed(2)}`
                                )}
                            {!hasReachedFreeShipping && (
                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{ width: `${shippingProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Coupon Banner with actual discount */}
                        {savedCoupon && couponDiscount && (
                            <div className={styles.couponBanner}>
                                <div className={styles.couponBannerTop}>
                                    🎟️ <strong>{savedCoupon}</strong>
                                    {couponDiscount.type === "percentage"
                                        ? ` (−${couponDiscount.value}%)`
                                        : ` (−€${couponDiscount.value.toFixed(2)})`}
                                </div>
                                {discountAmount > 0 && (
                                    <div className={styles.couponBannerSaving}>
                                        {dict.cart.discount || "Discount"}: −€{discountAmount.toFixed(2)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Subtotal */}
                        <div className={styles.subtotalRow}>
                            <span>{dict.cart.subtotal}</span>
                            <span>€{subtotal.toFixed(2)}</span>
                        </div>

                        {/* Estimated total with discount */}
                        {discountAmount > 0 && (
                            <div className={styles.estimatedTotalRow}>
                                <span>{dict.cart.total}</span>
                                <span>€{estimatedTotal.toFixed(2)}</span>
                            </div>
                        )}

                        {/* Checkout Button */}
                        <Button
                            variant="primary"
                            size="lg"
                            fullWidth
                            href={`/${locale}/checkout`}
                            onClick={closeDrawer}
                        >
                            {dict.cart.checkout}
                        </Button>

                        {/* Continue Shopping */}
                        <Button
                            variant="ghost"
                            fullWidth
                            href={`/${locale}/shop`}
                            onClick={closeDrawer}
                            style={{ borderColor: "transparent" }}
                        >
                            {dict.cart.continueShopping}
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
