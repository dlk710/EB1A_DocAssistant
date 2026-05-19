"use client";

import type { ChatMessageCitation, SynthesisChatDraft } from "@/lib/types";

function criterionChipLabel(value: string) {
  return value.startsWith("(") ? value : `(${value})`;
}

export function SynthesisDraftCard(props: {
  draft: SynthesisChatDraft;
  citations: ChatMessageCitation[];
}) {
  return (
    <div className="rounded-[14px] border border-[var(--border-secondary)] bg-white p-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Synthesis draft
        </p>
        <p className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">
          {props.draft.title}
        </p>
      </div>

      <div className="mt-3 space-y-3">
        {props.draft.paragraphs.map((paragraph, index) => (
          <div
            key={`${props.draft.kind}-${index}`}
            className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2.5"
          >
            <p className="font-serif text-[13px] leading-7 text-[var(--foreground)]">
              {paragraph.text}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {paragraph.exhibitRefs.map((reference) => (
                <span
                  key={`${index}-exhibit-${reference}`}
                  className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-800"
                >
                  {reference}
                </span>
              ))}
              {paragraph.criterionRefs.map((reference) => (
                <span
                  key={`${index}-criterion-${reference}`}
                  className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-deep)]"
                >
                  {criterionChipLabel(reference)}
                </span>
              ))}
            </div>
            {paragraph.factCheckStatus && paragraph.factCheckStatus !== "verified" ? (
              <p className="mt-2 text-[10px] leading-5 text-[var(--state-warning)]">
                {paragraph.factCheckNotes || "Review this paragraph against the cited sources."}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {props.draft.genericProseWarning ? (
        <div className="mt-3 rounded-[12px] bg-[var(--state-warning-soft)] px-3 py-2 text-[10px] leading-5 text-[var(--state-warning)]">
          {props.draft.genericProseWarning}
        </div>
      ) : null}

      {props.citations.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {props.citations.map((citation) => (
            <span
              key={`${citation.docId}-${citation.supports}`}
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
