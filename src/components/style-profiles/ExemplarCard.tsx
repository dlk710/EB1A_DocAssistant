"use client";

import { getCriterionDisplayName } from "@/lib/constants";
import { formatSynthesisSectionLabel } from "@/lib/prompt-library";
import type { StyleExemplar } from "@/lib/types";

export function ExemplarCard(props: {
  exemplar: StyleExemplar;
  onEdit?: (exemplar: StyleExemplar) => void;
  onDelete?: (exemplarId: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {props.exemplar.kind
              ? formatSynthesisSectionLabel(props.exemplar.kind)
              : getCriterionDisplayName(props.exemplar.criterionCode)}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
            {props.exemplar.label}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
            props.exemplar.approvedOutcome
              ? "bg-[var(--state-success-soft)] text-[var(--state-success)]"
              : "bg-[var(--paper-secondary)] text-[var(--muted)]"
          }`}
        >
          {props.exemplar.approvedOutcome ? "approved outcome" : "reference only"}
        </span>
      </div>
      <p className="mt-3 line-clamp-6 text-[12px] leading-6 text-[var(--foreground)]">
        {props.exemplar.text}
      </p>
      {props.exemplar.notes ? (
        <p className="mt-3 text-[10px] leading-5 text-[var(--muted)]">{props.exemplar.notes}</p>
      ) : null}
      {!props.readOnly ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => props.onEdit?.(props.exemplar)}
            className="rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => props.onDelete?.(props.exemplar.id)}
            className="rounded-[10px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--state-danger)]"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
