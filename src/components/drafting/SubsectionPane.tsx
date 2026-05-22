"use client";

import { EndorsementQuoteBlock } from "@/components/drafting/EndorsementQuoteBlock";
import { EndorsementQuotePicker } from "@/components/drafting/EndorsementQuotePicker";
import { GapNote } from "@/components/drafting/GapNote";
import type { EndorsementQuote, SubsectionDraft } from "@/lib/types";

export function SubsectionPane(props: {
  subsection: SubsectionDraft | null;
  quoteSuggestions: EndorsementQuote[];
  onChangeParagraph: (paragraphId: string, text: string) => void;
  onAddParagraph: () => void;
  onAcceptQuote: (quote: EndorsementQuote) => void;
  onRemoveQuote: (quoteId: string) => void;
}) {
  if (!props.subsection) {
    return (
      <section className="rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="rounded-[18px] border border-dashed border-[var(--border-primary)] bg-white px-5 py-6 text-[12px] leading-6 text-[var(--muted)]">
          Select a subsection to begin drafting.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-cream)] px-5 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              {props.subsection.level === 0
                ? "Criterion introduction"
                : props.subsection.level === 1
                  ? "Section"
                  : "Sub-claim"}
            </p>
            <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {props.subsection.title}
            </h2>
            {props.subsection.supportsClaim ? (
              <p className="mt-2 max-w-[760px] text-[12px] leading-6 text-[var(--muted)]">
                {props.subsection.supportsClaim}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onAddParagraph}
            className="rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]"
          >
            Add paragraph
          </button>
        </div>

        <GapNote notes={props.subsection.gapNotes ?? []} />

        <div className="mt-5 space-y-5">
          {props.subsection.paragraphs.length ? (
            props.subsection.paragraphs.map((paragraph) => (
              <article key={paragraph.id} className="space-y-3">
                <textarea
                  value={paragraph.text}
                  onChange={(event) => props.onChangeParagraph(paragraph.id, event.target.value)}
                  className="min-h-[120px] w-full resize-y border-0 bg-transparent font-serif text-[15px] leading-8 text-[var(--foreground)] outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  {paragraph.exhibitRefs.map((reference) => (
                    <span
                      key={`${paragraph.id}-${reference}`}
                      className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800"
                    >
                      {reference}
                    </span>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[16px] border border-dashed border-[var(--border-primary)] bg-white px-4 py-5 text-[12px] leading-6 text-[var(--muted)]">
              No subsection draft exists yet. Generate this subsection or ask Setu Draft mode to draft it.
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Endorsement quotes
          </p>
          {props.subsection.endorsementQuotes.length ? (
            <div className="space-y-3">
              {props.subsection.endorsementQuotes.map((quote) => (
                <EndorsementQuoteBlock
                  key={quote.id}
                  quote={quote}
                  onRemove={() => props.onRemoveQuote(quote.id)}
                />
              ))}
            </div>
          ) : (
            <GapNote notes={["No accepted endorsement quote is currently attached to this subsection."]} />
          )}
        </div>

        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Candidate passages
          </p>
          <div className="mt-3">
            <EndorsementQuotePicker
              suggestions={props.quoteSuggestions}
              onAcceptQuote={props.onAcceptQuote}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
