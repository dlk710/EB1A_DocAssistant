"use client";

import { Pin } from "lucide-react";
import type { ChatMessageCitation, StrategyMemo } from "@/lib/types";

export function StrategyMemoCard(props: {
  memo: StrategyMemo;
  pendingDisclosure?: string | null;
  citations: ChatMessageCitation[];
  onPin?: () => void;
  isPinning?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--border-secondary)] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Strategy memo
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">
            Lead criterion {props.memo.leadArgument.criterionCode}
          </p>
        </div>
        {props.onPin ? (
          <button
            type="button"
            onClick={props.onPin}
            disabled={props.isPinning}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-[var(--paper-secondary)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Pin className="h-3 w-3" />
            {props.isPinning ? "Pinning..." : "Pin to workspace"}
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3">
        <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Lead argument
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--foreground)]">
            {props.memo.leadArgument.narrativeSpine}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Primary criteria
            </p>
            <div className="mt-2 space-y-2">
              {props.memo.recommendedMix.primary.length ? (
                props.memo.recommendedMix.primary.map((item) => (
                  <div key={`${item.criterionCode}-${item.rationale.slice(0, 24)}`}>
                    <p className="text-[11px] font-semibold text-[var(--foreground)]">
                      {item.criterionCode}
                    </p>
                    <p className="text-[11px] leading-5 text-[var(--muted)]">{item.rationale}</p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] leading-5 text-[var(--muted)]">No primary criteria proposed.</p>
              )}
            </div>
          </div>

          <div className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Supporting criteria
            </p>
            <div className="mt-2 space-y-2">
              {props.memo.recommendedMix.supporting.length ? (
                props.memo.recommendedMix.supporting.map((item) => (
                  <div key={`${item.criterionCode}-${item.rationale.slice(0, 24)}`}>
                    <p className="text-[11px] font-semibold text-[var(--foreground)]">
                      {item.criterionCode}
                    </p>
                    <p className="text-[11px] leading-5 text-[var(--muted)]">{item.rationale}</p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] leading-5 text-[var(--muted)]">No supporting criteria proposed.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[12px] bg-amber-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
              Gaps
            </p>
            <div className="mt-2 space-y-2">
              {props.memo.gaps.length ? (
                props.memo.gaps.map((gap) => (
                  <div key={`${gap.criterionCode}-${gap.type}`}>
                    <p className="text-[11px] font-semibold text-amber-900">
                      {gap.criterionCode} · {gap.type}
                    </p>
                    <p className="text-[11px] leading-5 text-amber-900/80">{gap.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] leading-5 text-amber-900/80">No major gaps surfaced.</p>
              )}
            </div>
          </div>

          <div className="rounded-[12px] bg-rose-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-800">
              Risks
            </p>
            <div className="mt-2 space-y-2">
              {props.memo.risks.length ? (
                props.memo.risks.map((risk) => (
                  <div key={`${risk.type}-${risk.description.slice(0, 24)}`}>
                    <p className="text-[11px] font-semibold text-rose-900">
                      {risk.severity} · {risk.type}
                    </p>
                    <p className="text-[11px] leading-5 text-rose-900/80">{risk.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] leading-5 text-rose-900/80">No major risks surfaced.</p>
              )}
            </div>
          </div>
        </div>

        {props.pendingDisclosure ? (
          <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[11px] leading-5 text-[var(--muted)]">
            {props.pendingDisclosure}
          </div>
        ) : null}

        {props.citations.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Citations
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {props.citations.map((citation) => (
                <span
                  key={citation.docId}
                  className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                >
                  {citation.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
