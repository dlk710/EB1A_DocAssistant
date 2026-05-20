import type { WorkspaceCoverage } from "@/lib/types";

export function CoverageCard(props: { coverage: WorkspaceCoverage | null }) {
  const criteria = props.coverage?.criteria ?? [];
  const strongCount = props.coverage?.strongCount ?? 0;
  const totalCriteria = criteria.length || 11;

  return (
    <section className="rounded-[24px] bg-[var(--brand-charcoal)] px-5 py-5 text-white shadow-[0_24px_50px_rgba(15,23,42,0.18)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">
        Coverage at a glance
      </p>
      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-[var(--font-display)] text-[34px] tracking-[-0.05em] text-[var(--brand)]">
            {strongCount} of {totalCriteria} strong
          </h2>
          <p className="mt-1 text-[12px] leading-6 text-white/70">
            Strategy works from the client-wide kept and pending evidence set.
          </p>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
          {props.coverage?.meetsMinimum ? "Meets threshold minimum" : "Below threshold"}
        </div>
      </div>

      <div
        className="mt-4 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(totalCriteria, 1)}, minmax(0, 1fr))` }}
      >
        {criteria.map((criterion) => (
          <span
            key={criterion.code}
            className={`h-3 rounded-full ${
              criterion.state === "strong"
                ? "bg-[var(--brand)]"
                : criterion.state === "partial"
                  ? "bg-[var(--brand-amber-mid)]"
                  : "bg-white/15"
            }`}
            title={criterion.name}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.14em] text-white/72">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
          strong
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-amber-mid)]" />
          partial
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          empty
        </span>
      </div>
    </section>
  );
}
