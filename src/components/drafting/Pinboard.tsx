"use client";

import { ArrowDown, ArrowUp, Plus } from "lucide-react";

interface PinboardEntryView {
  documentId: string;
  workspaceId: string;
  exhibitLabel: string;
  title: string;
  fileName: string;
}

interface SuggestedDocument {
  id: string;
  title: string;
  fileName: string;
}

export function Pinboard(props: {
  entries: PinboardEntryView[];
  suggestedDocuments?: SuggestedDocument[];
  onMoveEntry?: (documentId: string, direction: -1 | 1) => void;
  onAddDocument?: (documentId: string) => void;
}) {
  return (
    <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Pinboard
          </p>
          <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
            Anchor exhibits for this criterion.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {props.entries.length ? (
          props.entries.map((entry, index) => (
            <div
              key={entry.documentId}
              className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                    {entry.exhibitLabel}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">{entry.fileName}</p>
                </div>
                {props.onMoveEntry ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => props.onMoveEntry?.(entry.documentId, -1)}
                      disabled={index === 0}
                      className="rounded-[8px] border border-[var(--border-primary)] bg-white p-1.5 text-[var(--muted)] disabled:opacity-35"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onMoveEntry?.(entry.documentId, 1)}
                      disabled={index === props.entries.length - 1}
                      className="rounded-[8px] border border-[var(--border-primary)] bg-white p-1.5 text-[var(--muted)] disabled:opacity-35"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[14px] border border-dashed border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-4 text-[11px] leading-6 text-[var(--muted)]">
            No exhibits are pinned yet for this criterion.
          </div>
        )}
      </div>

      {props.suggestedDocuments?.length && props.onAddDocument ? (
        <div className="mt-4 border-t border-[var(--border-secondary)] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Add supporting docs
          </p>
          <div className="mt-3 space-y-2">
            {props.suggestedDocuments.slice(0, 6).map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => props.onAddDocument?.(document.id)}
                className="flex w-full items-start justify-between gap-3 rounded-[12px] border border-[var(--border-primary)] bg-white px-3 py-2 text-left transition hover:bg-[var(--paper-secondary)]"
              >
                <div>
                  <p className="text-[11px] font-medium text-[var(--foreground)]">{document.title}</p>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">{document.fileName}</p>
                </div>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-deep)]">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
