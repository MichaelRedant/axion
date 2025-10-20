"use client";

import clsx from "clsx";
import type { EvaluationEngine } from "../lib/algebra/engine";
import { useI18n } from "../lib/i18n/context";

interface EngineToggleProps {
  readonly value: EvaluationEngine;
  readonly maximaEnabled: boolean;
  readonly onChange: (engine: EvaluationEngine) => void;
}

export function EngineToggle({ value, maximaEnabled, onChange }: EngineToggleProps) {
  const { t } = useI18n();
  const maxEnabled = maximaEnabled;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="axion-shell__eyebrow text-xs uppercase tracking-[0.35em] text-[var(--ax-muted)]">
          {t("engine.title", "Rekenkern")}
        </p>
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-[rgba(255,255,255,0.45)]">
          {value === "maxima" ? t("engine.maximaLabel", "Maxima") : t("engine.axionLabel", "Axion")}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={clsx(
            "axion-button text-xs",
            value === "axion" ? "axion-button--primary" : "axion-button--ghost",
          )}
          onClick={() => onChange("axion")}
        >
          {t("engine.axionButton", "Eigen engine")}
        </button>
        <button
          type="button"
          className={clsx(
            "axion-button text-xs",
            value === "maxima" ? "axion-button--primary" : "axion-button--ghost",
            !maxEnabled && "cursor-not-allowed opacity-50",
          )}
          onClick={() => maxEnabled && onChange("maxima")}
          disabled={!maxEnabled}
        >
          {t("engine.maximaButton", "Maxima")}
        </button>
      </div>
      {!maxEnabled ? (
        <p className="text-xs text-[rgba(255,255,255,0.45)]">
          {t("engine.unavailable", "Configureer een Maxima-server om deze optie te gebruiken.")}
        </p>
      ) : (
        <p className="text-xs text-[rgba(255,255,255,0.45)]">
          {t("engine.available", "Aanvragen verlopen via de Maxima-bridge.")}
        </p>
      )}
    </div>
  );
}
