import { ReviewDecisionExportButton } from "@/components/review/ReviewDecisionExportButton";
import {
  deriveDocumentDisposition,
  normalizeCriterionTags,
} from "@/lib/criterion-tags";
import type { EvidenceGridDocument } from "@/lib/evidence-query";
import type { PreliminaryStrategyGuidance } from "@/lib/preliminary-strategy";
import type { ClientTimelineEvent } from "@/lib/types";

interface ReviewDecisionLedgerProps {
  clientId: string;
  documents: EvidenceGridDocument[];
  guidance: PreliminaryStrategyGuidance;
  timelineEvents: ClientTimelineEvent[];
}

interface DecisionLogEntry {
  documentId: string;
  fileName: string;
  decision: string;
  origin: "ai" | "attorney";
  reason: string;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildAiDecisionEntries(
  documents: EvidenceGridDocument[],
): DecisionLogEntry[] {
  return documents.flatMap((document) =>
    normalizeCriterionTags(document)
      .filter((tag) => tag.origin === "ai_auto" && tag.state === "enabled")
      .map((tag) => ({
        documentId: document.id,
        fileName: document.fileName,
        decision: `Auto-enabled ${tag.name} as ${tag.role}`,
        origin: "ai" as const,
        reason: tag.autoTagReason ?? "Confidence and document-type prior agreed.",
      })),
  );
}

function buildAttorneyDecisionEntries(
  documents: EvidenceGridDocument[],
): DecisionLogEntry[] {
  const tagDecisions = documents.flatMap((document) =>
    normalizeCriterionTags(document)
      .filter((tag) => tag.origin === "attorney")
      .map((tag) => ({
        documentId: document.id,
        fileName: document.fileName,
        decision: `Attorney set ${tag.name} to ${tag.state} ${tag.role}`,
        origin: "attorney" as const,
        reason: tag.reasoning || "Manual attorney override.",
      })),
  );
  const dispositionDecisions = documents
    .map((document) => ({
      document,
      disposition: deriveDocumentDisposition(document),
    }))
    .filter(
      (entry) =>
        entry.disposition === "archived" || entry.disposition === "reference",
    )
    .map((entry) => ({
      documentId: entry.document.id,
      fileName: entry.document.fileName,
      decision: `Attorney marked as ${entry.disposition}`,
      origin: "attorney" as const,
      reason:
        entry.disposition === "archived"
          ? "Removed from active petition evidence."
          : "Kept as reference/context rather than petition anchor evidence.",
    }));

  return [...tagDecisions, ...dispositionDecisions];
}

function workflowRows(input: {
  documents: EvidenceGridDocument[];
  guidance: PreliminaryStrategyGuidance;
  aiDecisionCount: number;
  attorneyDecisionCount: number;
}) {
  const summarized = input.documents.filter((document) => document.summary).length;
  const tagged = input.documents.filter(
    (document) => normalizeCriterionTags(document).length > 0,
  ).length;
  const weighted =
    input.guidance.evidencePlan.anchor.length +
    input.guidance.evidencePlan.supporting.length +
    input.guidance.evidencePlan.context.length +
    input.guidance.evidencePlan.exclusions.length;

  return [
    {
      label: "1. Upload and index",
      status: input.documents.length > 0 ? "done" : "pending",
      detail: `${input.documents.length} evidence file(s) loaded.`,
    },
    {
      label: "2. Summarize evidence",
      status: summarized === input.documents.length ? "done" : "working",
      detail: `${summarized} of ${input.documents.length} document(s) summarized.`,
    },
    {
      label: "3. Bundle and classify",
      status: tagged > 0 ? "done" : "working",
      detail: `${tagged} document(s) have criterion signals.`,
    },
    {
      label: "4. Review by exception",
      status: input.guidance.exceptionDocuments > 0 ? "working" : "done",
      detail: `${input.aiDecisionCount} AI decision(s); ${input.guidance.exceptionDocuments} exception document(s).`,
    },
    {
      label: "5. Weight packet evidence",
      status: weighted > 0 ? "done" : "working",
      detail: `${input.guidance.evidencePlan.anchor.length} anchor, ${input.guidance.evidencePlan.exclusions.length} excluded.`,
    },
    {
      label: "6. Track attorney decisions",
      status: input.attorneyDecisionCount > 0 ? "done" : "ready",
      detail: `${input.attorneyDecisionCount} attorney decision(s) currently visible.`,
    },
    {
      label: "7. Move to Strategy",
      status: input.guidance.candidateCriteria.length > 0 ? "ready" : "working",
      detail:
        input.guidance.candidateCriteria.length > 0
          ? "Strategy can start from the preliminary case map."
          : "Waiting for criterion signals before strategy.",
    },
  ];
}

function statusClass(status: string) {
  if (status === "done" || status === "ready") {
    return "bg-[var(--brand-soft)] text-[var(--brand-deep)]";
  }

  if (status === "working") {
    return "bg-[var(--state-warning-soft)] text-[var(--state-warning)]";
  }

  return "bg-[var(--paper-secondary)] text-[var(--muted)]";
}

export function ReviewDecisionLedger({
  clientId,
  documents,
  guidance,
  timelineEvents,
}: ReviewDecisionLedgerProps) {
  const aiDecisions = buildAiDecisionEntries(documents);
  const attorneyDecisions = buildAttorneyDecisionEntries(documents);
  const rows = workflowRows({
    documents,
    guidance,
    aiDecisionCount: aiDecisions.length,
    attorneyDecisionCount: attorneyDecisions.length,
  });
  const recentReviewEvents = timelineEvents
    .filter((event) =>
      ["review-action-taken", "manual-override", "strategy-unlocked"].includes(event.kind),
    )
    .slice(0, 5);
  const exportPayload = {
    schemaVersion: "setu-review-decision-log/1.0",
    clientId,
    generatedAt: new Date().toISOString(),
    workflow: rows,
    aiDecisions,
    attorneyDecisions,
    evidencePlan: guidance.evidencePlan,
    candidateCriteria: guidance.candidateCriteria,
    remainingExceptions: guidance.exceptionDocuments,
    recentReviewEvents,
  };

  return (
    <section className="rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Review workflow ledger
          </p>
          <h2 className="mt-2 text-[20px] font-semibold text-[var(--foreground)]">
            Minimal human review, every decision traceable
          </h2>
          <p className="mt-2 max-w-4xl text-[12px] leading-6 text-[var(--muted)]">
            Setu records AI auto-decisions, attorney overrides, packet exclusions, and remaining
            exception work so the case can move to Strategy without losing auditability.
          </p>
        </div>
        <ReviewDecisionExportButton
          fileName={`setu-review-decision-log-${clientId}.json`}
          payload={exportPayload}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-3 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] font-semibold text-[var(--foreground)]">
                  {row.label}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${statusClass(row.status)}`}
                >
                  {row.status}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                {row.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Decision snapshot
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-[var(--muted)]">
              <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2">
                <p className="text-[16px] font-semibold text-[var(--foreground)]">
                  {aiDecisions.length}
                </p>
                <p>AI auto-decisions</p>
              </div>
              <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2">
                <p className="text-[16px] font-semibold text-[var(--foreground)]">
                  {attorneyDecisions.length}
                </p>
                <p>attorney decisions</p>
              </div>
              <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2">
                <p className="text-[16px] font-semibold text-[var(--foreground)]">
                  {guidance.evidencePlan.anchor.length}
                </p>
                <p>anchor candidates</p>
              </div>
              <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2">
                <p className="text-[16px] font-semibold text-[var(--foreground)]">
                  {guidance.evidencePlan.exclusions.length}
                </p>
                <p>excluded from packet</p>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Recent attorney activity
            </p>
            <div className="mt-2 space-y-2">
              {recentReviewEvents.length ? (
                recentReviewEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2"
                  >
                    <p className="text-[11px] leading-5 text-[var(--foreground)]">
                      {event.summary}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      {new Date(event.occurredAt).toLocaleString()} · {event.kind}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-3 text-[12px] leading-6 text-[var(--muted)]">
                  No attorney changes logged yet. AI decisions remain visible and reversible.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--brand-deep)]">
        Strategy readiness: {guidance.draftStart.length} criterion candidate(s) are ready for
        brainstorming. Highest confidence anchor score is{" "}
        {guidance.evidencePlan.anchor[0]
          ? formatPercent(guidance.evidencePlan.anchor[0].highestConfidence)
          : "not available yet"}
        .
      </div>
    </section>
  );
}
