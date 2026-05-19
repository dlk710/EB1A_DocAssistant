"use client";

import type { ChatMode } from "@/lib/types";

const MODES: Array<{ key: ChatMode; label: string }> = [
  { key: "triage", label: "Triage" },
  { key: "strategy", label: "Strategy" },
  { key: "stress-test", label: "Stress-test" },
  { key: "draft", label: "Draft" },
];

export function ModeSelector(props: {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
  draftDisabled?: boolean;
  draftTooltip?: string;
}) {
  return (
    <div className="inline-flex flex-wrap gap-2">
      {MODES.map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => props.onChange(mode.key)}
          disabled={props.disabled || (mode.key === "draft" && props.draftDisabled)}
          title={mode.key === "draft" && props.draftDisabled ? props.draftTooltip : undefined}
          className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
            props.value === mode.key
              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
              : "border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--muted)] hover:bg-[var(--paper-secondary)]"
          } ${props.disabled || (mode.key === "draft" && props.draftDisabled) ? "cursor-not-allowed opacity-45" : ""}`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
