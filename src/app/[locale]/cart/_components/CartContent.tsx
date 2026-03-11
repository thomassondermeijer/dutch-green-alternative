"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart/cart-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../cart.module.css";

type Coupon = {
    id: string;
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    min_order_amount: number | null;
};

type CartContentProps = {
    locale: Locale;
    dict: Dictionary;
};

export function CartContent({ locale, dict }: CartContentProps) {
    const {
        items,
        removeItem,
        updateQuantity,
        subtotal,
        hasReachedFreeShipping,
        amountToFreeShipping,
        freeShippingThreshold,
    } = useCart();

    const [couponCode, setCouponCode] = useState("");
    const [coupon, setCoupon] = useState<Coupon | null>(null);
    const [couponError, setCouponError] = useState("");
    const [couponLoading, setCouponLoading] = useState(false);

    const applyCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponLoading(true);
        setCouponError("");

        try {
            const res = await fetch("/api/coupons/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: couponCode.trim() }),
            });
            const data = await res.json();

            if (data.valid) {
                if (data.coupon.min_order_amount && subtotal < data.coupon.min_order_amount) {
                    setCouponError(`Min. €${data.coupon.min_order_amount.toFixed(2)}`);
                } else {
                    setCoupon(data.coupon);
                }
            } else {
                setCouponError(dict.cart.couponInvalid);
            }
        } catch {
            setCouponError(dict.cart.couponInvalid);
        } finally {
            setCouponLoading(false);
        }
    };

    const discountAmount = coupon
        ? coupon.discount_type === "percentage"
            ? subtotal * (coupon.discount_value / 100)
            : coupon.discount_value
        : 0;

    const shippingCost = hasReachedFreeShipping ? 0 : 4.95;
    const total = subtotal - discountAmount + shippingCost;

    if (items.length === 0) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>🛒</div>
                <p className={styles.emptyText}>{dict.cart.empty}</p>
                <Button variant="primary" href={`/${locale}/shop`}>
                    {dict.cart.continueShopping}
                </Button>
            </div>
        );
    }

    const shippingProgress = Math.min(
        (subtotal / freeShippingThreshold) * 100,
        100
    );

    return (
        <div className={styles.cartLayout}>
            {/* Items List */}
            <div className={styles.itemsList}>
                {items.map((item) => (
                    <div key={item.id} className={styles.cartItem}>
                        <div className={styles.itemImage}>
                            {item.image ? (
                                <Image
                                    src={item.image}
                                    alt={item.name}
                                    fill
                                    sizes="100px"
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
                                        fontSize: "2rem",
                                    }}
                                >
                                    🌿
                                </div>
                            )}
                        </div>

                        <div className={styles.itemDetails}>
                            <h3 className={styles.itemName}>
                                <Link href={`/${locale}/shop/${item.slug}`}>{item.name}</Link>
                            </h3>
                            <span className={styles.itemCategory}>
                                {item.category === "raw"
                                    ? dict.shop.categoryRaw
                                    : dict.shop.categoryPure}
                            </span>

                            <div className={styles.itemBottom}>
                                <div className={styles.qtyControl}>
                                    <button
                                        className={styles.qtyBtn}
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    >
                                        −
                                    </button>
                                    <span className={styles.qtyValue}>{item.quantity}</span>
                                    <button
                                        className={styles.qtyBtn}
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    >
                                        +
                                    </button>
                                </div>

                                <span className={styles.itemPrice}>
                                    €{(item.price * item.quantity).toFixed(2)}
                                </span>

                                <button
                                    className={styles.removeBtn}
                                    onClick={() => removeItem(item.id)}
                                >
                                    {dict.cart.remove}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary Sidebar */}
            <div className={styles.summary}>
                <h3 className={styles.summaryTitle}>{dict.checkout.orderSummary}</h3>

                {/* Shipping Progress */}
                <div
                    className={`${styles.shippingBar} ${hasReachedFreeShipping
                        ? styles.shippingBarReached
                        : styles.shippingBarRemaining
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

                {/* Coupon Input */}
                <div className={styles.couponSection}>
                    {coupon ? (
                        <div className={styles.couponApplied}>
                            <span>🏷️ {coupon.code}</span>
                            <button onClick={() => { setCoupon(null); setCouponCode(""); }}>✕</button>
                        </div>
                    ) : (
                        <div className={styles.couponInput}>
                            <input
                                type="text"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                placeholder={dict.cart.couponPlaceholder}
                                className={styles.couponField}
                                onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                            />
                            <button
                                className={styles.couponBtn}
                                onClick={applyCoupon}
                                disabled={couponLoading}
                            >
                                {dict.cart.applyCoupon}
                            </button>
                        </div>
                    )}
                    {couponError && <p className={styles.couponError}>{couponError}</p>}
                </div>

                <div className={styles.summaryRow}>
                    <span>{dict.cart.subtotal}</span>
                    <span>€{subtotal.toFixed(2)}</span>
                </div>

                {coupon && (
                    <div className={styles.summaryRow} style={{ color: "var(--color-success)" }}>
                        <span>{dict.cart.discount} ({coupon.code})</span>
                        <span>-€{discountAmount.toFixed(2)}</span>
                    </div>
                )}

                <div className={styles.summaryRow}>
                    <span>{dict.cart.shipping}</span>
                    <span>
                        {hasReachedFreeShipping ? dict.cart.freeShipping : "€4.95"}
                    </span>
                </div>

                <div className={styles.summaryTotal}>
                    <span>{dict.cart.total}</span>
                    <span>€{total.toFixed(2)}</span>
                </div>

                <div className={styles.checkoutActions}>
                    <Button variant="primary" size="lg" fullWidth href={`/${locale}/checkout`}>
                        {dict.cart.checkout}
                    </Button>
                    <Button variant="ghost" fullWidth href={`/${locale}/shop`}>
                        {dict.cart.continueShopping}
                    </Button>
                </div>
            </div>
        </div>
    );
}

