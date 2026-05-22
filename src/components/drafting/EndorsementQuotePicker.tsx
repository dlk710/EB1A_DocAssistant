"use client";

import type { EndorsementQuote } from "@/lib/types";

export function EndorsementQuotePicker(props: {
  suggestions: EndorsementQuote[];
  onAcceptQuote: (quote: EndorsementQuote) => void;
}) {
  if (!props.suggestions.length) {
    return (
      <div className="rounded-[16px] border border-dashed border-[var(--border-primary)] bg-white px-4 py-4 text-[12px] leading-6 text-[var(--muted)]">
        No candidate recommendation-letter passages were found for this sub-claim yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {props.suggestions.map((quote) => (
        <article
          key={quote.id}
          className="rounded-[16px] border border-[var(--border-secondary)] bg-white px-4 py-4"
        >
          <p className="text-[12px] leading-6 text-[var(--foreground)]">
            “{quote.quoteText}”
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--paper-primary)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)]">
              {quote.expertName}
            </span>
            <span className="rounded-full bg-[var(--paper-primary)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)]">
              {quote.sourceExhibitNumber}
            </span>
            <button
              type="button"
              onClick={() => props.onAcceptQuote(quote)}
              className="setu-primary-button rounded-[10px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Accept quote
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
