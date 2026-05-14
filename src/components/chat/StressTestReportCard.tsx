"use client";

import { Pin } from "lucide-react";
import type { ChatMessageCitation, StressTestReport } from "@/lib/types";

export function StressTestReportCard(props: {
  report: StressTestReport;
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
            Stress-test report
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">
            {props.report.challenges.length} challenge(s) surfaced
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

      <div className="mt-3 space-y-2">
        {props.report.challenges.map((challenge, index) => (
          <div key={`${challenge.criterionCode}-${index}`} className="rounded-[12px] bg-rose-50 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-800">
                {challenge.criterionCode}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-800">
                {challenge.severity}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-800">
                {challenge.challengeType}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-rose-900">{challenge.uscisStance}</p>
            <p className="mt-1 text-[11px] leading-5 text-rose-900/80">
              {challenge.suggestedActionDetail}
            </p>
          </div>
        ))}
      </div>

      {props.pendingDisclosure ? (
        <div className="mt-3 rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[11px] leading-5 text-[var(--muted)]">
          {props.pendingDisclosure}
        </div>
      ) : null}

      {props.citations.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {props.citations.map((citation) => (
            <span
              key={citation.docId}
              className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
            >
              {citation.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
