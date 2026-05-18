"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryBand } from "@/components/review/CategoryBand";
import { DecisionRow, type ReviewDecisionItem } from "@/components/review/DecisionRow";
import { RoutineRow } from "@/components/review/RoutineRow";

export interface ReviewRoutineBlock {
  count: number;
  samples: string[];
  denseReviewHref: string | null;
  label: string;
}

export interface ReviewCategoryBandData {
  key: string;
  legalCode: string;
  title: string;
  taggedCount: number;
  note?: string | null;
  decisions: ReviewDecisionItem[];
  routine: ReviewRoutineBlock | null;
}

export interface ReviewBundleDecisionItem {
  id: string;
  bundleName: string;
  workspaceLabel: string;
  rationale: string;
  denseReviewHref: string;
  criterionHint: string | null;
}

interface ActionItemsSummaryProps {
  clientId: string;
  clientName: string;
  totalTagged: number;
  initialRoutineCount: number;
  initialArchiveCount: number;
  bands: ReviewCategoryBandData[];
  humanReviewQueue: ReviewBundleDecisionItem[];
  archiveSamples: string[];
  archiveReviewHref: string | null;
  strategyHref: string;
  denseWorkbenchHref: string | null;
}

interface PreviewState {
  title: string;
  previewHref: string;
  sourceHref: string;
}

export function ActionItemsSummary({
  clientId,
  clientName,
  totalTagged,
  initialRoutineCount,
  initialArchiveCount,
  bands: initialBands,
  humanReviewQueue,
  archiveSamples,
  archiveReviewHref,
  strategyHref,
  denseWorkbenchHref,
}: ActionItemsSummaryProps) {
  const [bands, setBands] = useState(initialBands);
  const [routineCount, setRoutineCount] = useState(initialRoutineCount);
  const [archiveCount, setArchiveCount] = useState(initialArchiveCount);
  const [archiveSampleTitles, setArchiveSampleTitles] = useState(archiveSamples);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);

  const needsDecisionCount = useMemo(
    () => bands.reduce((sum, band) => sum + band.decisions.length, 0),
    [bands],
  );
  const bundleDecisionCount = humanReviewQueue.length;
  const unresolvedCount = needsDecisionCount + bundleDecisionCount;

  async function updateDecisionStatus(item: ReviewDecisionItem, status: "kept" | "archived") {
    if (busyDocumentId) {
      return;
    }

    setBusyDocumentId(item.id);

    try {
      const response = await fetch(`/api/evidence/${item.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Unable to save the review decision.");
      }

      setBands((current) =>
        current.map((band) => {
          const target = band.decisions.find((entry) => entry.id === item.id);

          if (!target) {
            return band;
          }

          const nextRoutineCount =
            status === "kept" ? (band.routine?.count ?? 0) + 1 : band.routine?.count ?? 0;
          const nextRoutineSamples =
            status === "kept"
              ? [target.title, ...(band.routine?.samples ?? [])].slice(0, 4)
              : band.routine?.samples ?? [];

          return {
            ...band,
            decisions: band.decisions.filter((entry) => entry.id !== item.id),
            routine:
              status === "kept"
                ? {
                    count: nextRoutineCount,
                    samples: nextRoutineSamples,
                    denseReviewHref: band.routine?.denseReviewHref ?? target.denseReviewHref,
                    label: band.routine?.label ?? "routine Keep",
                  }
                : band.routine,
          };
        }),
      );

      if (status === "kept") {
        setRoutineCount((current) => current + 1);
      } else {
        setArchiveCount((current) => current + 1);
        setArchiveSampleTitles((current) => [item.title, ...current].slice(0, 4));
      }

      if (preview?.previewHref === item.previewHref && status === "archived") {
        setPreview(null);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save the review decision.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Action items summary
        </p>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          {totalTagged} document(s) tagged for {clientName}
        </h2>
        <p className="mt-2 max-w-4xl text-[12px] leading-6 text-[var(--muted)]">
          Setu keeps the routine work collapsed so the remaining human decisions stay obvious across
          multiple review sessions.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--foreground)]">{totalTagged}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Tagged</p>
          </div>
          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--foreground)]">{routineCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Routine</p>
          </div>
          <div className="rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--brand-deep)]">{needsDecisionCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--brand-deep)]">
              Need decision
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--foreground)]">{bundleDecisionCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Bundle review
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {bands.map((band) => (
          <CategoryBand
            key={band.key}
            legalCode={band.legalCode}
            title={band.title}
            taggedCount={band.taggedCount}
            decisionCount={band.decisions.length}
            routineCount={band.routine?.count ?? 0}
            note={band.note}
            defaultOpen={band.decisions.length > 0}
          >
            {band.decisions.map((item) => (
              <DecisionRow
                key={item.id}
                item={item}
                onKeep={(nextItem) => void updateDecisionStatus(nextItem, "kept")}
                onArchive={(nextItem) => void updateDecisionStatus(nextItem, "archived")}
                onQuickPeek={(nextItem) =>
                  setPreview({
                    title: nextItem.title,
                    previewHref: nextItem.previewHref,
                    sourceHref: nextItem.sourceHref,
                  })
                }
              />
            ))}
            {band.routine ? (
              <RoutineRow
                label={band.routine.label}
                count={band.routine.count}
                samples={band.routine.samples}
                href={band.routine.denseReviewHref}
              />
            ) : null}
          </CategoryBand>
        ))}

        <CategoryBand
          legalCode="Archive"
          title="Routine cleanup"
          taggedCount={archiveCount}
          decisionCount={0}
          routineCount={archiveCount}
          note="Filename rules and manual archive actions stay separate from the active petition set."
        >
          <RoutineRow
            label="routine archive"
            count={archiveCount}
            samples={archiveSampleTitles}
            href={archiveReviewHref}
          />
        </CategoryBand>

        <CategoryBand
          legalCode="Review"
          title="Human review queue"
          taggedCount={bundleDecisionCount}
          decisionCount={bundleDecisionCount}
          routineCount={0}
          note="These bundles need a criterion assignment before strategy work can lean on them."
          defaultOpen={bundleDecisionCount > 0}
        >
          {humanReviewQueue.length ? (
            humanReviewQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-[16px] border border-[var(--brand)]/25 bg-[var(--paper-primary)] px-4 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                        Bundle decision
                      </span>
                      <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                        {item.workspaceLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">
                      {item.bundleName}
                    </p>
                    <p className="mt-2 text-[12px] leading-6 text-[var(--foreground)]/88">
                      {item.rationale}
                    </p>
                    {item.criterionHint ? (
                      <p className="mt-2 text-[11px] text-[var(--muted)]">
                        Suggested fit: {item.criterionHint}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={item.denseReviewHref}
                    className="inline-flex items-center rounded-full border border-[var(--border-primary)] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
                  >
                    Open in dense workbench
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[12px] leading-6 text-[var(--muted)]">
              No bundle-level decisions are waiting right now.
            </p>
          )}
        </CategoryBand>
      </div>

      <div className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-[12px] leading-6 text-[var(--muted)]">
          {unresolvedCount > 0
            ? "Strategy should wait until the remaining review decisions are resolved. You can still open the workspace if you need the dense tools."
            : "Review is complete. You can move forward into the next surface when the strategy phase is ready."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/clients/${clientId}`}
            className="setu-ghost-button inline-flex items-center rounded-[8px] px-3 py-2 text-[11px] font-semibold"
          >
            Back to client
          </Link>
          {denseWorkbenchHref ? (
            <Link
              href={denseWorkbenchHref}
              className="setu-ghost-button inline-flex items-center rounded-[8px] px-3 py-2 text-[11px] font-semibold"
            >
              Dense workbench
            </Link>
          ) : null}
          {unresolvedCount > 0 ? (
            <>
              <button
                type="button"
                disabled
                title="Resolve the remaining review decisions first."
                className="rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-tertiary)] px-3 py-2 text-[11px] font-semibold text-[var(--muted)]"
              >
                Continue to Strategy
              </button>
              <Link
                href={strategyHref}
                className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-2 text-[11px] font-semibold text-white"
              >
                Preview strategy with pending items
              </Link>
            </>
          ) : (
            <Link
              href={strategyHref}
              className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-2 text-[11px] font-semibold text-white"
            >
              Continue to Strategy
            </Link>
          )}
        </div>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--brand-charcoal)]/45 px-4 py-6">
          <div className="setu-panel flex h-[88vh] w-full max-w-[1200px] flex-col rounded-[22px]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-secondary)] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Quick peek
                </p>
                <p className="mt-1 text-[14px] font-semibold text-[var(--foreground)]">
                  {preview.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={preview.sourceHref}
                  target="_blank"
                  rel="noreferrer"
                  className="setu-ghost-button inline-flex items-center rounded-[8px] px-3 py-2 text-[11px] font-semibold"
                >
                  Open original
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="setu-ghost-button inline-flex items-center rounded-[8px] px-3 py-2 text-[11px] font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              title={preview.title}
              src={preview.previewHref}
              className="min-h-0 flex-1 rounded-b-[22px] bg-[var(--paper-secondary)]"
            />
          </div>
        </div>
      ) : null}

      {busyDocumentId ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-full border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-2 text-[11px] font-semibold text-[var(--foreground)] shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
          Saving review decision
        </div>
      ) : null}
    </div>
  );
}
