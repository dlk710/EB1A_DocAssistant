import type { WorkspaceCoverage } from "@/lib/types";

interface CoverageCardProps {
  coverage: WorkspaceCoverage | null;
}

function barClassName(state: WorkspaceCoverage["criteria"][number]["state"]) {
  switch (state) {
    case "strong":
      return "bg-[var(--state-success)]";
    case "partial":
      return "bg-[var(--brand)]";
    default:
      return "bg-[var(--border-secondary)]";
  }
}

export function CoverageCard({ coverage }: CoverageCardProps) {
  if (!coverage) {
    return (
      <div className="setu-panel rounded-[18px] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Coverage
        </p>
        <p className="mt-3 text-[12px] leading-6 text-[var(--muted)]">
          Coverage becomes available after documents are tagged.
        </p>
      </div>
    );
  }

  const strongCriteria = coverage.criteria.filter((criterion) => criterion.state === "strong");
  const partialCriteria = coverage.criteria.filter((criterion) => criterion.state === "partial");

  return (
    <div className="setu-panel rounded-[18px] px-4 py-4">
      <div className="flex items-start gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Coverage
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[28px] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {coverage.strongCount}
            </span>
            <span className="pb-1 text-[11px] text-[var(--muted)]">of 11 strong</span>
          </div>
        </div>
        <span className="ml-auto rounded-full bg-[var(--state-success-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--state-success)]">
          {coverage.meetsMinimum ? "minimum met" : "below minimum"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-11 gap-1.5">
        {coverage.criteria.map((criterion) => (
          <span
            key={criterion.code}
            className={`h-3 rounded-full ${barClassName(criterion.state)}`}
            title={`${criterion.legalCode} ${criterion.name}`}
          />
        ))}
      </div>
      <div className="mt-4 space-y-2 text-[11px] leading-5 text-[var(--muted)]">
        <p>
          Strong:{" "}
          {strongCriteria.length
            ? strongCriteria.map((criterion) => criterion.legalCode).join(", ")
            : "none yet"}
        </p>
        <p>
          Partial:{" "}
          {partialCriteria.length
            ? partialCriteria.map((criterion) => criterion.legalCode).join(", ")
            : "none"}
        </p>
      </div>
    </div>
  );
}
