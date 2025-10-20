import type { ReactNode } from "react";

export default function ReactMarkdown({ children }: { children: ReactNode }) {
  if (typeof children === "string") {
    const html = children.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (Array.isArray(children)) {
    const joined = children.map((child) => (typeof child === "string" ? child : "")).join("");
    const html = joined.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <>{children}</>;
}
