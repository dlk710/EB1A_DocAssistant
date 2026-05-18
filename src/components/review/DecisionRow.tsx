"use client";

import Link from "next/link";

export interface ReviewDecisionItem {
  id: string;
  jobId: string;
  title: string;
  fileName: string;
  workspaceLabel: string;
  confidence: number;
  reasoning: string;
  shortSummary: string;
  roleHint: string | null;
  denseReviewHref: string;
  previewHref: string;
  sourceHref: string;
}

interface DecisionRowProps {
  item: ReviewDecisionItem;
  onKeep: (item: ReviewDecisionItem) => void;
  onArchive: (item: ReviewDecisionItem) => void;
  onQuickPeek: (item: ReviewDecisionItem) => void;
}

export function DecisionRow({
  item,
  onKeep,
  onArchive,
  onQuickPeek,
}: DecisionRowProps) {
  return (
    <div className="rounded-[16px] border border-[var(--brand)]/25 bg-[var(--paper-primary)] px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
              Decision
            </span>
            <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Confidence {Math.round(item.confidence * 100)}%
            </span>
            {item.roleHint ? (
              <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {item.roleHint}
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Why Setu paused
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--foreground)]/82">
              {item.reasoning}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:w-[220px] lg:justify-end">
          <button
            type="button"
            onClick={() => onKeep(item)}
            className="rounded-full border border-[var(--state-success)] bg-[var(--state-success-soft)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--state-success)]"
          >
            Keep
          </button>
          <Link
            href={item.denseReviewHref}
            className="rounded-full border border-[var(--border-primary)] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
          >
            Reassign
          </Link>
          <button
            type="button"
            onClick={() => onArchive(item)}
            className="rounded-full border border-[var(--border-primary)] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={() => onQuickPeek(item)}
            className="rounded-full border border-[var(--border-primary)] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
          >
            Quick peek
          </button>
        </div>
      </div>
    </div>
  );
}
