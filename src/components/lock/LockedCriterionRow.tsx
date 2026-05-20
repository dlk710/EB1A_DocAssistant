import type { LockedCriterionEntry } from "@/lib/types";

export function LockedCriterionRow(props: { entry: LockedCriterionEntry }) {
  return (
    <div
      className={`rounded-[16px] border px-4 py-4 ${
        props.entry.role === "primary"
          ? "border-[var(--brand)]/30 bg-[var(--brand-soft)]"
          : "border-[var(--border-secondary)] bg-[var(--paper-secondary)]"
      }`}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {props.entry.role} criterion
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
            {props.entry.criterionName}
          </h3>
          <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">
            {props.entry.rationale}
          </p>
        </div>
        <div className="space-y-2 text-right">
          <span className="rounded-full bg-[var(--paper-primary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            {props.entry.role}
          </span>
          <p className="text-[11px] text-[var(--foreground)]">
            {props.entry.anchorExhibits.length} exhibit
            {props.entry.anchorExhibits.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {props.entry.anchorExhibits.map((assignment) => (
          <span
            key={`${assignment.documentId}-${assignment.exhibitLabel}`}
            className="rounded-full bg-[var(--paper-primary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]"
          >
            {assignment.exhibitLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
