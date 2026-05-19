"use client";

import { LoaderCircle } from "lucide-react";

export function SynthesisToolbar(props: {
  versionNumbers: number[];
  currentVersion: number | null;
  isSaving: boolean;
  isGenerating: boolean;
  isApproving: boolean;
  onRegenerate: () => void;
  onApprove: () => void;
  onCompare: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-medium text-[var(--muted)]">
          {props.isSaving ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Auto-saving…
            </span>
          ) : (
            `Version ${props.currentVersion ?? "—"} saved`
          )}
        </span>
        <button
          type="button"
          onClick={props.onCompare}
          disabled={props.versionNumbers.length < 2}
          className="rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] disabled:opacity-40"
        >
          {props.versionNumbers.join(" ")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={props.onRegenerate}
          disabled={props.isGenerating}
          className="rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] disabled:opacity-40"
        >
          {props.isGenerating ? "Regenerating…" : "Regenerate"}
        </button>
        <button
          type="button"
          onClick={props.onApprove}
          disabled={props.isApproving || props.currentVersion === null}
          className="setu-primary-button rounded-[10px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-40"
        >
          {props.isApproving ? "Approving…" : "Mark as approved"}
        </button>
      </div>
    </div>
  );
}
