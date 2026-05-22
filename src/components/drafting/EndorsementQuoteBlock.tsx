"use client";

import type { EndorsementQuote } from "@/lib/types";

export function EndorsementQuoteBlock(props: {
  quote: EndorsementQuote;
  onRemove?: () => void;
}) {
  return (
    <article className="rounded-[18px] border border-[var(--border-secondary)] bg-white px-4 py-4">
      <blockquote className="font-serif text-[14px] leading-7 text-[var(--foreground)]">
        “{props.quote.quoteText}”
      </blockquote>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-deep)]">
          {props.quote.expertName}
        </span>
        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)]">
          {props.quote.expertTitleAtLetter}
        </span>
        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)]">
          {props.quote.sourceExhibitNumber}
        </span>
        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)]">
          {props.quote.isIndependent === null
            ? "Independence unresolved"
            : props.quote.isIndependent
              ? "Independent"
              : "Employer-linked"}
        </span>
        {props.onRemove ? (
          <button
            type="button"
            onClick={props.onRemove}
            className="rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]"
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-6 text-[var(--muted)]">
        Supports: {props.quote.supportsClaim || "Sub-claim support"}
      </p>
    </article>
  );
}
