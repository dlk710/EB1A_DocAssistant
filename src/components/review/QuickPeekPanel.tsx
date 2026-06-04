"use client";

import { useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "@/components/review/grid-icons";
import { describeCriterionTag } from "@/lib/criterion-tags";
import type { EvidenceGridDocument } from "@/lib/evidence-query";
import type { QuickPeekPayload } from "@/components/review/evidence-grid-types";

interface QuickPeekPanelProps {
  document: EvidenceGridDocument | null;
  payload: QuickPeekPayload | null;
  activeIndex: number;
  total: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function QuickPeekPanel({
  document,
  payload,
  activeIndex,
  total,
  onClose,
  onPrevious,
  onNext,
}: QuickPeekPanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        onPrevious();
      }

      if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  if (!document) {
    return null;
  }

  const previewHref = `/api/documents/${document.id}/preview/index.html${
    document.jobId ? `?jobId=${encodeURIComponent(document.jobId)}` : ""
  }`;
  const sourceHref = `/api/documents/${document.id}/source${
    document.jobId ? `?jobId=${encodeURIComponent(document.jobId)}` : ""
  }`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[color:rgba(26,26,31,0.22)]">
      <button
        type="button"
        aria-label="Close quick peek"
        className="flex-1 cursor-default"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-[min(1080px,100vw)] flex-col border-l border-[var(--border-secondary)] bg-[var(--paper-primary)] shadow-[-24px_0_48px_rgba(15,23,42,0.14)]">
        <div className="flex items-center justify-between border-b border-[var(--border-secondary)] px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Quick peek
            </p>
            <h3 className="mt-1 text-[16px] font-semibold text-[var(--foreground)]">
              {document.fileName}
            </h3>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              {activeIndex + 1} of {total}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-primary)] p-2 text-[var(--foreground)]"
            >
              <ChevronUpIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-primary)] p-2 text-[var(--foreground)]"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-primary)] p-2 text-[var(--foreground)]"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 lg:grid-cols-[minmax(0,1.45fr)_340px]">
          <section className="flex min-h-0 flex-col border-b border-[var(--border-secondary)] px-4 py-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Raw document
                </p>
                <p className="mt-1 text-[12px] text-[var(--muted)]">
                  The original file preview is shown here instead of the generated summary.
                </p>
              </div>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)]">
              <iframe
                key={previewHref}
                title={`${document.fileName} preview`}
                src={previewHref}
                className="h-full min-h-[520px] w-full bg-white"
              />
            </div>
          </section>

          <div className="space-y-4 overflow-y-auto px-4 py-4">
            <section className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Current criterion tags
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(payload?.tags ?? document.criteriaTags).length > 0 ? (
                  (payload?.tags ?? document.criteriaTags).map((tag) => (
                    <span
                      key={tag.id ?? `${document.id}:${tag.code}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        tag.state === "enabled"
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
                          : tag.state === "suggested"
                            ? "border-[var(--border-primary)] bg-[var(--paper-secondary)] text-[var(--foreground)]"
                            : "border-[var(--border-secondary)] bg-[var(--paper-tertiary)] text-[var(--muted)]"
                      }`}
                    >
                      {describeCriterionTag(tag)}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-[var(--muted)]">No criterion tags yet.</span>
                )}
              </div>
            </section>

            <section className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Source metadata
              </p>
              <dl className="mt-3 grid gap-3 text-[12px] text-[var(--foreground)]">
                <div>
                  <dt className="font-medium text-[var(--muted)]">Workspace</dt>
                  <dd>{payload?.metadata.workspaceLabel || document.folderLabel}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--muted)]">Path</dt>
                  <dd className="break-all">{payload?.metadata.relativePath || document.relativePath}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--muted)]">Bundle</dt>
                  <dd>{document.bundleName || payload?.metadata.bundleHint || "No bundle assigned"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--muted)]">Pages</dt>
                  <dd>{payload?.metadata.pageCount ?? document.pageCount ?? "Unknown"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-cream)] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Extracted text
              </p>
              <div className="mt-3 whitespace-pre-wrap text-[13px] leading-7 text-[var(--foreground)]">
                {payload?.previewText || document.contentPreview}
              </div>
            </section>
          </div>
        </div>

        <div className="border-t border-[var(--border-secondary)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)]"
            >
              Back to grid
            </button>
            <a
              href={sourceHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-[10px] border border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] px-3 py-2 text-[12px] font-semibold text-white"
            >
              Open full document
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
