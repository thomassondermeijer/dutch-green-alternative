"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Button } from "@/components/ui/Button/Button";
import styles from "../review.module.css";

type ReviewFormProps = {
    locale: Locale;
    dict: Dictionary;
    token: string;
};

const t = {
    de: {
        title: "Bewertung schreiben",
        subtitle: "Teilen Sie Ihre Erfahrung und erhalten Sie 40% Rabatt!",
        ratingLabel: "Bewertung",
        textLabel: "Ihre Erfahrung",
        textPlaceholder: "Wie gefällt Ihnen das Produkt? Wofür verwenden Sie es?",
        nameLabel: "Name (öffentlich sichtbar)",
        namePlaceholder: "z.B. Klaus M.",
        photosLabel: "Fotos hinzufügen (optional, bis zu 3)",
        photosHint: "Fotos hochladen = 40% Rabatt nach Genehmigung!",
        dragDrop: "Bilder hierher ziehen oder klicken",
        submit: "Bewertung absenden",
        submitting: "Wird gesendet...",
        successTitle: "🎉 Vielen Dank!",
        successText: "Ihre Bewertung wird überprüft. Sie erhalten einen 40% Gutscheincode per E-Mail, sobald sie genehmigt wurde.",
        errorInvalid: "Ungültiger oder abgelaufener Bewertungslink.",
        errorDuplicate: "Sie haben bereits eine Bewertung für diese Bestellung abgegeben.",
        errorGeneric: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
        ratingRequired: "Bitte wählen Sie eine Bewertung",
        backToShop: "Zurück zum Shop",
        invalidToken: "Ungültiger Bewertungslink. Bitte verwenden Sie den Link aus Ihrer E-Mail.",
    },
    nl: {
        title: "Schrijf een beoordeling",
        subtitle: "Deel uw ervaring en ontvang 40% korting!",
        ratingLabel: "Beoordeling",
        textLabel: "Uw ervaring",
        textPlaceholder: "Hoe bevalt het product? Waarvoor gebruikt u het?",
        nameLabel: "Naam (publiek zichtbaar)",
        namePlaceholder: "bijv. Jan V.",
        photosLabel: "Foto's toevoegen (optioneel, maximaal 3)",
        photosHint: "Foto's uploaden = 40% korting na goedkeuring!",
        dragDrop: "Sleep afbeeldingen hierheen of klik",
        submit: "Beoordeling versturen",
        submitting: "Wordt verzonden...",
        successTitle: "🎉 Hartelijk dank!",
        successText: "Uw beoordeling wordt beoordeeld. U ontvangt een 40% kortingscode per e-mail zodra deze is goedgekeurd.",
        errorInvalid: "Ongeldige of verlopen beoordelingslink.",
        errorDuplicate: "U heeft al een beoordeling voor deze bestelling ingediend.",
        errorGeneric: "Er is een fout opgetreden. Probeer het opnieuw.",
        ratingRequired: "Selecteer een beoordeling",
        backToShop: "Terug naar de winkel",
        invalidToken: "Ongeldige beoordelingslink. Gebruik de link uit uw e-mail.",
    },
    en: {
        title: "Write a Review",
        subtitle: "Share your experience and get 40% off!",
        ratingLabel: "Rating",
        textLabel: "Your experience",
        textPlaceholder: "How do you like the product? What do you use it for?",
        nameLabel: "Name (publicly visible)",
        namePlaceholder: "e.g. John D.",
        photosLabel: "Add photos (optional, up to 3)",
        photosHint: "Upload photos = 40% discount after approval!",
        dragDrop: "Drag images here or click to browse",
        submit: "Submit Review",
        submitting: "Submitting...",
        successTitle: "🎉 Thank you!",
        successText: "Your review is being checked. You'll receive a 40% coupon code by email once it's approved.",
        errorInvalid: "Invalid or expired review link.",
        errorDuplicate: "You have already submitted a review for this order.",
        errorGeneric: "Something went wrong. Please try again.",
        ratingRequired: "Please select a rating",
        backToShop: "Back to shop",
        invalidToken: "Invalid review link. Please use the link from your email.",
    },
};

export function ReviewForm({ locale, dict, token }: ReviewFormProps) {
    const labels = t[locale] || t.de;
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [text, setText] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const addImages = useCallback((files: FileList | File[]) => {
        const newFiles = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 3 - images.length);
        const newPreviews = newFiles.map(f => URL.createObjectURL(f));
        setImages(prev => [...prev, ...newFiles].slice(0, 3));
        setPreviews(prev => [...prev, ...newPreviews].slice(0, 3));
    }, [images.length]);

    const removeImage = (i: number) => {
        URL.revokeObjectURL(previews[i]);
        setImages(prev => prev.filter((_, idx) => idx !== i));
        setPreviews(prev => prev.filter((_, idx) => idx !== i));
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        addImages(e.dataTransfer.files);
    }, [addImages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) { setError(labels.ratingRequired); return; }
        setLoading(true);
        setError("");

        const formData = new FormData();
        formData.append("token", token);
        formData.append("rating", String(rating));
        formData.append("text", text);
        formData.append("customer_name", customerName);
        images.forEach((img, i) => formData.append(`image_${i}`, img));

        try {
            const res = await fetch("/api/reviews/submit", { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) setError(labels.errorDuplicate);
                else if (res.status === 404) setError(labels.errorInvalid);
                else setError(data.error || labels.errorGeneric);
                setLoading(false);
                return;
            }
            setSuccess(true);
        } catch {
            setError(labels.errorGeneric);
        }
        setLoading(false);
    };

    if (!token) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔗</div>
                <p>{labels.invalidToken}</p>
                <Button variant="primary" href={`/${locale}/shop`} style={{ marginTop: "1rem" }}>
                    {labels.backToShop}
                </Button>
            </div>
        );
    }

    if (success) {
        return (
            <div className={styles.successState}>
                <div className={styles.successIcon}>🎉</div>
                <h2 className={styles.successTitle}>{labels.successTitle}</h2>
                <p className={styles.successText}>{labels.successText}</p>
                <Button variant="primary" href={`/${locale}/shop`} style={{ marginTop: "1.5rem" }}>
                    {labels.backToShop}
                </Button>
            </div>
        );
    }

    return (
        <div className={styles.formWrapper}>
            <div className={styles.formCard}>
                <h1 className={styles.formTitle}>{labels.title}</h1>
                <p className={styles.formSubtitle}>{labels.subtitle}</p>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {error && <div className={styles.error}>{error}</div>}

                    {/* Star Rating */}
                    <div className={styles.field}>
                        <label className={styles.label}>{labels.ratingLabel} *</label>
                        <div className={styles.stars}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`${styles.star} ${i <= (hoverRating || rating) ? styles.starFilled : ""}`}
                                    onClick={() => setRating(i)}
                                    onMouseEnter={() => setHoverRating(i)}
                                    onMouseLeave={() => setHoverRating(0)}
                                >
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill={i <= (hoverRating || rating) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="review-name">{labels.nameLabel}</label>
                        <input
                            className={styles.input}
                            id="review-name"
                            type="text"
                            value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            placeholder={labels.namePlaceholder}
                        />
                    </div>

                    {/* Text */}
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="review-text">{labels.textLabel}</label>
                        <textarea
                            className={styles.textarea}
                            id="review-text"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder={labels.textPlaceholder}
                            rows={4}
                        />
                    </div>

                    {/* Photo Upload */}
                    <div className={styles.field}>
                        <label className={styles.label}>{labels.photosLabel}</label>
                        <p className={styles.photoHint}>📸 {labels.photosHint}</p>

                        {images.length < 3 && (
                            <div
                                className={styles.dropZone}
                                onClick={() => fileRef.current?.click()}
                                onDragOver={e => e.preventDefault()}
                                onDrop={handleDrop}
                            >
                                <span className={styles.dropIcon}>📷</span>
                                <span>{labels.dragDrop}</span>
                            </div>
                        )}

                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: "none" }}
                            onChange={e => e.target.files && addImages(e.target.files)}
                        />

                        {previews.length > 0 && (
                            <div className={styles.previewGrid}>
                                {previews.map((src, i) => (
                                    <div key={i} className={styles.previewItem}>
                                        <Image src={src} alt={`Photo ${i + 1}`} width={120} height={120} className={styles.previewImage} />
                                        <button type="button" className={styles.previewRemove} onClick={() => removeImage(i)}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button variant="primary" fullWidth type="submit" disabled={loading}>
                        {loading ? labels.submitting : labels.submit}
                    </Button>
                </form>
            </div>
        </div>
    );
}
