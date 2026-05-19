"use client";

import type { MouseEvent } from "react";
import { CategoryBand } from "@/components/review/CategoryBand";
import type { ReviewDecisionItem } from "@/components/review/DecisionRow";

interface ReferenceCategoryBandProps {
  items: ReviewDecisionItem[];
  onContextMenu: (item: ReviewDecisionItem, event: MouseEvent<HTMLDivElement>) => void;
}

export function ReferenceCategoryBand({
  items,
  onContextMenu,
}: ReferenceCategoryBandProps) {
  if (!items.length) {
    return null;
  }

  return (
    <CategoryBand
      legalCode="(R)"
      title="Reference"
      taggedCount={items.length}
      decisionCount={0}
      routineCount={0}
      note="Held for later. Reference documents stay available without inflating criterion coverage."
      defaultOpen
      headerChipClassName="border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] text-[var(--state-warning)]"
      headerClassName="bg-[var(--paper-tertiary)]"
    >
      {items.map((item) => (
        <div
          key={item.id}
          onContextMenu={(event) => onContextMenu(item, event)}
          className="cursor-context-menu rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--state-warning)]">
              Reference
            </span>
            {item.currentBundleName ? (
              <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
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
              Why it is held for later
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--foreground)]/82">
              {item.reasoning}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-[var(--muted)]">
            Right-click to keep, reassign, move, or open Quick peek.
          </p>
        </div>
      ))}
    </CategoryBand>
  );
}
