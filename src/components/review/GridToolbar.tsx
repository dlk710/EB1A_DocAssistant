"use client";

import { SaveStateIndicator } from "@/components/review/SaveStateIndicator";
import type { SaveState } from "@/components/review/evidence-grid-types";

interface GridToolbarProps {
  clientName: string;
  documentCount: number;
  saveState: SaveState;
  onSave: () => void;
}

export function GridToolbar({
  clientName,
  documentCount,
  saveState,
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
          Review every document row directly. Tags are independent, bundles are convenience
          groupings, and nothing is finalized until you confirm it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)]">
          {documentCount} documents
        </span>
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
