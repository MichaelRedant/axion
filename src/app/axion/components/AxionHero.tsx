"use client";

import { useMemo } from "react";
import { useI18n } from "../lib/i18n/context";
import "../styles.css";

/**
 * AxionHero renders the branded hero banner with the neon grid backdrop.
 * Content is translated via the i18n provider.
 */
export function AxionHero() {
  const { t } = useI18n();

  const phrases = useMemo(
    () => ({
      title: t("hero.title"),
      tagline: t("hero.tagline"),
      subtitle: t("hero.subtitle"),
    }),
    [t],
  );

  return (
    <section
      aria-labelledby="axion-hero-heading"
      className="relative overflow-hidden rounded-3xl border border-[rgba(0,255,242,0.2)] bg-[rgba(6,12,20,0.75)] p-8 text-left shadow-neon sm:p-10"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,255,242,0.2),_transparent_60%)]" />
      <div className="axion-scanlines" aria-hidden />
      <div className="relative grid gap-4">
        <span className="inline-flex max-w-max items-center gap-2 rounded-full border border-[rgba(0,255,242,0.4)] bg-black/40 px-4 py-1 text-xs uppercase tracking-[0.4em] text-neon">
          {phrases.tagline}
        </span>
        <h1
          id="axion-hero-heading"
          className="font-display text-4xl tracking-[0.35em] text-neon drop-shadow-[0_0_15px_rgba(0,255,242,0.45)] sm:text-5xl"
        >
          {phrases.title}
        </h1>
        <p className="max-w-xl text-sm text-[rgba(255,255,255,0.68)] sm:text-base">
          {phrases.subtitle}
        </p>
        <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-[rgba(0,255,242,0.4)] to-transparent" />
      </div>
    </section>
  );
}
