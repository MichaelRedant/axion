"use client";

import clsx from "clsx";
import type { EvaluationEngine } from "../lib/algebra/engine";
import { useI18n } from "../lib/i18n/context";
import { Tooltip } from "./Tooltip";

interface EngineToggleProps {
  readonly value: EvaluationEngine;
  readonly maximaEnabled: boolean;
  readonly onChange: (engine: EvaluationEngine) => void;
}

export function EngineToggle({ value, maximaEnabled, onChange }: EngineToggleProps) {
  const { t } = useI18n();
  const maxEnabled = maximaEnabled;
  const axionTooltip = t("engine.tooltips.axion");
  const maximaTooltip = maxEnabled ? t("engine.tooltips.maxima") : t("engine.unavailable");

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
        <Tooltip content={axionTooltip}>
          <button
            type="button"
            className={clsx(
              "axion-button text-xs",
              value === "axion" ? "axion-button--primary" : "axion-button--ghost",
            )}
            onClick={() => onChange("axion")}
            aria-pressed={value === "axion"}
          >
            {t("engine.axionButton", "Eigen engine")}
          </button>
        </Tooltip>
        <Tooltip content={maximaTooltip}>
          <button
            type="button"
            className={clsx(
              "axion-button text-xs",
              value === "maxima" ? "axion-button--primary" : "axion-button--ghost",
              !maxEnabled && "cursor-not-allowed opacity-50",
            )}
            onClick={() => {
              if (!maxEnabled) {
                return;
              }
              onChange("maxima");
            }}
            aria-disabled={!maxEnabled}
            aria-pressed={value === "maxima"}
          >
            {t("engine.maximaButton", "Maxima")}
          </button>
        </Tooltip>
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
