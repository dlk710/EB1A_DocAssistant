"use client";

import type { MouseEvent, ReactNode } from "react";
import type { ReviewDecisionItem } from "@/components/review/DecisionRow";

interface WorkflowDocumentCardProps {
  item: ReviewDecisionItem;
  stageLabel: string;
  helperLabel: string;
  helperBody: string;
  accentTone?: "brand" | "warning" | "muted";
  actions: ReactNode;
  onContextMenu?: (item: ReviewDecisionItem, event: MouseEvent<HTMLDivElement>) => void;
}

function resolveToneClasses(tone: "brand" | "warning" | "muted") {
  if (tone === "warning") {
    return {
      chip: "bg-[var(--state-warning-soft)] text-[var(--state-warning)]",
      panel: "bg-[var(--state-warning-soft)]/60 border-[var(--state-warning)]/20",
    };
  }

  if (tone === "muted") {
    return {
      chip: "bg-[var(--paper-secondary)] text-[var(--muted)]",
      panel: "bg-[var(--paper-secondary)] border-[var(--border-secondary)]",
    };
  }

  return {
    chip: "bg-[var(--brand-soft)] text-[var(--brand-deep)]",
    panel: "bg-[var(--brand-soft)]/55 border-[var(--brand)]/15",
  };
}

export function WorkflowDocumentCard({
  item,
  stageLabel,
  helperLabel,
  helperBody,
  accentTone = "brand",
  actions,
  onContextMenu,
}: WorkflowDocumentCardProps) {
  const tone = resolveToneClasses(accentTone);

  return (
    <div
      onContextMenu={onContextMenu ? (event) => onContextMenu(item, event) : undefined}
      className={`rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.03)] ${
        onContextMenu ? "cursor-context-menu" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[9px] font-semibold tracking-[0.14em] ${tone.chip}`}
          >
            {stageLabel}
          </span>
          <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
            {item.workspaceLabel}
          </span>
          {item.currentBundleName ? (
            <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
              {item.currentBundleName}
            </span>
          ) : null}
          <span className="ml-auto rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
            {Math.round(item.confidence * 100)}% confidence
          </span>
        </div>
        <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">{item.title}</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">{item.fileName}</p>
        <p className="mt-3 text-[12px] leading-6 text-[var(--foreground)]/88">
          {item.shortSummary}
        </p>
        <div className={`mt-3 rounded-[14px] border px-3 py-3 ${tone.panel}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            {helperLabel}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--foreground)]/82">{helperBody}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-secondary)] pt-3">{actions}</div>
      </div>
    </div>
  );
}
