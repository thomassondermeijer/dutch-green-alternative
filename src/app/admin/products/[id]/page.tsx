"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button/Button";
import styles from "../../admin.module.css";

type ProductFormData = {
    slug: string;
    category: "raw" | "pure_formula";
    price: string;
    stock: string;
    sort_order: string;
    is_active: boolean;
    // Translations
    de_name: string;
    de_short_description: string;
    de_description: string;
    nl_name: string;
    nl_short_description: string;
    nl_description: string;
    en_name: string;
    en_short_description: string;
    en_description: string;
};

const emptyForm: ProductFormData = {
    slug: "",
    category: "raw",
    price: "",
    stock: "0",
    sort_order: "0",
    is_active: true,
    de_name: "", de_short_description: "", de_description: "",
    nl_name: "", nl_short_description: "", nl_description: "",
    en_name: "", en_short_description: "", en_description: "",
};

export default function ProductForm() {
    const router = useRouter();
    const params = useParams();
    const productId = params?.id as string;
    const isNew = productId === "new";

    const [form, setForm] = useState<ProductFormData>(emptyForm);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isNew) {
            fetch("/api/admin/products")
                .then((res) => res.json())
                .then((products) => {
                    const product = products.find((p: { id: string }) => p.id === productId);
                    if (product) {
                        const t = product.translations || {};
                        setForm({
                            slug: product.slug || "",
                            category: product.category || "raw",
                            price: product.price?.toString() || "",
                            stock: product.stock?.toString() || "0",
                            sort_order: product.sort_order?.toString() || "0",
                            is_active: product.is_active ?? true,
                            de_name: t.de?.name || "",
                            de_short_description: t.de?.short_description || "",
                            de_description: t.de?.description || "",
                            nl_name: t.nl?.name || "",
                            nl_short_description: t.nl?.short_description || "",
                            nl_description: t.nl?.description || "",
                            en_name: t.en?.name || "",
                            en_short_description: t.en?.short_description || "",
                            en_description: t.en?.description || "",
                        });
                        setImageUrls(product.image_urls || []);
                    }
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [isNew, productId]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const uploadFile = useCallback(async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/admin/upload", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        return data.url as string;
    }, []);

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        setUploading(true);
        setError("");

        try {
            const urls = await Promise.all(fileArray.map(uploadFile));
            setImageUrls((prev) => [...prev, ...urls]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    }, [uploadFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const removeImage = (index: number) => {
        setImageUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");

        const translations = {
            de: { name: form.de_name, short_description: form.de_short_description, description: form.de_description },
            nl: { name: form.nl_name, short_description: form.nl_short_description, description: form.nl_description },
            en: { name: form.en_name, short_description: form.en_short_description, description: form.en_description },
        };

        const payload = {
            ...(isNew ? {} : { id: productId }),
            slug: form.slug,
            category: form.category,
            price: parseFloat(form.price),
            stock: parseInt(form.stock),
            sort_order: parseInt(form.sort_order),
            is_active: form.is_active,
            image_urls: imageUrls,
            translations,
        };

        try {
            const res = await fetch("/api/admin/products", {
                method: isNew ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                if (isNew) {
                    router.push("/admin/products");
                } else {
                    setSuccess("Product saved!");
                }
            } else {
                const data = await res.json();
                setError(JSON.stringify(data.error) || "Failed to save");
            }
        } catch {
            setError("Network error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading...</p>;

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>{isNew ? "New Product" : "Edit Product"}</h1>
            </div>

            <div className={styles.formCard}>
                {error && <div className={styles.error}>{error}</div>}
                {success && <div className={styles.success}>{success}</div>}

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Slug</label>
                            <input className={styles.formInput} name="slug" value={form.slug} onChange={handleChange} required />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Category</label>
                            <select className={styles.formSelect} name="category" value={form.category} onChange={handleChange}>
                                <option value="raw">RAW CBD/CBG</option>
                                <option value="pure_formula">Pure Formula+</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Price (€)</label>
                            <input className={styles.formInput} name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Stock</label>
                            <input className={styles.formInput} name="stock" type="number" value={form.stock} onChange={handleChange} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Sort Order</label>
                            <input className={styles.formInput} name="sort_order" type="number" value={form.sort_order} onChange={handleChange} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formCheckbox}>
                                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
                                Active
                            </label>
                        </div>

                        {/* Image Upload */}
                        <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                            <label className={styles.formLabel}>Product Images</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                multiple
                                style={{ display: "none" }}
                                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                            />
                            <div
                                className={`${styles.imageUploadArea} ${dragOver ? styles.imageUploadAreaDragOver : ""}`}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                            >
                                <div className={styles.imageUploadIcon}>📷</div>
                                <div className={styles.imageUploadText}>
                                    <strong>Click to upload</strong> or drag & drop
                                    <br />
                                    JPEG, PNG, WebP, AVIF — max 5MB
                                </div>
                            </div>
                            {uploading && (
                                <div className={styles.imageUploading}>
                                    ⏳ Uploading...
                                </div>
                            )}
                            {imageUrls.length > 0 && (
                                <div className={styles.imagePreviews}>
                                    {imageUrls.map((url, i) => (
                                        <div key={url} className={styles.imagePreview}>
                                            <img src={url} alt={`Product image ${i + 1}`} />
                                            <button
                                                type="button"
                                                className={styles.imageRemoveBtn}
                                                onClick={() => removeImage(i)}
                                                title="Remove image"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Translations */}
                    {(["de", "nl", "en"] as const).map((lang) => (
                        <div key={lang} className={styles.formSection}>
                            <h3 className={styles.formSectionTitle}>
                                {lang === "de" ? "🇩🇪 Deutsch" : lang === "nl" ? "🇳🇱 Nederlands" : "🇬🇧 English"}
                            </h3>
                            <div className={styles.formGrid}>
                                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                    <label className={styles.formLabel}>Name</label>
                                    <input className={styles.formInput} name={`${lang}_name`} value={form[`${lang}_name` as keyof ProductFormData] as string} onChange={handleChange} required />
                                </div>
                                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                    <label className={styles.formLabel}>Short Description</label>
                                    <input className={styles.formInput} name={`${lang}_short_description`} value={form[`${lang}_short_description` as keyof ProductFormData] as string} onChange={handleChange} />
                                </div>
                                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                                    <label className={styles.formLabel}>Description</label>
                                    <textarea className={styles.formTextarea} name={`${lang}_description`} value={form[`${lang}_description` as keyof ProductFormData] as string} onChange={handleChange} />
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className={styles.formActions}>
                        <Button variant="primary" type="submit" disabled={saving}>
                            {saving ? "Saving..." : isNew ? "Create Product" : "Save Changes"}
                        </Button>
                        <Button variant="ghost" href="/admin/products">
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}
