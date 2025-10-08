"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import nl from "@/i18n/nl.json";
import en from "@/i18n/en.json";

export type Locale = "nl" | "en";

const dictionaries = {
  nl,
  en,
} as const;

type Dictionary = typeof nl;

type TranslationKey = string;

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  dictionary: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getValue(path: string, dictionary: Dictionary): string | undefined {
  const segments = path.split(".");
  let current: unknown = dictionary;

  for (const segment of segments) {
    if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("nl");

  const value = useMemo<LanguageContextValue>(() => {
    const dictionary = dictionaries[locale];
    const translate = (key: TranslationKey) => getValue(key, dictionary) ?? key;

    return {
      locale,
      setLocale,
      t: translate,
      dictionary,
    };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return context;
}
