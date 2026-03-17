"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/lib/cart/cart-context";
import { Button } from "@/components/ui/Button/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import styles from "../checkout.module.css";

type CheckoutFormProps = {
    locale: Locale;
    dict: Dictionary;
};

type CouponData = {
    id: string;
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    max_discount_amount: number | null;
    min_order_amount: number | null;
};

type Carrier = {
    id: number;
    title: string;
};

export function CheckoutForm({ locale, dict }: CheckoutFormProps) {
    const { items, subtotal, hasReachedFreeShipping, clearCart } = useCart();
    const [sameAsShipping, setSameAsShipping] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Coupon state
    const [couponInput, setCouponInput] = useState("");
    const [coupon, setCoupon] = useState<CouponData | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

    // Payment method
    const [paymentMethod, setPaymentMethod] = useState("ideal");

    // Shipping carriers from Acut
    const [carriers, setCarriers] = useState<Carrier[]>([]);
    const [selectedCarrierId, setSelectedCarrierId] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/shipping/carriers")
            .then((r) => r.json())
            .then((data) => {
                if (data.carriers && data.carriers.length > 0) {
                    setCarriers(data.carriers);
                    setSelectedCarrierId(data.carriers[0].id);
                }
            })
            .catch(() => { /* ignore — no carriers available */ });

        // Auto-apply coupon from localStorage (saved from email links)
        try {
            const saved = localStorage.getItem("dga_coupon");
            if (saved) {
                const { code, expires } = JSON.parse(saved);
                if (expires && Date.now() > expires) {
                    localStorage.removeItem("dga_coupon");
                } else if (code) {
                    setCouponInput(code);
                    // Defer validation until component is mounted
                    setTimeout(() => {
                        setIsValidatingCoupon(true);
                        fetch("/api/coupons/validate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ code: code.toUpperCase(), cartItems: [] }),
                        })
                            .then((r) => r.json())
                            .then((data) => {
                                if (data.valid) {
                                    setCoupon(data.coupon);
                                    localStorage.removeItem("dga_coupon");
                                }
                            })
                            .catch(() => { /* silent fail */ })
                            .finally(() => setIsValidatingCoupon(false));
                    }, 100);
                }
            }
        } catch { /* localStorage unavailable */ }
    }, []);

    const shippingCost = hasReachedFreeShipping ? 0 : 4.95;
    const invoiceSurcharge = paymentMethod === "invoice" ? 1.99 : 0;

    // Calculate discount
    let discountAmount = 0;
    if (coupon) {
        if (coupon.discount_type === "percentage") {
            discountAmount = subtotal * (coupon.discount_value / 100);
            // Apply max discount cap
            if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
                discountAmount = coupon.max_discount_amount;
            }
        } else {
            discountAmount = coupon.discount_value;
        }
    }

    const total = subtotal + shippingCost + invoiceSurcharge - discountAmount;

    // --- Coupon validation ---
    const handleApplyCoupon = async () => {
        if (!couponInput.trim()) return;

        setIsValidatingCoupon(true);
        setCouponError(null);

        try {
            const res = await fetch("/api/coupons/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: couponInput.trim().toUpperCase(),
                    cartItems: items.map((item) => ({ id: item.id, slug: item.slug })),
                }),
            });

            const data = await res.json();

            if (data.valid) {
                // Check min order amount
                if (
                    data.coupon.min_order_amount &&
                    subtotal < data.coupon.min_order_amount
                ) {
                    setCouponError(
                        `${dict.checkout.minOrderAmount || "Minimum order amount"}: €${data.coupon.min_order_amount.toFixed(2)}`
                    );
                } else {
                    setCoupon(data.coupon);
                    setCouponError(null);
                }
            } else {
                setCouponError(dict.checkout.invalidCoupon || "Invalid coupon code");
            }
        } catch {
            setCouponError("Error validating coupon");
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    const handleRemoveCoupon = () => {
        setCoupon(null);
        setCouponInput("");
        setCouponError(null);
    };

    // --- Submit ---
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);

        const checkoutData = {
            items: items.map((item) => ({
                id: item.id,
                slug: item.slug,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
            })),
            email: formData.get("email") as string,
            phone: formData.get("phone") as string,
            firstName: formData.get("firstName") as string,
            lastName: formData.get("lastName") as string,
            street: formData.get("street") as string,
            houseNumber: formData.get("houseNumber") as string,
            city: formData.get("city") as string,
            postalCode: formData.get("postalCode") as string,
            country: formData.get("country") as string,
            sameAsShipping,
            billingFirstName: sameAsShipping ? undefined : (formData.get("billingFirstName") as string),
            billingLastName: sameAsShipping ? undefined : (formData.get("billingLastName") as string),
            billingStreet: sameAsShipping ? undefined : (formData.get("billingStreet") as string),
            billingHouseNumber: sameAsShipping ? undefined : (formData.get("billingHouseNumber") as string),
            billingCity: sameAsShipping ? undefined : (formData.get("billingCity") as string),
            billingPostalCode: sameAsShipping ? undefined : (formData.get("billingPostalCode") as string),
            billingCountry: sameAsShipping ? undefined : (formData.get("billingCountry") as string),
            couponCode: coupon?.code || undefined,
            discountAmount: discountAmount > 0 ? discountAmount : undefined,
            paymentMethod,
            carrierId: selectedCarrierId || undefined,
            locale,
        };

        try {
            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(checkoutData),
            });

            const result = await res.json();

            if (!res.ok) {
                setError(result.error || "Something went wrong");
                setIsSubmitting(false);
                return;
            }

            // Clear cart before redirect
            clearCart();

            if (result.payment_url) {
                // Redirect to payment gateway
                window.location.href = result.payment_url;
            } else {
                // No payment URL (gateway unavailable) — go to success page
                window.location.href = `/${locale}/checkout/success?order=${result.order_number}&method=${paymentMethod}`;
            }
        } catch {
            setError("Network error. Please try again.");
            setIsSubmitting(false);
        }
    };

    if (items.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "4rem 0" }}>
                <p style={{ color: "var(--color-text-light)", marginBottom: "1.5rem" }}>
                    {dict.cart.empty}
                </p>
                <Button variant="primary" href={`/${locale}/shop`}>
                    {dict.cart.continueShopping}
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className={styles.checkoutLayout}>
            {/* Left Column - Forms */}
            <div>
                {/* Error Banner */}
                {error && (
                    <div className={styles.errorBanner}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Contact Information */}
                <div className={styles.formSection}>
                    <h2 className={styles.sectionTitle}>{dict.checkout.contactInfo}</h2>
                    <div className={styles.formGrid}>
                        <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                            <label className={styles.label} htmlFor="email">{dict.checkout.email}</label>
                            <input className={styles.input} id="email" type="email" name="email" required />
                        </div>
                        <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                            <label className={styles.label} htmlFor="phone">{dict.checkout.phone}</label>
                            <input className={styles.input} id="phone" type="tel" name="phone" />
                        </div>
                    </div>
                </div>

                {/* Shipping Address */}
                <div className={styles.formSection}>
                    <h2 className={styles.sectionTitle}>{dict.checkout.shippingAddress}</h2>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="firstName">{dict.checkout.firstName}</label>
                            <input className={styles.input} id="firstName" type="text" name="firstName" required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="lastName">{dict.checkout.lastName}</label>
                            <input className={styles.input} id="lastName" type="text" name="lastName" required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="street">{dict.checkout.street}</label>
                            <input className={styles.input} id="street" type="text" name="street" required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="houseNumber">{dict.checkout.houseNumber}</label>
                            <input className={styles.input} id="houseNumber" type="text" name="houseNumber" required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="city">{dict.checkout.city}</label>
                            <input className={styles.input} id="city" type="text" name="city" required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} htmlFor="postalCode">{dict.checkout.postalCode}</label>
                            <input className={styles.input} id="postalCode" type="text" name="postalCode" required />
                        </div>
                        <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                            <label className={styles.label} htmlFor="country">{dict.checkout.country}</label>
                            <select className={styles.select} id="country" name="country" defaultValue="NL" required>
                                <option value="NL">Nederland</option>
                                <option value="DE">Deutschland</option>
                                <option value="BE">België</option>
                                <option value="AT">Österreich</option>
                                <option value="LU">Luxembourg</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Billing Address */}
                <div className={styles.formSection}>
                    <h2 className={styles.sectionTitle}>{dict.checkout.billingAddress}</h2>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={sameAsShipping}
                            onChange={(e) => setSameAsShipping(e.target.checked)}
                        />
                        {dict.checkout.sameAsShipping}
                    </label>

                    {!sameAsShipping && (
                        <div className={styles.formGrid} style={{ marginTop: "var(--space-lg)" }}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label} htmlFor="billingFirstName">{dict.checkout.firstName}</label>
                                <input className={styles.input} id="billingFirstName" type="text" name="billingFirstName" required />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label} htmlFor="billingLastName">{dict.checkout.lastName}</label>
                                <input className={styles.input} id="billingLastName" type="text" name="billingLastName" required />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label} htmlFor="billingStreet">{dict.checkout.street}</label>
                                <input className={styles.input} id="billingStreet" type="text" name="billingStreet" required />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label} htmlFor="billingHouseNumber">{dict.checkout.houseNumber}</label>
                                <input className={styles.input} id="billingHouseNumber" type="text" name="billingHouseNumber" required />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label} htmlFor="billingCity">{dict.checkout.city}</label>
                                <input className={styles.input} id="billingCity" type="text" name="billingCity" required />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label} htmlFor="billingPostalCode">{dict.checkout.postalCode}</label>
                                <input className={styles.input} id="billingPostalCode" type="text" name="billingPostalCode" required />
                            </div>
                            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                                <label className={styles.label} htmlFor="billingCountry">{dict.checkout.country}</label>
                                <select className={styles.select} id="billingCountry" name="billingCountry" defaultValue="NL" required>
                                    <option value="NL">Nederland</option>
                                    <option value="DE">Deutschland</option>
                                    <option value="BE">België</option>
                                    <option value="AT">Österreich</option>
                                    <option value="LU">Luxembourg</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Shipping Method — hidden for now, Acut chooses carrier automatically */}

                {/* Payment Method */}
                <div className={styles.formSection}>
                    <h2 className={styles.sectionTitle}>{dict.checkout.paymentMethod || "Payment Method"}</h2>
                    <div className={styles.paymentMethods}>
                        {[
                            {
                                id: "ideal",
                                label: "iDEAL",
                                icon: (
                                    <svg width="28" height="24" viewBox="0 0 40 34" fill="none">
                                        <rect width="40" height="34" rx="4" fill="#CC0066"/>
                                        <path d="M12 7h8c5.5 0 10 4.5 10 10s-4.5 10-10 10h-8V7z" fill="#fff"/>
                                        <circle cx="20" cy="17" r="5" fill="#CC0066"/>
                                        <rect x="6" y="12" width="4" height="10" rx="1" fill="#fff"/>
                                    </svg>
                                ),
                            },
                            {
                                id: "bancontact",
                                label: "Bancontact",
                                icon: (
                                    <svg width="28" height="24" viewBox="0 0 40 34" fill="none">
                                        <rect width="40" height="34" rx="4" fill="#005498"/>
                                        <path d="M8 10h10c3 0 5 2 5 5s-2 5-5 5h-6l-1 4H8V10z" fill="#fff"/>
                                        <path d="M18 14h8c3 0 5 2 5 5s-2 5-5 5h-6l-1 4h-4l3-14z" fill="#FFD800"/>
                                    </svg>
                                ),
                            },
                            {
                                id: "creditcard",
                                label: "Credit Card",
                                icon: (
                                    <svg width="36" height="24" viewBox="0 0 52 34" fill="none">
                                        <rect width="24" height="34" rx="4" fill="#1A1F71"/>
                                        <path d="M7 13l3-6h4l-3 6H7zm6 0l3-6h2l-3 6h-2z" fill="#fff"/>
                                        <path d="M6 18l10 3v2L6 20v-2z" fill="#F7B600"/>
                                        <rect x="28" width="24" height="34" rx="4" fill="#EB001B"/>
                                        <circle cx="37" cy="17" r="8" fill="#EB001B"/>
                                        <circle cx="43" cy="17" r="8" fill="#F79E1B"/>
                                        <path d="M40 10.5a8 8 0 0 1 0 13 8 8 0 0 1 0-13z" fill="#FF5F00"/>
                                    </svg>
                                ),
                            },
                            {
                                id: "sofortbanking",
                                label: "SOFORT",
                                icon: (
                                    <svg width="28" height="24" viewBox="0 0 40 34" fill="none">
                                        <rect width="40" height="34" rx="4" fill="#2B2B2B"/>
                                        <rect x="5" y="7" width="20" height="20" rx="3" fill="#EF809F"/>
                                        <path d="M10 17h10M10 13h7M10 21h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                                        <rect x="28" y="10" width="7" height="14" rx="2" fill="#EF809F"/>
                                        <circle cx="31.5" cy="21" r="1.5" fill="#fff"/>
                                    </svg>
                                ),
                            },
                            {
                                id: "invoice",
                                label: dict.checkout.payOnInvoice || "Pay on Invoice",
                                icon: (
                                    <svg width="28" height="24" viewBox="0 0 40 34" fill="none">
                                        <rect width="40" height="34" rx="4" fill="#F3F4F6"/>
                                        <rect x="10" y="5" width="20" height="24" rx="2" fill="#fff" stroke="#D1D5DB" strokeWidth="1.5"/>
                                        <path d="M14 11h12M14 15h12M14 19h8M14 23h5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                                        <circle cx="27" cy="23" r="3" fill="#2D5A3D"/>
                                        <path d="M25.5 23l1 1 2-2" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                ),
                            },
                        ].map((method) => (
                            <label
                                key={method.id}
                                className={`${styles.paymentOption} ${paymentMethod === method.id ? styles.paymentOptionActive : ""}`}
                            >
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    value={method.id}
                                    checked={paymentMethod === method.id}
                                    onChange={() => setPaymentMethod(method.id)}
                                    className={styles.paymentRadio}
                                />
                                <span className={styles.paymentIcon}>{method.icon}</span>
                                <span className={styles.paymentLabel}>{method.label}</span>
                                {method.id === "invoice" && (
                                    <span style={{ fontSize: "0.7rem", color: "#6b7280", marginLeft: "4px" }}>+€1.99</span>
                                )}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column - Summary */}
            <div className={styles.summary}>
                <h3 className={styles.summaryTitle}>{dict.checkout.orderSummary}</h3>

                {/* Items */}
                {items.map((item) => (
                    <div key={item.id} className={styles.summaryItem}>
                        <span className={styles.summaryItemName}>
                            <span className={styles.summaryItemQty}>{item.quantity}</span>
                            {item.name}
                        </span>
                        <span>€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                ))}

                <hr className={styles.summaryDivider} />

                {/* Coupon Input */}
                <div className={styles.couponSection}>
                    {coupon ? (
                        <div className={styles.couponApplied}>
                            <span>
                                🎟️ <strong>{coupon.code}</strong>
                                {coupon.discount_type === "percentage"
                                    ? ` (−${coupon.discount_value}%)`
                                    : ` (−€${coupon.discount_value.toFixed(2)})`}
                            </span>
                            <button
                                type="button"
                                className={styles.couponRemove}
                                onClick={handleRemoveCoupon}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className={styles.couponInput}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder={dict.checkout.couponPlaceholder || "Coupon code"}
                                value={couponInput}
                                onChange={(e) => setCouponInput(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleApplyCoupon}
                                disabled={isValidatingCoupon || !couponInput.trim()}
                            >
                                {isValidatingCoupon ? "..." : dict.checkout.applyCoupon || "Apply"}
                            </Button>
                        </div>
                    )}
                    {couponError && (
                        <p className={styles.couponError}>{couponError}</p>
                    )}
                </div>

                {/* Totals */}
                <div className={styles.summaryRow}>
                    <span>{dict.cart.subtotal}</span>
                    <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className={styles.summaryRow}>
                    <span>{dict.cart.shipping}</span>
                    <span>{hasReachedFreeShipping ? dict.cart.freeShipping : "€4.95"}</span>
                </div>
                {invoiceSurcharge > 0 && (
                    <div className={styles.summaryRow}>
                        <span>{dict.checkout.invoiceSurcharge || "Invoice fee"}</span>
                        <span>€{invoiceSurcharge.toFixed(2)}</span>
                    </div>
                )}
                {discountAmount > 0 && (
                    <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                        <span>{dict.checkout.discount || "Discount"}</span>
                        <span>−€{discountAmount.toFixed(2)}</span>
                    </div>
                )}

                <div className={styles.summaryTotal}>
                    <span>{dict.cart.total}</span>
                    <span>€{total.toFixed(2)}</span>
                </div>

                <div className={styles.submitSection}>
                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? dict.checkout.processing : dict.checkout.placeOrder}
                    </Button>

                    <div className={styles.secureNotice}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>{dict.footer.securePayment}</span>
                    </div>
                </div>
            </div>
        </form>
    );
}
