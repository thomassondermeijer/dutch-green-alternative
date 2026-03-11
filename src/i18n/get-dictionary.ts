import type { Locale } from './config';

const dictionaries = {
    de: () => import('./dictionaries/de.json').then((m) => m.default),
    nl: () => import('./dictionaries/nl.json').then((m) => m.default),
    en: () => import('./dictionaries/en.json').then((m) => m.default),
};

export const getDictionary = async (locale: Locale) => {
    return dictionaries[locale]();
};

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
