"use client";

import { CitationChip } from "@/components/chat/CitationChip";
import { ReasoningExpansion } from "@/components/chat/ReasoningExpansion";
import type { ChatMessageCitation, StrategyMemo } from "@/lib/types";

export function StrategyMemoCard(props: {
  memo: StrategyMemo | null;
  citations: ChatMessageCitation[];
  reasoning: string;
  pendingDisclosure?: string | null;
  droppedClaims?: string[];
  onPin?: () => void;
  onRegenerate?: () => void;
  onStressTest?: () => void;
  onCommitToLock?: () => void;
  isBusy?: boolean;
}) {
  if (!props.memo) {
    return (
      <section className="rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Strategy memo
        </p>
        <p className="mt-3 text-[13px] leading-6 text-[var(--muted)]">
          Setu will generate the first client-wide memo once this page loads.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Strategy memo
          </p>
          <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            Lead argument {props.memo.leadArgument.criterionCode}
          </h3>
        </div>
        <span className="rounded-full bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Memo v{props.memo.createdAt.slice(0, 10)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <div className="rounded-[16px] bg-[var(--paper-tertiary)] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Lead argument
            </p>
            <p className="mt-2 text-[13px] leading-7 text-[var(--foreground)]">
              {props.memo.leadArgument.narrativeSpine}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[16px] bg-[var(--brand-soft)] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                Recommended mix
              </p>
              <div className="mt-3 space-y-3">
                {props.memo.recommendedMix.primary.map((entry) => (
                  <div key={`primary-${entry.criterionCode}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-deep)]">
                      Primary · {entry.criterionCode}
                    </p>
                    <p className="mt-1 text-[12px] leading-6 text-[var(--foreground)]">
                      {entry.rationale}
                    </p>
                  </div>
                ))}
                {props.memo.recommendedMix.supporting.map((entry) => (
                  <div key={`supporting-${entry.criterionCode}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Supporting · {entry.criterionCode}
                    </p>
                    <p className="mt-1 text-[12px] leading-6 text-[var(--foreground)]">
                      {entry.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[16px] bg-[var(--state-warning-soft)] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--state-warning)]">
                  Gaps
                </p>
                <div className="mt-3 space-y-3">
                  {props.memo.gaps.length ? (
                    props.memo.gaps.map((gap) => (
                      <div key={`${gap.criterionCode}-${gap.type}`}>
                        <p className="text-[11px] font-semibold text-[var(--foreground)]">
                          {gap.criterionCode} · {gap.type}
                        </p>
                        <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
                          {gap.description}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] leading-6 text-[var(--muted)]">No major gaps surfaced.</p>
                  )}
                </div>
              </div>
              <div className="rounded-[16px] bg-[var(--paper-tertiary)] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Risks
                </p>
                <div className="mt-3 space-y-3">
                  {props.memo.risks.length ? (
                    props.memo.risks.map((risk) => (
                      <div key={`${risk.type}-${risk.description.slice(0, 16)}`}>
                        <p className="text-[11px] font-semibold text-[var(--foreground)]">
                          {risk.severity} · {risk.type}
                        </p>
                        <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
                          {risk.description}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] leading-6 text-[var(--muted)]">No major risks surfaced.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {props.pendingDisclosure ? (
            <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-3 text-[11px] leading-6 text-[var(--muted)]">
              {props.pendingDisclosure}
            </div>
          ) : null}

          {props.citations.length ? (
            <div className="flex flex-wrap gap-1.5">
              {props.citations.map((citation) => (
                <CitationChip key={`${citation.docId}-${citation.supports}`} citation={citation} />
              ))}
            </div>
          ) : null}

          <ReasoningExpansion reasoning={props.reasoning} droppedClaims={props.droppedClaims} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-[var(--border-secondary)] pt-4">
        <span className="text-[11px] leading-6 text-[var(--muted)]">
          Lock commits the criteria mix and stable exhibit numbering. You can still unlock later.
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onPin}
            disabled={props.isBusy || !props.onPin}
            className="inline-flex items-center rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Pin to workspace
          </button>
          <button
            type="button"
            onClick={props.onRegenerate}
            disabled={props.isBusy}
            className="inline-flex items-center rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={props.onStressTest}
            disabled={props.isBusy}
            className="inline-flex items-center rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
          >
            Stress-test this
          </button>
          <button
            type="button"
            onClick={props.onCommitToLock}
            disabled={props.isBusy}
            className="setu-primary-button inline-flex items-center rounded-[8px] px-4 py-2 text-[11px] font-semibold text-white"
          >
            Commit to Lock
          </button>
        </div>
      </div>
    </section>
  );
}
