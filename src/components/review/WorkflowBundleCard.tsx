"use client";

import type { MouseEvent, ReactNode } from "react";
import type {
  ReviewBundleDecisionItem,
  ReviewBundleDocumentContext,
} from "@/components/review/workflow-types";

interface WorkflowBundleCardProps {
  item: ReviewBundleDecisionItem;
  stageLabel: string;
  helperText: string;
  actions: ReactNode;
  onContextMenu?: (item: ReviewBundleDecisionItem, event: MouseEvent<HTMLDivElement>) => void;
  onInspectBundle?: (item: ReviewBundleDecisionItem) => void;
  onQuickPeekDocument?: (document: ReviewBundleDocumentContext) => void;
}

export function WorkflowBundleCard({
  item,
  stageLabel,
  helperText,
  actions,
  onContextMenu,
  onInspectBundle,
  onQuickPeekDocument,
}: WorkflowBundleCardProps) {
  const previewDocuments = item.bundleDocuments.slice(0, 3);
  const remainingDocumentCount = item.bundleDocuments.length - previewDocuments.length;

  return (
    <div
      onContextMenu={onContextMenu ? (event) => onContextMenu(item, event) : undefined}
      className={`rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.03)] ${
        onContextMenu ? "cursor-context-menu" : ""
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--brand-charcoal)]/20 bg-[var(--brand-charcoal)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-white">
              BUNDLE
            </span>
            <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--brand-deep)]">
              {stageLabel}
            </span>
            <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
              {item.workspaceLabel}
            </span>
            <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
              {item.documentCount} file{item.documentCount === 1 ? "" : "s"}
            </span>
            {item.criterionHint ? (
              <span className="ml-auto rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
                {item.criterionHint}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">{item.bundleName}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Bundle review unit · {item.documentCount} file{item.documentCount === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-[12px] leading-6 text-[var(--foreground)]/88">{item.rationale}</p>
          <div className="mt-3 rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              What needs a call
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--foreground)]/82">{helperText}</p>
          </div>
          {previewDocuments.length ? (
            <div className="mt-3 rounded-[14px] border border-[var(--border-secondary)] bg-white px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Files in this bundle
                </p>
                {onInspectBundle ? (
                  <button
                    type="button"
                    onClick={() => onInspectBundle(item)}
                    className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-[var(--foreground)] transition hover:border-[var(--brand-charcoal)] hover:bg-[var(--paper-primary)]"
                  >
                    Inspect all
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-3">
                {previewDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-[var(--foreground)]">
                          {document.title}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--muted)]">{document.fileName}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.12em] text-[var(--muted)]">
                          {Math.round(document.confidence * 100)}%
                        </span>
                        {document.currentCriterionName ? (
                          <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.12em] text-[var(--muted)]">
                            {document.currentCriterionName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--foreground)]/82">
                      {document.shortSummary || "No AI summary is available yet for this file."}
                    </p>
                    {onQuickPeekDocument ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => onQuickPeekDocument(document)}
                          className="rounded-[8px] border border-[var(--border-primary)] bg-white px-3 py-1.5 text-[10px] font-semibold text-[var(--foreground)] transition hover:border-[var(--brand-charcoal)] hover:bg-[var(--paper-primary)]"
                        >
                          Quick peek
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {remainingDocumentCount > 0 ? (
                <p className="mt-3 text-[10px] text-[var(--muted)]">
                  +{remainingDocumentCount} more file{remainingDocumentCount === 1 ? "" : "s"} in this bundle.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--border-secondary)] pt-3">{actions}</div>
      </div>
    </div>
  );
}
