"use client";

import { useState } from "react";
import type { StyleExemplar } from "@/lib/types";

export function ExemplarEditor(props: {
  exemplar?: StyleExemplar | null;
  onSave: (input: {
    label: string;
    criterionCode: string;
    text: string;
    approvedOutcome: boolean;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    label: props.exemplar?.label ?? "",
    criterionCode: props.exemplar?.criterionCode ?? "05",
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
          <span>Criterion code</span>
          <input
            value={draft.criterionCode}
            onChange={(event) => setDraft((current) => ({ ...current, criterionCode: event.target.value }))}
            className="w-full rounded-[12px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[12px] text-[var(--foreground)] outline-none"
          />
        </label>
      </div>
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
              await props.onSave(draft);
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
