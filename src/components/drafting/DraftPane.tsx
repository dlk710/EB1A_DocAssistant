"use client";

import type { DraftParagraph } from "@/lib/types";

export function DraftPane(props: {
  paragraphs: DraftParagraph[];
  onChangeParagraph: (paragraphId: string, text: string) => void;
}) {
  return (
    <section className="rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-cream)] px-5 py-6">
        <div className="space-y-5">
          {props.paragraphs.length ? (
            props.paragraphs.map((paragraph) => (
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
                      Ex. {reference}
                    </span>
                  ))}
                </div>
                {paragraph.citations.length ? (
                  <div className="flex flex-wrap gap-2">
                    {paragraph.citations.map((citation) => (
                      <a
                        key={`${paragraph.id}-${citation.docId}-${citation.supports}`}
                        href={`/api/documents/${citation.docId}/source`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full border border-[var(--brand)]/25 bg-white px-2.5 py-1 text-[10px] font-medium text-[var(--brand-deep)]"
                      >
                        {citation.supports}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-[16px] border border-dashed border-[var(--border-primary)] bg-white px-4 py-5 text-[12px] leading-6 text-[var(--muted)]">
              No draft exists yet. Use Regenerate or Ask Setu Draft mode to create the first version.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
