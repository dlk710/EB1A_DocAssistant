import Link from "next/link";
import type {
  PreliminaryCriterionSignal,
  PreliminaryEvidenceWeight,
  PreliminaryStrategyGuidance,
} from "@/lib/preliminary-strategy";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function RolePill({ role }: { role: PreliminaryCriterionSignal["suggestedRole"] }) {
  const label =
    role === "primary" ? "Primary" : role === "supporting" ? "Supporting" : "Defer";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
        role === "primary"
          ? "bg-[var(--brand-charcoal)] text-white"
          : role === "supporting"
            ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
            : "bg-[var(--paper-secondary)] text-[var(--muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function EvidenceRow({ evidence }: { evidence: PreliminaryEvidenceWeight }) {
  const criteria = evidence.criterionCodes.length
    ? evidence.criterionCodes.join(", ")
    : "No criterion";

  return (
    <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-[12px] font-semibold leading-5 text-[var(--foreground)]">
          {evidence.fileName}
        </p>
        <span className="shrink-0 rounded-full bg-[var(--paper-secondary)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          {criteria}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
        {evidence.reason}
      </p>
    </div>
  );
}

function SignalCard({ signal }: { signal: PreliminaryCriterionSignal }) {
  return (
    <article className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {signal.legalCode} · {signal.strength}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
            {signal.name}
          </h3>
        </div>
        <RolePill role={signal.suggestedRole} />
      </div>

      <p className="mt-3 text-[12px] leading-6 text-[var(--foreground)]">
        {signal.rationale}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
        {signal.nextStep}
      </p>

      <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] text-[var(--muted)]">
        <div>
          <p className="text-[12px] font-semibold text-[var(--foreground)]">
            {signal.enabledCount}
          </p>
          <p>enabled</p>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-[var(--foreground)]">
            {signal.suggestedCount}
          </p>
          <p>suggested</p>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-[var(--foreground)]">
            {signal.autoCount}
          </p>
          <p>AI set</p>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-[var(--foreground)]">
            {formatPercent(signal.averageConfidence)}
          </p>
          <p>conf.</p>
        </div>
      </div>
    </article>
  );
}

export function PreliminaryStrategyPanel({
  guidance,
  strategyHref,
}: {
  guidance: PreliminaryStrategyGuidance;
  strategyHref: string;
}) {
  const topSignals = guidance.candidateCriteria.slice(0, 5);

  return (
    <section className="rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            AI preliminary case map
          </p>
          <h2 className="mt-2 text-[20px] font-semibold text-[var(--foreground)]">
            Candidate looks strongest in{" "}
            {guidance.primary.length
              ? guidance.primary.map((signal) => signal.name).join(", ")
              : "the criteria below"}
          </h2>
          <p className="mt-2 max-w-4xl text-[12px] leading-6 text-[var(--muted)]">
            Use this as the first strategy hypothesis. The exception queue refines the theory; it
            does not have to block the first attorney strategy pass.
          </p>
        </div>
        <Link
          href={strategyHref}
          className="setu-primary-button inline-flex items-center justify-center rounded-[8px] px-4 py-2 text-[11px] font-semibold text-white"
        >
          Brainstorm strategy
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-[14px] bg-[var(--paper-secondary)] px-3 py-3">
          <p className="text-[18px] font-semibold text-[var(--foreground)]">
            {guidance.primary.length}
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            likely primary
          </p>
        </div>
        <div className="rounded-[14px] bg-[var(--paper-secondary)] px-3 py-3">
          <p className="text-[18px] font-semibold text-[var(--foreground)]">
            {guidance.supporting.length}
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            supporting
          </p>
        </div>
        <div className="rounded-[14px] bg-[var(--paper-secondary)] px-3 py-3">
          <p className="text-[18px] font-semibold text-[var(--foreground)]">
            {guidance.autoTaggedDocuments}
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            auto-tagged docs
          </p>
        </div>
        <div className="rounded-[14px] bg-[var(--paper-secondary)] px-3 py-3">
          <p className="text-[18px] font-semibold text-[var(--foreground)]">
            {guidance.exceptionDocuments}
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            exception docs
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Initial packet evidence plan
          </p>
          <p className="mt-2 text-[12px] leading-6 text-[var(--foreground)]">
            AI separates petition-ready anchors from supporting context and weak evidence so Strategy
            can start with the strongest exhibits first.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-[var(--muted)] sm:grid-cols-4">
            <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2">
              <p className="text-[16px] font-semibold text-[var(--foreground)]">
                {guidance.evidencePlan.anchor.length}
              </p>
              <p>anchors</p>
            </div>
            <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2">
              <p className="text-[16px] font-semibold text-[var(--foreground)]">
                {guidance.evidencePlan.supporting.length}
              </p>
              <p>supporting</p>
            </div>
            <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2">
              <p className="text-[16px] font-semibold text-[var(--foreground)]">
                {guidance.evidencePlan.context.length}
              </p>
              <p>context</p>
            </div>
            <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2">
              <p className="text-[16px] font-semibold text-[var(--foreground)]">
                {guidance.evidencePlan.exclusions.length}
              </p>
              <p>excluded</p>
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Exclusions from initial packet
            </p>
            <span className="text-[10px] text-[var(--muted)]">
              Preserved with reasoning for override
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {guidance.evidencePlan.exclusions.slice(0, 5).map((evidence) => (
              <EvidenceRow key={evidence.documentId} evidence={evidence} />
            ))}
            {!guidance.evidencePlan.exclusions.length ? (
              <p className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-3 text-[12px] leading-6 text-[var(--muted)]">
                No exclusions yet. As tags settle, low-value or weakly supported files will appear
                here with a reason.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {topSignals.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {topSignals.map((signal) => (
            <SignalCard key={signal.code} signal={signal} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-4 text-[12px] leading-6 text-[var(--muted)]">
          Setu does not have enough criterion signals yet. Let indexing finish, then return here
          for the preliminary case map.
        </div>
      )}

      {guidance.attorneyFocus.length ? (
        <div className="mt-4 rounded-[14px] border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--state-warning)]">
            Attorney focus before lock
          </p>
          <div className="mt-2 space-y-1">
            {guidance.attorneyFocus.map((item) => (
              <p key={item} className="text-[12px] leading-6 text-[var(--foreground)]">
                {item}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
