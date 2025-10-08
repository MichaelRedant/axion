import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalcInput } from "@/app/axion/components/CalcInput";
import type { ShortcutAction } from "@/app/axion/lib/utils/keyboard";

const noop = () => {};

function setup(onShortcut: (action: ShortcutAction) => void) {
  const utils = render(
    <CalcInput
      value=""
      label="Input"
      placeholder="placeholder"
      evaluateLabel="Eval"
      clearLabel="Clear"
      onChange={noop}
      onShortcut={onShortcut}
    />,
  );
  const textarea = screen.getByLabelText("Input") as HTMLTextAreaElement;
  return { utils, textarea };
}

describe("CalcInput shortcuts", () => {
  it("triggers evaluate on Enter", () => {
    const onShortcut = vi.fn();
    const { textarea } = setup(onShortcut as unknown as (action: ShortcutAction) => void);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onShortcut).toHaveBeenCalledWith("evaluate");
  });

  it("ignores Shift+Enter", () => {
    const onShortcut = vi.fn();
    const { textarea } = setup(onShortcut as unknown as (action: ShortcutAction) => void);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onShortcut).not.toHaveBeenCalled();
  });

  it("supports history navigation", () => {
    const onShortcut = vi.fn();
    const { textarea } = setup(onShortcut as unknown as (action: ShortcutAction) => void);
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(onShortcut).toHaveBeenCalledWith("historyPrev");
  });
});
