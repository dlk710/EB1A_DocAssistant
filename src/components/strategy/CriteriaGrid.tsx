import type { WorkspaceCoverage } from "@/lib/types";

export function CriteriaGrid(props: { coverage: WorkspaceCoverage | null }) {
  const visibleCriteria =
    props.coverage?.criteria.filter((criterion) => criterion.state !== "empty") ?? [];

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {visibleCriteria.map((criterion) => (
        <article
          key={criterion.code}
          className={`rounded-[18px] border px-4 py-4 ${
            criterion.state === "strong"
              ? "border-[var(--brand)]/35 bg-[var(--brand-soft)]"
              : "border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                {criterion.legalCode}
              </p>
              <h3 className="mt-2 text-[15px] font-semibold text-[var(--foreground)]">
                {criterion.name}
              </h3>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                criterion.state === "strong"
                  ? "bg-white text-[var(--brand-deep)]"
                  : "bg-white text-[var(--state-warning)]"
              }`}
            >
              {criterion.state}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--muted)]">
            <div>
              <p className="font-semibold text-[var(--foreground)]">{criterion.keptCount}</p>
              <p>kept docs</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--foreground)]">{criterion.primaryCount}</p>
              <p>primary</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--foreground)]">{criterion.supportingCount}</p>
              <p>supporting</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
