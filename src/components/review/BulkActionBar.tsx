"use client";

import { useState } from "react";
import type { EvidenceGridBundleOption } from "@/lib/evidence-query";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";

interface BulkActionBarProps {
  selectedCount: number;
  bundleOptions: EvidenceGridBundleOption[];
  onPrimaryTag: (criterionCode: string) => void;
  onSupportingTag: (criterionCode: string) => void;
  onArchive: () => void;
  onReference: () => void;
  onMoveBundle: (bundleId: string) => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  bundleOptions,
  onPrimaryTag,
  onSupportingTag,
  onArchive,
  onReference,
  onMoveBundle,
  onClearSelection,
}: BulkActionBarProps) {
  const [criterionCode, setCriterionCode] = useState<string>(
    EB1A_CRITERIA_DEFINITIONS[0]?.code ?? "",
  );
  const [bundleId, setBundleId] = useState("");

  return (
    <div className="rounded-[18px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-4 py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-deep)]">
            Bulk actions
          </p>
          <p className="mt-1 text-[12px] text-[var(--brand-deep)]">
            {selectedCount} document{selectedCount === 1 ? "" : "s"} selected
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={criterionCode}
            onChange={(event) => setCriterionCode(event.target.value)}
            className="rounded-[12px] border border-[var(--brand)]/20 bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] text-[var(--foreground)]"
          >
            {EB1A_CRITERIA_DEFINITIONS.map((criterion) => (
              <option key={criterion.code} value={criterion.code}>
                {criterion.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onPrimaryTag(criterionCode)}
            className="rounded-[12px] border border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] px-3 py-2.5 text-[12px] font-semibold text-white"
          >
            Tag primary for
          </button>
          <button
            type="button"
            onClick={() => onSupportingTag(criterionCode)}
            className="rounded-[12px] border border-[var(--brand)] bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] font-semibold text-[var(--brand-deep)]"
          >
            Tag supporting for
          </button>
          <button
            type="button"
            onClick={onReference}
            className="rounded-[12px] border border-[var(--brand)]/20 bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] font-medium text-[var(--brand-deep)]"
          >
            Reference
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="rounded-[12px] border border-[var(--brand-charcoal)]/15 bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] font-medium text-[var(--foreground)]"
          >
            Archive
          </button>
          <select
            value={bundleId}
            onChange={(event) => setBundleId(event.target.value)}
            className="rounded-[12px] border border-[var(--brand)]/20 bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] text-[var(--foreground)]"
          >
            <option value="">Move to bundle…</option>
            {bundleOptions.map((bundle) => (
              <option key={bundle.id} value={bundle.id}>
                {bundle.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => bundleId && onMoveBundle(bundleId)}
            disabled={!bundleId}
            className="rounded-[12px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Move to bundle
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded-[12px] border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-2.5 text-[12px] font-medium text-[var(--foreground)]"
          >
            Clear selection
          </button>
        </div>
      </div>
    </div>
  );
}
