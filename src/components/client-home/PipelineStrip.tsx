const PIPELINE_STAGES = [
  "Onboarding",
  "Review",
  "Strategy",
  "Lock",
  "Drafting",
  "Stitching",
] as const;

interface PipelineStripProps {
  currentStage: number;
}

function pillClassName(index: number, currentStage: number) {
  const stageNumber = index + 1;

  if (stageNumber < currentStage) {
    return "border-[var(--state-success)] bg-[var(--state-success-soft)] text-[var(--state-success)]";
  }

  if (stageNumber === currentStage) {
    return "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-white";
  }

  return "border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--muted)]";
}

function barClassName(index: number, currentStage: number) {
  return index + 1 < currentStage ? "bg-[var(--brand)]" : "bg-[var(--border-secondary)]";
}

export function PipelineStrip({ currentStage }: PipelineStripProps) {
  return (
    <div className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Pipeline
        </span>
        {PIPELINE_STAGES.map((stage, index) => (
          <div key={stage} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${pillClassName(
                index,
                currentStage,
              )}`}
              title={index >= 2 ? "Available in a later phase." : undefined}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              {stage}
            </span>
            {index < PIPELINE_STAGES.length - 1 ? (
              <span
                className={`hidden h-[2px] w-8 rounded-full md:block ${barClassName(
                  index,
                  currentStage,
                )}`}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
