"use client";

import { CriterionCell } from "@/components/review/CriterionCell";
import { DispositionCell } from "@/components/review/DispositionCell";
import { EyeIcon } from "@/components/review/grid-icons";
import { deriveDocumentDisposition } from "@/lib/criterion-tags";
import type { EvidenceGridDocument } from "@/lib/evidence-query";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";

interface GridRowProps {
  document: EvidenceGridDocument;
  selected: boolean;
  highlighted: boolean;
  onSelect: (checked: boolean, shiftKey: boolean) => void;
  onOpenPeek: () => void;
  onCycleCriterion: (criterionCode: string) => void;
  onToggleDisposition: (kind: "reference" | "archived") => void;
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function GridRow({
  document,
  selected,
  highlighted,
  onSelect,
  onOpenPeek,
  onCycleCriterion,
  onToggleDisposition,
}: GridRowProps) {
  const disposition = deriveDocumentDisposition(document);

  return (
    <tr
      className={`border-b border-[var(--border-secondary)] align-top transition ${
        selected
          ? "bg-[var(--brand-soft)] shadow-[inset_4px_0_0_var(--brand)]"
          : highlighted
            ? "bg-[var(--paper-secondary)]"
            : "bg-[var(--paper-primary)]"
      }`}
    >
      <td className="px-2 py-3">
        <input
          type="checkbox"
          checked={selected}
          onClick={(event) => onSelect(!selected, event.shiftKey)}
          onChange={() => undefined}
          className="h-4 w-4 rounded border-[var(--border-primary)] text-[var(--brand)]"
        />
      </td>
      <td className="px-2 py-3">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onOpenPeek}
            className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--foreground)]"
            title="Quick peek"
          >
            <EyeIcon className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {document.extension.replace(".", "") || "file"}
              </span>
              <span className="max-w-[220px] truncate rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2 py-0.5 text-[9px] font-medium text-[var(--muted)]">
                {document.bundleName || "No bundle"}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-5 text-[var(--foreground)]">
              {document.fileName}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--muted)]">
              {document.summary?.shortSummary || "Summary pending."}
            </p>
            <p className="mt-2 line-clamp-1 text-[10px] text-[var(--muted)]">
              {document.folderLabel} · {document.relativePath}
            </p>
          </div>
        </div>
      </td>
      {EB1A_CRITERIA_DEFINITIONS.map((criterion) => {
        const tag = document.criteriaTags.find((entry) => entry.code === criterion.code) ?? null;

        return (
          <td key={criterion.code} className="px-1 py-3 text-center">
            <CriterionCell
              tag={tag}
              label={criterion.name}
              onToggle={() => onCycleCriterion(criterion.code)}
            />
          </td>
        );
      })}
      <td className="px-1 py-3 text-center text-[11px] font-medium text-[var(--foreground)]">
        {formatConfidence(document.confidenceScore)}
      </td>
      <td className="px-1 py-3 text-center">
        <DispositionCell
          kind="reference"
          active={disposition === "reference"}
          onToggle={() => onToggleDisposition("reference")}
        />
      </td>
      <td className="px-1 py-3 text-center">
        <DispositionCell
          kind="archived"
          active={disposition === "archived"}
          onToggle={() => onToggleDisposition("archived")}
        />
      </td>
    </tr>
  );
}
