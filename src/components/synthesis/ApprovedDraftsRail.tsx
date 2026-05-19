"use client";

interface ApprovedDraftRailEntry {
  criterionCode: string;
  legalCode: string;
  criterionName: string;
  excerpt: string;
  approvedVersion: number;
}

export function ApprovedDraftsRail(props: {
  entries: ApprovedDraftRailEntry[];
  selectedCriterionCode: string | null;
  onSelect: (criterionCode: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Per-criterion drafts · approved
        </p>
        <div className="mt-3 space-y-2">
          {props.entries.map((entry) => (
            <button
              key={entry.criterionCode}
              type="button"
              onClick={() => props.onSelect(entry.criterionCode)}
              className={`w-full rounded-[14px] border px-3 py-3 text-left transition ${
                props.selectedCriterionCode === entry.criterionCode
                  ? "border-[var(--brand)]/30 bg-[var(--brand-soft)]"
                  : "border-[var(--border-secondary)] bg-[var(--paper-secondary)] hover:bg-white"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                {entry.legalCode}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">
                {entry.criterionName}
              </p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Approved v{entry.approvedVersion}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
