"use client";

import { cloneElement, useId, useState } from "react";
import type { FocusEvent, MouseEvent, ReactElement, TouchEvent } from "react";
import clsx from "clsx";

type TooltipTargetProps = {
  readonly "aria-describedby"?: string;
  readonly onFocus?: (event: FocusEvent<HTMLElement>) => void;
  readonly onBlur?: (event: FocusEvent<HTMLElement>) => void;
  readonly onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  readonly onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  readonly onTouchStart?: (event: TouchEvent<HTMLElement>) => void;
  readonly onTouchEnd?: (event: TouchEvent<HTMLElement>) => void;
};

interface TooltipProps {
  readonly content: string;
  readonly children: ReactElement<TooltipTargetProps>;
  readonly placement?: "top" | "bottom";
}

export function Tooltip({ content, children, placement = "top" }: TooltipProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  const existingDescribedBy = children.props["aria-describedby"] as string | undefined;
  const describedBy = existingDescribedBy ? `${existingDescribedBy} ${id}` : id;

  const positionClasses =
    placement === "top"
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : "top-full mt-2 left-1/2 -translate-x-1/2";

  const handleShow = () => setVisible(true);
  const handleHide = () => setVisible(false);

  const child = cloneElement(children, {
    "aria-describedby": describedBy,
    onFocus: (event: FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(event);
      handleShow();
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(event);
      handleHide();
    },
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      children.props.onMouseEnter?.(event);
      handleShow();
    },
    onMouseLeave: (event: MouseEvent<HTMLElement>) => {
      children.props.onMouseLeave?.(event);
      handleHide();
    },
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      children.props.onTouchStart?.(event);
      handleShow();
    },
    onTouchEnd: (event: TouchEvent<HTMLElement>) => {
      children.props.onTouchEnd?.(event);
      handleHide();
    },
  });

  return (
    <span className="relative inline-flex">
      {child}
      <span
        role="tooltip"
        id={id}
        aria-hidden={!visible}
        className={clsx(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-[rgba(8,8,8,0.95)] px-2 py-1 text-xs font-medium text-[rgba(255,255,255,0.92)] shadow-lg transition-opacity duration-150",
          positionClasses,
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
