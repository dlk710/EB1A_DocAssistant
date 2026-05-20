"use client";

import type { MouseEvent, ReactNode } from "react";
import type { ReviewBundleDecisionItem } from "@/components/review/workflow-types";

interface WorkflowBundleCardProps {
  item: ReviewBundleDecisionItem;
  stageLabel: string;
  helperText: string;
  actions: ReactNode;
  onContextMenu?: (item: ReviewBundleDecisionItem, event: MouseEvent<HTMLDivElement>) => void;
}

export function WorkflowBundleCard({
  item,
  stageLabel,
  helperText,
  actions,
  onContextMenu,
}: WorkflowBundleCardProps) {
  return (
    <div
      onContextMenu={onContextMenu ? (event) => onContextMenu(item, event) : undefined}
      className={`rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 ${
        onContextMenu ? "cursor-context-menu" : ""
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--brand-deep)]">
              {stageLabel}
            </span>
            <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
              {item.workspaceLabel}
            </span>
            <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
              {item.documentCount} file{item.documentCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">{item.bundleName}</p>
          <p className="mt-2 text-[12px] leading-6 text-[var(--foreground)]/88">{item.rationale}</p>
          <p className="mt-2 text-[11px] text-[var(--muted)]">{helperText}</p>
          {item.criterionHint ? (
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Suggested fit: {item.criterionHint}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}
