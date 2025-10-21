import { describe, expect, it } from "vitest";
import { formatDecimal, tryConvertLatexFractionToDecimal } from "@/app/axion/lib/utils/numbers";

describe("numbers utils", () => {
  describe("formatDecimal", () => {
    it("trims trailing zeros while keeping precision", () => {
      expect(formatDecimal(2)).toBe("2");
      expect(formatDecimal(0.5)).toBe("0.5");
      expect(formatDecimal(1 / 3)).toBe("0.33333333");
      expect(formatDecimal(-0)).toBe("0");
    });
  });

  describe("tryConvertLatexFractionToDecimal", () => {
    it("returns null for non-fraction expressions", () => {
      expect(tryConvertLatexFractionToDecimal("x")).toBeNull();
      expect(tryConvertLatexFractionToDecimal("\\sqrt{2}")).toBeNull();
    });

    it("converts simple latex fractions", () => {
      expect(tryConvertLatexFractionToDecimal("\\frac{1}{2}")).toBe("0.5");
      expect(tryConvertLatexFractionToDecimal("-\\frac{3}{4}")).toBe("-0.75");
      expect(tryConvertLatexFractionToDecimal("\\frac{-3}{4}")).toBe("-0.75");
      expect(tryConvertLatexFractionToDecimal("\\frac{10}{4}")).toBe("2.5");
    });

    it("ignores unsupported numeric segments", () => {
      expect(tryConvertLatexFractionToDecimal("\\frac{a}{b}")).toBeNull();
      expect(tryConvertLatexFractionToDecimal("\\frac{1}{0}")).toBeNull();
    });

    it("handles wrapping parentheses", () => {
      expect(tryConvertLatexFractionToDecimal("\\left(\\frac{1}{4}\\right)")).toBe("0.25");
    });
  });
});
