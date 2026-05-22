"use client";

import { BookmarkIcon, PlusIcon, SparklesIcon } from "@/components/review/grid-icons";
import type { EvidenceCriterionTag } from "@/lib/types";

interface CriterionCellProps {
  tag: EvidenceCriterionTag | null;
  label: string;
  onToggle: () => void;
}

function getVisualState(tag: EvidenceCriterionTag | null) {
  if (!tag || tag.state === "disabled") {
    return "off" as const;
  }

  if (tag.state === "suggested") {
    return "suggested" as const;
  }

  return tag.role === "primary" ? "primary" as const : "supporting" as const;
}

export function CriterionCell({ tag, label, onToggle }: CriterionCellProps) {
  const state = getVisualState(tag);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] border transition ${
        state === "primary"
          ? "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-[var(--brand)] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
          : state === "supporting"
            ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
            : state === "suggested"
              ? "border-dashed border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
              : "border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
      }`}
      title={`${label}${state === "suggested" ? " · suggested by Setu" : ""}`}
    >
      {state === "off" ? (
        <PlusIcon className="h-3.5 w-3.5" />
      ) : state === "suggested" ? (
        <SparklesIcon className="h-3.5 w-3.5" />
      ) : (
        <BookmarkIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
