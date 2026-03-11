"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Hook that triggers a fade-in animation when element enters viewport.
 * Uses IntersectionObserver for performance.
 */
export function useScrollReveal<T extends HTMLElement>(
    options?: IntersectionObserverInit
): [RefObject<T | null>, boolean] {
    const ref = useRef<T | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(element); // Only animate once
                }
            },
            {
                threshold: 0.15,
                rootMargin: "0px 0px -50px 0px",
                ...options,
            }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return [ref, isVisible];
}

/**
 * Hook that counts up a number when element enters viewport.
 */
export function useCountUp(
    end: number,
    duration: number = 2000
): [RefObject<HTMLSpanElement | null>, number] {
    const ref = useRef<HTMLSpanElement | null>(null);
    const [count, setCount] = useState(0);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const startTime = performance.now();

                    const animate = (currentTime: number) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        // Ease out cubic
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setCount(Math.round(eased * end));

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        }
                    };

                    requestAnimationFrame(animate);
                    observer.unobserve(element);
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [end, duration]);

    return [ref, count];
}
