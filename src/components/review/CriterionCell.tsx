"use client";

import { BookmarkIcon, PlusIcon, SparklesIcon } from "@/components/review/grid-icons";
import type { EvidenceCriterionTag } from "@/lib/types";

interface CriterionCellProps {
  tag: EvidenceCriterionTag | null;
  label: string;
  blueFlagPrompt?: string | null;
  onToggle: () => void;
}

function getVisualState(tag: EvidenceCriterionTag | null) {
  if (!tag || tag.state === "disabled") {
    return "off" as const;
  }

  if (tag.state === "suggested") {
    return tag.role === "primary"
      ? ("suggested-primary" as const)
      : ("suggested-supporting" as const);
  }

  if (tag.origin === "ai_auto") {
    return tag.role === "primary"
      ? ("ai-auto-primary" as const)
      : ("ai-auto-supporting" as const);
  }

  return tag.role === "primary" ? "primary" as const : "supporting" as const;
}

export function CriterionCell({ tag, label, blueFlagPrompt, onToggle }: CriterionCellProps) {
  const state = getVisualState(tag);
  const suggestedRoleLabel =
    state === "suggested-primary"
      ? "AI suggests primary evidence"
      : state === "suggested-supporting"
        ? "AI suggests supporting evidence"
        : null;
  const autoTagReason =
    state === "ai-auto-primary" || state === "ai-auto-supporting"
      ? tag?.autoTagReason ?? "Auto-tagged by Setu."
      : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] border transition ${
        state === "primary"
          ? "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-[var(--brand)] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
          : state === "supporting"
            ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
            : state === "ai-auto-primary"
              ? "border-2 border-dashed border-[var(--brand-charcoal)] bg-[color:rgba(26,26,31,0.92)] text-[var(--brand)] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
              : state === "ai-auto-supporting"
                ? "border-2 border-dashed border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
            : state === "suggested-primary"
              ? "border-[var(--brand-charcoal)] bg-[color:rgba(26,26,31,0.92)] text-[var(--brand)] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
              : state === "suggested-supporting"
              ? "border-dashed border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
              : "border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
      }`}
      title={
        autoTagReason
          ? `${label} · Auto-tagged by Setu · ${autoTagReason}`
          : blueFlagPrompt
            ? `${label} · Strong venue signal · ${blueFlagPrompt}`
          : suggestedRoleLabel
          ? `${label} · ${suggestedRoleLabel}`
          : label
      }
    >
      {state === "off" ? (
        <PlusIcon className="h-3.5 w-3.5" />
      ) : state === "suggested-primary" || state === "suggested-supporting" ? (
        <SparklesIcon className="h-3.5 w-3.5" />
      ) : (
        <>
          <BookmarkIcon className="h-3.5 w-3.5" />
          {state === "ai-auto-primary" || state === "ai-auto-supporting" ? (
            <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-[var(--paper-primary)] bg-[var(--brand-charcoal)] px-1 py-[1px] text-[7px] font-bold uppercase tracking-[0.08em] text-white">
              AI
            </span>
          ) : null}
          {blueFlagPrompt ? (
            <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full border border-[var(--paper-primary)] bg-[var(--state-success)]" />
          ) : null}
        </>
      )}
    </button>
  );
}
