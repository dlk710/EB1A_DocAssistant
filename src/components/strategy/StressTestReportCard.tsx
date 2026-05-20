import { CitationChip } from "@/components/chat/CitationChip";
import { ReasoningExpansion } from "@/components/chat/ReasoningExpansion";
import { getCriterionDisplayName } from "@/lib/constants";
import type { ChatMessageCitation, StressTestReport } from "@/lib/types";

export function StressTestReportCard(props: {
  report: StressTestReport | null;
  citations: ChatMessageCitation[];
  reasoning: string;
  pendingDisclosure?: string | null;
  droppedClaims?: string[];
  onPin?: () => void;
  isBusy?: boolean;
}) {
  if (!props.report) {
    return null;
  }

  return (
    <section className="rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Stress-test report
          </p>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            {props.report.challenges.length} challenge(s) surfaced
          </h3>
        </div>
        <span className="rounded-full bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {props.report.scope === "full-petition"
            ? "full petition"
            : getCriterionDisplayName(props.report.scope.criterionCode)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {props.report.challenges.map((challenge, index) => (
          <article
            key={`${challenge.criterionCode}-${index}`}
            className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--paper-primary)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {getCriterionDisplayName(challenge.criterionCode)}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                  challenge.severity === "high"
                    ? "bg-[var(--state-danger-soft)] text-[var(--state-danger)]"
                    : challenge.severity === "medium"
                      ? "bg-[var(--state-warning-soft)] text-[var(--state-warning)]"
                      : "bg-[var(--state-success-soft)] text-[var(--state-success)]"
                }`}
              >
                {challenge.severity}
              </span>
              <span className="rounded-full bg-[var(--paper-primary)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {challenge.challengeType}
              </span>
            </div>
            <p className="mt-3 text-[12px] font-semibold leading-6 text-[var(--foreground)]">
              {challenge.uscisStance}
            </p>
            <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">
              {challenge.suggestedActionDetail}
            </p>
          </article>
        ))}
      </div>

      {props.pendingDisclosure ? (
        <div className="mt-4 rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-3 text-[11px] leading-6 text-[var(--muted)]">
          {props.pendingDisclosure}
        </div>
      ) : null}

      {props.citations.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {props.citations.map((citation) => (
            <CitationChip key={`${citation.docId}-${citation.supports}`} citation={citation} />
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <ReasoningExpansion reasoning={props.reasoning} droppedClaims={props.droppedClaims} />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={props.onPin}
          disabled={props.isBusy || !props.onPin}
          className="inline-flex items-center rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Pin to workspace
        </button>
      </div>
    </section>
  );
}
