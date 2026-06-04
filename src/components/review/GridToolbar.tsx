"use client";

import { SaveStateIndicator } from "@/components/review/SaveStateIndicator";
import type { SaveState } from "@/components/review/evidence-grid-types";

interface ReviewSummary {
  autoTagged: number;
  firstCutArchived: number;
  needsReview: number;
  total: number;
}

interface GridToolbarProps {
  clientName: string;
  documentCount: number;
  reviewSummary: ReviewSummary;
  saveState: SaveState;
  hasAutoTagged: boolean;
  autoTaggedVisible: boolean;
  hasFirstCutArchive: boolean;
  firstCutArchiveVisible: boolean;
  onToggleAutoTagged: () => void;
  onToggleFirstCutArchive: () => void;
  onRevertAutoTagged: () => void;
  onSave: () => void;
}

export function GridToolbar({
  clientName,
  documentCount,
  reviewSummary,
  saveState,
  hasAutoTagged,
  autoTaggedVisible,
  hasFirstCutArchive,
  firstCutArchiveVisible,
  onToggleAutoTagged,
  onToggleFirstCutArchive,
  onRevertAutoTagged,
  onSave,
}: GridToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_16px_34px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Evidence grid
        </p>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          {clientName}
        </h2>
        <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
          Review by exception. Setu auto-enables safe tags, keeps high-risk evidence in the live
          queue, and every tag remains reversible.
        </p>
        <p className="mt-2 text-[11px] font-medium text-[var(--brand-deep)]">
          Auto-tagged {reviewSummary.autoTagged} of {reviewSummary.total} ·{" "}
          {reviewSummary.firstCutArchived} first-cut archived · {reviewSummary.needsReview} need review.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)]">
          {documentCount} documents
        </span>
        <button
          type="button"
          onClick={onToggleAutoTagged}
          disabled={!hasAutoTagged}
          className="inline-flex items-center rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-4 py-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {autoTaggedVisible ? "Hide auto-tagged" : "Reveal auto-tagged"}
        </button>
        <button
          type="button"
          onClick={onToggleFirstCutArchive}
          disabled={!hasFirstCutArchive}
          className="inline-flex items-center rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-4 py-2 text-[11px] font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {firstCutArchiveVisible ? "Hide first cut" : "Reveal first cut"}
        </button>
        <button
          type="button"
          onClick={onRevertAutoTagged}
          disabled={!hasAutoTagged}
          className="inline-flex items-center rounded-[10px] border border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-2 text-[11px] font-semibold text-[var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Revert all AI-tagged
        </button>
        <SaveStateIndicator state={saveState} />
        <button
          type="button"
          onClick={onSave}
          disabled={saveState === "saved" || saveState === "saving"}
          className="inline-flex items-center rounded-[10px] border border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] px-4 py-2 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
