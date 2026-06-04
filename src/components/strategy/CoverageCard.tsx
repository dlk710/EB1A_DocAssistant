import type { WorkspaceCoverage } from "@/lib/types";

export function CoverageCard(props: { coverage: WorkspaceCoverage | null }) {
  const criteria = props.coverage?.criteria ?? [];
  const strongCount = props.coverage?.strongCount ?? 0;
  const totalCriteria = criteria.length || 11;
  const buildAround = props.coverage?.recommendations?.buildAround ?? [];
  const drop = props.coverage?.recommendations?.drop ?? [];

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

      {buildAround.length > 0 ? (
        <div className="mt-5 rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
              Setu strategy recommendation
            </p>
            <p className="text-[10px] text-white/62">
              Attorney selects at Lock; nothing is auto-dropped.
            </p>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {buildAround.slice(0, 5).map((entry) => (
              <div
                key={entry.criterionCode}
                className="rounded-[14px] border border-white/10 bg-black/12 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-white">
                      {entry.legalCode} · {entry.name}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-white/68">
                      {entry.rationale}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--brand)]/16 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
                    {entry.role}
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-white/55">
                  {entry.decisiveIndependentCount} decisive independent ·{" "}
                  {entry.liabilityCount} liability · score {entry.score}
                </p>
              </div>
            ))}
          </div>
          {drop.length > 0 ? (
            <p className="mt-3 text-[11px] leading-5 text-white/62">
              Defer for now:{" "}
              {drop
                .slice(0, 4)
                .map((entry) => entry.name)
                .join(", ")}
              {drop.length > 4 ? ` +${drop.length - 4} more` : ""}.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
