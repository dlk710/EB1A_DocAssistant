"use client";

import { CheckIcon, DotIcon, SpinnerIcon } from "@/components/review/grid-icons";
import type { SaveState } from "@/components/review/evidence-grid-types";

interface SaveStateIndicatorProps {
  state: SaveState;
}

const STATE_COPY: Record<
  SaveState,
  {
    label: string;
    className: string;
    icon: typeof CheckIcon;
  }
> = {
  saved: {
    label: "All changes saved",
    className:
      "border-[var(--state-success)]/18 bg-[var(--state-success-soft)] text-[var(--state-success)]",
    icon: CheckIcon,
  },
  unsaved: {
    label: "Unsaved changes",
    className:
      "border-[var(--brand)]/20 bg-[var(--brand-soft)] text-[var(--brand-deep)]",
    icon: DotIcon,
  },
  saving: {
    label: "Saving…",
    className:
      "border-[var(--border-primary)] bg-[var(--paper-secondary)] text-[var(--muted)]",
    icon: SpinnerIcon,
  },
};

export function SaveStateIndicator({ state }: SaveStateIndicatorProps) {
  const config = STATE_COPY[state];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium ${config.className}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${state === "saving" ? "animate-spin" : ""}`}
      />
      <span>{config.label}</span>
    </div>
  );
}
