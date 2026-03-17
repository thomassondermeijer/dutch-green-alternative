"use client";

import { useState } from "react";
import { LabResultCard } from "./LabResultCard";
import { Lightbox } from "./Lightbox";
import styles from "../lab-results.module.css";

type LabProduct = {
    slug: string;
    name: string;
    productImage: string;
    labResultImage: string;
};

type LabResultsGridProps = {
    products: LabProduct[];
    hoverHint: string;
    clickHint: string;
    verifiedBy: string;
};

export function LabResultsGrid({
    products,
    hoverHint,
    clickHint,
    verifiedBy,
}: LabResultsGridProps) {
    const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

    return (
        <>
            <div className={styles.grid}>
                {products.map((product) => (
                    <LabResultCard
                        key={product.slug}
                        productName={product.name}
                        productImage={product.productImage}
                        labResultImage={product.labResultImage}
                        hoverHint={hoverHint}
                        clickHint={clickHint}
                        verifiedBy={verifiedBy}
                        onOpenLightbox={(src, name) => setLightbox({ src, name })}
                    />
                ))}
            </div>

            {lightbox && (
                <Lightbox
                    src={lightbox.src}
                    productName={lightbox.name}
                    verifiedBy={verifiedBy}
                    onClose={() => setLightbox(null)}
                />
            )}
        </>
    );
}
