"use client";

import type { ReactNode } from "react";

export function MessageBubble(props: {
  role: "assistant" | "user";
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[14px] px-3 py-2.5 text-[12px] leading-6 ${
        props.role === "assistant"
          ? "border border-[var(--border-secondary)] bg-[var(--paper-primary)] text-[var(--foreground)]"
          : "bg-[var(--brand-charcoal)] text-white"
      }`}
    >
      {props.children}
    </div>
  );
}
