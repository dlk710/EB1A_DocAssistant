"use client";

import type { MouseEvent } from "react";
import type { CriterionTagRole, EvidenceReviewStatus } from "@/lib/types";

export interface ReviewDecisionItem {
  id: string;
  jobId: string;
  title: string;
  fileName: string;
  workspaceLabel: string;
  confidence: number;
  reasoning: string;
  shortSummary: string;
  roleHint: CriterionTagRole | null;
  denseReviewHref: string;
  previewHref: string;
  sourceHref: string;
  reviewStatus: EvidenceReviewStatus;
  currentCriterionCode: string | null;
  currentCriterionLegalCode: string | null;
  currentCriterionName: string | null;
  currentCriterionRole: CriterionTagRole | null;
  currentBundleId: string | null;
  currentBundleName: string | null;
  currentParentBundleId: string | null;
}

interface DecisionRowProps {
  item: ReviewDecisionItem;
  onContextMenu: (item: ReviewDecisionItem, event: MouseEvent<HTMLDivElement>) => void;
  onOpenCriterionPicker: (
    item: ReviewDecisionItem,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onOpenActions: (item: ReviewDecisionItem, event: MouseEvent<HTMLButtonElement>) => void;
}

export function DecisionRow({
  item,
  onContextMenu,
  onOpenCriterionPicker,
  onOpenActions,
}: DecisionRowProps) {
  return (
    <div
      onContextMenu={(event) => onContextMenu(item, event)}
      className="cursor-context-menu rounded-[16px] border border-[var(--brand)]/25 bg-[var(--paper-primary)] px-4 py-4"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--brand-deep)]">
            Pending
          </span>
          <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
            Confidence {Math.round(item.confidence * 100)}%
          </span>
          {item.roleHint ? (
            <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
              {item.roleHint}
            </span>
          ) : null}
          {item.currentBundleName ? (
            <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
              {item.currentBundleName}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">{item.title}</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          {item.workspaceLabel} · {item.fileName}
        </p>
        <p className="mt-3 text-[12px] leading-6 text-[var(--foreground)]/88">
          {item.shortSummary}
        </p>
        <div className="mt-3 rounded-[12px] bg-[var(--paper-secondary)] px-3 py-2">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)]">
            Why Setu paused
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--foreground)]/82">
            {item.reasoning}
          </p>
        </div>
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          Use Actions or right-click to keep, reassign, move, or open Quick peek.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => onOpenCriterionPicker(item, event)}
            className="setu-ghost-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold"
          >
            Assign criterion
          </button>
          <button
            type="button"
            onClick={(event) => onOpenActions(item, event)}
            className="setu-ghost-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold"
          >
            Actions
          </button>
        </div>
      </div>
    </div>
  );
}
