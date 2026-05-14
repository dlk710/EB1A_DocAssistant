"use client";

import { Pin } from "lucide-react";
import type { BriefDraft, ChatMessageCitation } from "@/lib/types";

export function BriefDraftCard(props: {
  draft: BriefDraft;
  citations: ChatMessageCitation[];
  onPin?: () => void;
  isPinning?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--border-secondary)] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Brief draft
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">
            {props.draft.title}
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

      <div className="mt-3 space-y-3">
        {props.draft.paragraphs.map((paragraph, index) => (
          <div key={`${props.draft.title}-${index}`} className="rounded-[12px] bg-[var(--paper-primary)] px-3 py-2.5">
            <p className="font-serif text-[13px] leading-7 text-[var(--foreground)]">
              {paragraph.text}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {paragraph.exhibitRefs.map((reference) => (
                <span
                  key={`${index}-${reference}`}
                  className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-800"
                >
                  {reference}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

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
