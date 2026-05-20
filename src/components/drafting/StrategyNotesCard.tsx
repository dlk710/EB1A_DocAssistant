"use client";

export function StrategyNotesCard(props: {
  legalCode: string;
  criterionName: string;
  rationale: string;
  narrativeSpine: string;
  anchorExhibits: string[];
}) {
  return (
    <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Locked strategy notes
      </p>
      <h2 className="mt-2 text-[14px] font-semibold text-[var(--foreground)]">
        {props.criterionName}
      </h2>
      <p className="mt-3 text-[12px] leading-6 text-[var(--foreground)]">{props.rationale}</p>
      <p className="mt-3 text-[11px] leading-6 text-[var(--muted)]">{props.narrativeSpine}</p>
      {props.anchorExhibits.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.anchorExhibits.map((label) => (
            <span
              key={label}
              className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-deep)]"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
