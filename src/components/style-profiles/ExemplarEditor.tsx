"use client";

import { useState } from "react";
import type { StyleExemplar, SynthesisSectionKind } from "@/lib/types";

const SYNTHESIS_KIND_OPTIONS: Array<{
  label: string;
  value: SynthesisSectionKind;
  backingCode: string;
}> = [
  {
    label: "Statement of Eligibility",
    value: "statement-of-eligibility",
    backingCode: "SOE",
  },
  {
    label: "Final Merits Determination",
    value: "final-merits-determination",
    backingCode: "FMD",
  },
];

function resolveDraftKind(input: {
  kind: SynthesisSectionKind | null;
  criterionCode: string;
}) {
  if (input.kind) {
    return input.kind;
  }

  if (input.criterionCode === "SOE") {
    return "statement-of-eligibility" satisfies SynthesisSectionKind;
  }

  if (input.criterionCode === "FMD") {
    return "final-merits-determination" satisfies SynthesisSectionKind;
  }

  return null;
}

export function ExemplarEditor(props: {
  exemplar?: StyleExemplar | null;
  onSave: (input: {
    label: string;
    criterionCode: string;
    kind: SynthesisSectionKind | null;
    text: string;
    approvedOutcome: boolean;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    label: props.exemplar?.label ?? "",
    criterionCode: props.exemplar?.criterionCode ?? "05",
    kind: resolveDraftKind({
      kind: props.exemplar?.kind ?? null,
      criterionCode: props.exemplar?.criterionCode ?? "05",
    }),
    text: props.exemplar?.text ?? "",
    approvedOutcome: props.exemplar?.approvedOutcome ?? true,
    notes: props.exemplar?.notes ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-[11px] text-[var(--muted)]">
          <span>Label</span>
          <input
            value={draft.label}
            onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
            className="w-full rounded-[12px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[12px] text-[var(--foreground)] outline-none"
          />
        </label>
        <label className="space-y-1 text-[11px] text-[var(--muted)]">
          <span>Exemplar scope</span>
          <select
            value={draft.kind ?? "criterion"}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (nextValue === "criterion") {
                setDraft((current) => ({
                  ...current,
                  kind: null,
                  criterionCode:
                    current.criterionCode === "SOE" || current.criterionCode === "FMD"
                      ? "05"
                      : current.criterionCode,
                }));
                return;
              }

              const selectedKind = SYNTHESIS_KIND_OPTIONS.find(
                (option) => option.value === nextValue,
              );
              setDraft((current) => ({
                ...current,
                kind: selectedKind?.value ?? null,
                criterionCode: selectedKind?.backingCode ?? current.criterionCode,
              }));
            }}
            className="w-full rounded-[12px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[12px] text-[var(--foreground)] outline-none"
          >
            <option value="criterion">Per-criterion draft</option>
            {SYNTHESIS_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block space-y-1 text-[11px] text-[var(--muted)]">
        <span>{draft.kind ? "Backing code" : "Criterion code"}</span>
        <input
          value={draft.criterionCode}
          disabled={Boolean(draft.kind)}
          onChange={(event) =>
            setDraft((current) => ({ ...current, criterionCode: event.target.value }))
          }
          className="w-full rounded-[12px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[12px] text-[var(--foreground)] outline-none disabled:bg-[var(--paper-secondary)] disabled:text-[var(--muted)]"
        />
      </label>
      <label className="mt-3 block space-y-1 text-[11px] text-[var(--muted)]">
        <span>Exemplar text</span>
        <textarea
          value={draft.text}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
          className="min-h-[220px] w-full rounded-[12px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[12px] leading-6 text-[var(--foreground)] outline-none"
        />
      </label>
      <label className="mt-3 block space-y-1 text-[11px] text-[var(--muted)]">
        <span>Notes</span>
        <textarea
          value={draft.notes}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          className="min-h-[90px] w-full rounded-[12px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[12px] leading-6 text-[var(--foreground)] outline-none"
        />
      </label>
      <label className="mt-3 inline-flex items-center gap-2 text-[11px] text-[var(--muted)]">
        <input
          type="checkbox"
          checked={draft.approvedOutcome}
          onChange={(event) =>
            setDraft((current) => ({ ...current, approvedOutcome: event.target.checked }))
          }
        />
        Source petition was approved
      </label>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={async () => {
            setIsSaving(true);
            try {
              await props.onSave({
                ...draft,
                criterionCode: draft.criterionCode.trim() || "05",
              });
            } finally {
              setIsSaving(false);
            }
          }}
          className="setu-primary-button rounded-[10px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
        >
          {isSaving ? "Saving…" : "Save exemplar"}
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
