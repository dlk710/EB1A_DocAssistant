"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CategoryBand } from "@/components/review/CategoryBand";
import { DecisionRow, type ReviewDecisionItem } from "@/components/review/DecisionRow";
import { ReferenceCategoryBand } from "@/components/review/ReferenceCategoryBand";
import {
  RowContextMenu,
  type ReviewWorkspaceBundleOption,
  type ReviewWorkspaceContext,
} from "@/components/review/RowContextMenu";
import { RoutineRow } from "@/components/review/RoutineRow";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import type { CriterionTagRole, EvidenceReviewStatus } from "@/lib/types";

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
  initialReferenceItems: ReviewDecisionItem[];
  initialCriterionCounts: Record<string, number>;
  workspaceContexts: ReviewWorkspaceContext[];
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

interface ReasoningState {
  title: string;
  reasoning: string;
}

interface MenuState {
  item: ReviewDecisionItem;
  x: number;
  y: number;
}

interface ToastState {
  tone: "error" | "info";
  message: string;
}

interface ReviewViewState {
  bands: ReviewCategoryBandData[];
  routineCount: number;
  archiveCount: number;
  archiveSampleTitles: string[];
  referenceItems: ReviewDecisionItem[];
  criterionCounts: Record<string, number>;
}

const CRITERION_LOOKUP = Object.fromEntries(
  EB1A_CRITERIA_DEFINITIONS.map((criterion) => [criterion.code, criterion]),
) as Record<string, (typeof EB1A_CRITERIA_DEFINITIONS)[number]>;

function sortBands(bands: ReviewCategoryBandData[]) {
  return [...bands].sort((left, right) => left.legalCode.localeCompare(right.legalCode));
}

function createEmptyBand(
  criterionCode: string,
  denseReviewHref: string,
): ReviewCategoryBandData {
  const criterion = CRITERION_LOOKUP[criterionCode];

  return {
    key: criterionCode,
    legalCode: criterion?.legalCode ?? criterionCode,
    title: criterion?.name ?? "Criterion",
    taggedCount: 0,
    note: null,
    decisions: [],
    routine: {
      count: 0,
      samples: [],
      denseReviewHref,
      label: "routine Keep",
    },
  };
}

function cloneViewState(state: ReviewViewState): ReviewViewState {
  return structuredClone(state);
}

function buildNextState(
  input: Omit<ActionItemsSummaryProps, "clientId" | "clientName" | "humanReviewQueue" | "strategyHref" | "denseWorkbenchHref" | "archiveReviewHref"> & {
    archiveSamples: string[];
  },
): ReviewViewState {
  return {
    bands: input.bands,
    routineCount: input.initialRoutineCount,
    archiveCount: input.initialArchiveCount,
    archiveSampleTitles: input.archiveSamples,
    referenceItems: input.initialReferenceItems,
    criterionCounts: input.initialCriterionCounts,
  };
}

function removeDecisionItemFromBands(
  bands: ReviewCategoryBandData[],
  itemId: string,
): { bands: ReviewCategoryBandData[]; sourceBand: ReviewCategoryBandData | null } {
  let sourceBand: ReviewCategoryBandData | null = null;

  const nextBands = bands.map((band) => {
    const target = band.decisions.find((entry) => entry.id === itemId);

    if (!target) {
      return band;
    }

    sourceBand = band;

    return {
      ...band,
      decisions: band.decisions.filter((entry) => entry.id !== itemId),
    };
  });

  return {
    bands: nextBands,
    sourceBand,
  };
}

function upsertRoutineEntry(
  bands: ReviewCategoryBandData[],
  item: ReviewDecisionItem,
  criterionCode: string,
  incrementTaggedCount: boolean,
): ReviewCategoryBandData[] {
  const denseReviewHref = item.denseReviewHref;
  const nextBands = [...bands];
  const bandIndex = nextBands.findIndex((band) => band.key === criterionCode);
  const existingBand =
    bandIndex >= 0 ? nextBands[bandIndex] : createEmptyBand(criterionCode, denseReviewHref);

  const nextBand = {
    ...existingBand,
    taggedCount: existingBand.taggedCount + (incrementTaggedCount ? 1 : 0),
    routine: {
      count: (existingBand.routine?.count ?? 0) + 1,
      samples: [item.title, ...(existingBand.routine?.samples ?? [])].slice(0, 4),
      denseReviewHref:
        existingBand.routine?.denseReviewHref ?? denseReviewHref,
      label: existingBand.routine?.label ?? "routine Keep",
    },
  };

  if (bandIndex >= 0) {
    nextBands[bandIndex] = nextBand;
  } else {
    nextBands.push(nextBand);
  }

  return sortBands(nextBands);
}

function decrementBandCount(
  bands: ReviewCategoryBandData[],
  criterionCode: string | null,
): ReviewCategoryBandData[] {
  if (!criterionCode) {
    return bands;
  }

  return bands
    .map((band) =>
      band.key === criterionCode
        ? {
            ...band,
            taggedCount: Math.max(0, band.taggedCount - 1),
          }
        : band,
    )
    .filter((band) => band.taggedCount > 0 || band.decisions.length > 0 || (band.routine?.count ?? 0) > 0);
}

function moveDecisionToReference(state: ReviewViewState, item: ReviewDecisionItem) {
  const { bands } = removeDecisionItemFromBands(state.bands, item.id);

  return {
    ...state,
    bands: decrementBandCount(bands, item.currentCriterionCode),
    referenceItems: [{ ...item, reviewStatus: "reference" as const }, ...state.referenceItems],
    criterionCounts: item.currentCriterionCode
      ? {
          ...state.criterionCounts,
          [item.currentCriterionCode]: Math.max(
            0,
            (state.criterionCounts[item.currentCriterionCode] ?? 0) - 1,
          ),
        }
      : state.criterionCounts,
  };
}

function moveReferenceToArchive(state: ReviewViewState, item: ReviewDecisionItem) {
  return {
    ...state,
    referenceItems: state.referenceItems.filter((entry) => entry.id !== item.id),
    archiveCount: state.archiveCount + 1,
    archiveSampleTitles: [item.title, ...state.archiveSampleTitles].slice(0, 4),
  };
}

function moveDecisionToArchive(state: ReviewViewState, item: ReviewDecisionItem) {
  const { bands } = removeDecisionItemFromBands(state.bands, item.id);

  return {
    ...state,
    bands: decrementBandCount(bands, item.currentCriterionCode),
    archiveCount: state.archiveCount + 1,
    archiveSampleTitles: [item.title, ...state.archiveSampleTitles].slice(0, 4),
    criterionCounts: item.currentCriterionCode
      ? {
          ...state.criterionCounts,
          [item.currentCriterionCode]: Math.max(
            0,
            (state.criterionCounts[item.currentCriterionCode] ?? 0) - 1,
          ),
        }
      : state.criterionCounts,
  };
}

function keepDecisionInBand(
  state: ReviewViewState,
  item: ReviewDecisionItem,
  targetCriterionCode: string,
): ReviewViewState {
  const { bands } = removeDecisionItemFromBands(state.bands, item.id);
  const sourceCriterionCode = item.currentCriterionCode;
  const nextBands =
    sourceCriterionCode && sourceCriterionCode !== targetCriterionCode
      ? decrementBandCount(bands, sourceCriterionCode)
      : bands;
  const nextState = {
    ...state,
    bands: upsertRoutineEntry(
      nextBands,
      item,
      targetCriterionCode,
      sourceCriterionCode !== targetCriterionCode,
    ),
    routineCount: state.routineCount + 1,
    criterionCounts: { ...state.criterionCounts },
  };

  if (sourceCriterionCode && sourceCriterionCode !== targetCriterionCode) {
    nextState.criterionCounts[sourceCriterionCode] = Math.max(
      0,
      (nextState.criterionCounts[sourceCriterionCode] ?? 0) - 1,
    );
    nextState.criterionCounts[targetCriterionCode] =
      (nextState.criterionCounts[targetCriterionCode] ?? 0) + 1;
  }

  return nextState;
}

function keepReferenceInBand(
  state: ReviewViewState,
  item: ReviewDecisionItem,
  targetCriterionCode: string,
): ReviewViewState {
  return {
    ...state,
    referenceItems: state.referenceItems.filter((entry) => entry.id !== item.id),
    bands: upsertRoutineEntry(state.bands, item, targetCriterionCode, true),
    routineCount: state.routineCount + 1,
    criterionCounts: {
      ...state.criterionCounts,
      [targetCriterionCode]: (state.criterionCounts[targetCriterionCode] ?? 0) + 1,
    },
  };
}

function moveReferenceToReferenceBundle(
  state: ReviewViewState,
  itemId: string,
  bundleName: string,
  bundleId: string,
  parentBundleId: string | null,
) {
  return {
    ...state,
    referenceItems: state.referenceItems.map((entry) =>
      entry.id === itemId
        ? {
            ...entry,
            currentBundleName: bundleName,
            currentBundleId: bundleId,
            currentParentBundleId: parentBundleId,
          }
        : entry,
    ),
  };
}

function resolveCriterionBandCode(
  item: ReviewDecisionItem,
  criterionCode: string,
  role: CriterionTagRole,
) {
  if (role === "primary") {
    return criterionCode;
  }

  return item.currentCriterionCode ?? criterionCode;
}

export function ActionItemsSummary({
  clientId,
  clientName,
  totalTagged,
  initialRoutineCount,
  initialArchiveCount,
  initialReferenceItems,
  initialCriterionCounts,
  workspaceContexts,
  bands: initialBands,
  humanReviewQueue,
  archiveSamples,
  archiveReviewHref,
  strategyHref,
  denseWorkbenchHref,
}: ActionItemsSummaryProps) {
  const router = useRouter();
  const [viewState, setViewState] = useState<ReviewViewState>(() =>
    buildNextState({
      totalTagged,
      initialRoutineCount,
      initialArchiveCount,
      initialReferenceItems,
      initialCriterionCounts,
      workspaceContexts,
      bands: initialBands,
      archiveSamples,
    }),
  );
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [reasoning, setReasoning] = useState<ReasoningState | null>(null);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState("Saving review action");
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const needsDecisionCount = useMemo(
    () => viewState.bands.reduce((sum, band) => sum + band.decisions.length, 0),
    [viewState.bands],
  );
  const bundleDecisionCount = humanReviewQueue.length;
  const unresolvedCount = needsDecisionCount + bundleDecisionCount;
  const referenceCount = viewState.referenceItems.length;

  async function patchReviewStatus(id: string, status: EvidenceReviewStatus) {
    const response = await fetch(`/api/evidence/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error("Unable to save the review status.");
    }
  }

  async function upsertCriterion(
    id: string,
    code: string,
    role: CriterionTagRole,
  ) {
    const response = await fetch(`/api/evidence/${id}/criteria`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, role }),
    });

    if (!response.ok) {
      throw new Error("Unable to save the criterion assignment.");
    }
  }

  async function patchCriterionRole(
    id: string,
    code: string,
    role: CriterionTagRole,
  ) {
    const response = await fetch(`/api/evidence/${id}/criteria/${code}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      throw new Error("Unable to update the criterion role.");
    }
  }

  async function deleteCriterion(id: string, code: string) {
    const response = await fetch(`/api/evidence/${id}/criteria/${code}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Unable to remove the existing criterion.");
    }
  }

  async function moveToBundle(
    item: ReviewDecisionItem,
    option: ReviewWorkspaceBundleOption,
  ) {
    const response = await fetch(`/api/evidence/${item.id}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: item.jobId,
        targetBundleId:
          option.kind === "bundle" ? option.id : option.parentBundleId,
        targetSubBundleId: option.kind === "sub_bundle" ? option.id : null,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to move the document to the selected bundle.");
    }
  }

  async function createBundleForItem(item: ReviewDecisionItem) {
    const parentBundleId = item.currentParentBundleId ?? item.currentBundleId;

    if (!parentBundleId) {
      throw new Error("This document does not have a parent bundle yet.");
    }

    const name = `Custom bundle — ${item.title.slice(0, 38)}`;
    const response = await fetch(`/api/bundles/${parentBundleId}/sub-bundles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: item.jobId,
        name,
        evidenceIds: [],
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to create a new bundle.");
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      data?: {
        id: string;
        parentBundleId: string;
        name: string;
      };
    };

    if (!payload.ok || !payload.data) {
      throw new Error("Unable to create a new bundle.");
    }

    return {
      id: payload.data.id,
      parentBundleId: payload.data.parentBundleId,
      name: payload.data.name,
    };
  }

  async function runOptimisticAction(
    item: ReviewDecisionItem,
    label: string,
    mutator: (state: ReviewViewState) => ReviewViewState,
    runner: () => Promise<void>,
  ) {
    if (busyDocumentId) {
      return;
    }

    const snapshot = cloneViewState(viewState);
    setBusyDocumentId(item.id);
    setBusyLabel(label);
    setMenuState(null);
    setViewState((current) => mutator(cloneViewState(current)));

    try {
      await runner();
      router.refresh();
    } catch (error) {
      setViewState(snapshot);
      setToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Setu could not save that review action.",
      });
    } finally {
      setBusyDocumentId(null);
      setBusyLabel("Saving review action");
    }
  }

  function handleQuickPeek(item: ReviewDecisionItem) {
    setPreview({
      title: item.title,
      previewHref: item.previewHref,
      sourceHref: item.sourceHref,
    });
  }

  function handleMoveToStatus(item: ReviewDecisionItem, status: EvidenceReviewStatus) {
    if (status === "reference") {
      const mutator = (state: ReviewViewState) =>
        item.reviewStatus === "reference" ? state : moveDecisionToReference(state, item);

      void runOptimisticAction(item, "Moving document to Reference", mutator, async () => {
        await patchReviewStatus(item.id, "reference");
      });
      return;
    }

    const mutator = (state: ReviewViewState) => {
      if (item.reviewStatus === "reference") {
        return moveReferenceToArchive(state, item);
      }

      return moveDecisionToArchive(state, item);
    };

    void runOptimisticAction(item, "Moving document to Archive", mutator, async () => {
      await patchReviewStatus(item.id, "archived");
    });
  }

  function handleKeepForCriterion(
    item: ReviewDecisionItem,
    criterionCode: string,
    role: CriterionTagRole,
  ) {
    const targetBandCode = resolveCriterionBandCode(item, criterionCode, role);
    const previousStatus = item.reviewStatus;
    const previousCriterionCode = item.currentCriterionCode;
    const previousRole = item.currentCriterionRole ?? "primary";
    const updatesCurrentCriterion = previousCriterionCode === criterionCode;

    const mutator = (state: ReviewViewState) => {
      if (item.reviewStatus === "reference") {
        return keepReferenceInBand(state, item, targetBandCode);
      }

      return keepDecisionInBand(state, item, targetBandCode);
    };

    void runOptimisticAction(item, "Keeping document for the selected criterion", mutator, async () => {
      let criterionSaved = false;

      try {
        if (updatesCurrentCriterion) {
          await patchCriterionRole(item.id, criterionCode, role);
        } else {
          await upsertCriterion(item.id, criterionCode, role);
        }
        criterionSaved = true;
        await patchReviewStatus(item.id, "kept");
      } catch (error) {
        if (criterionSaved) {
          if (updatesCurrentCriterion) {
            await patchCriterionRole(item.id, criterionCode, previousRole);
          } else {
            await deleteCriterion(item.id, criterionCode).catch(() => null);
          }
        }

        if (previousStatus !== "kept") {
          await patchReviewStatus(item.id, previousStatus).catch(() => null);
        }

        throw error;
      }
    });
  }

  function handleReassignCriterion(item: ReviewDecisionItem, criterionCode: string) {
    const previousStatus = item.reviewStatus;
    const previousCriterionCode = item.currentCriterionCode;
    const previousRole = item.currentCriterionRole ?? "primary";

    if (!previousCriterionCode || previousCriterionCode === criterionCode) {
      return;
    }

    const mutator = (state: ReviewViewState) => {
      if (item.reviewStatus === "reference") {
        return keepReferenceInBand(state, item, criterionCode);
      }

      return keepDecisionInBand(state, item, criterionCode);
    };

    void runOptimisticAction(item, "Reassigning criterion", mutator, async () => {
      let deletedOld = false;
      let addedNew = false;

      try {
        await deleteCriterion(item.id, previousCriterionCode);
        deletedOld = true;
        await upsertCriterion(item.id, criterionCode, previousRole);
        addedNew = true;
        await patchReviewStatus(item.id, "kept");
      } catch (error) {
        if (addedNew) {
          await deleteCriterion(item.id, criterionCode).catch(() => null);
        }

        if (deletedOld) {
          await upsertCriterion(item.id, previousCriterionCode, previousRole).catch(() => null);
        }

        if (previousStatus !== "kept") {
          await patchReviewStatus(item.id, previousStatus).catch(() => null);
        }

        throw error;
      }
    });
  }

  function handleMoveToBundle(
    item: ReviewDecisionItem,
    option: ReviewWorkspaceBundleOption | { kind: "create" },
  ) {
    const mutator = (state: ReviewViewState) => {
      if (item.reviewStatus === "reference") {
        if (option.kind === "create") {
          return state;
        }

        return moveReferenceToReferenceBundle(
          state,
          item.id,
          option.name,
          option.id,
          option.parentBundleId,
        );
      }

      return keepDecisionInBand(
        state,
        item,
        item.currentCriterionCode ?? EB1A_CRITERIA_DEFINITIONS[0].code,
      );
    };

    void runOptimisticAction(item, "Moving document to the selected bundle", mutator, async () => {
      if (option.kind === "create") {
        const created = await createBundleForItem(item);
        await moveToBundle(item, {
          id: created.id,
          jobId: item.jobId,
          parentBundleId: created.parentBundleId,
          name: created.name,
          documentCount: 1,
          kind: "sub_bundle",
        });
      } else {
        await moveToBundle(item, option);
      }

      if (item.reviewStatus === "pending") {
        await patchReviewStatus(item.id, "kept");
      }
    });
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
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--foreground)]">{totalTagged}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Tagged</p>
          </div>
          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--foreground)]">{viewState.routineCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Routine</p>
          </div>
          <div className="rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--brand-deep)]">{needsDecisionCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--brand-deep)]">
              Need decision
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--state-warning)]">{referenceCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--state-warning)]">
              Reference
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

      {toast ? (
        <div
          className={`rounded-[14px] border px-3 py-3 text-[12px] leading-6 ${
            toast.tone === "error"
              ? "border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] text-[var(--state-danger)]"
              : "border-[var(--state-info)]/20 bg-[var(--state-info-soft)] text-[var(--state-info)]"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="space-y-4">
        {viewState.bands.map((band) => (
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
                onContextMenu={(nextItem, event) => {
                  event.preventDefault();
                  setMenuState({
                    item: nextItem,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
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
          taggedCount={viewState.archiveCount}
          decisionCount={0}
          routineCount={viewState.archiveCount}
          note="Filename rules and manual archive actions stay separate from the active petition set."
        >
          <RoutineRow
            label="routine archive"
            count={viewState.archiveCount}
            samples={viewState.archiveSampleTitles}
            href={archiveReviewHref}
          />
        </CategoryBand>

        <ReferenceCategoryBand
          items={viewState.referenceItems}
          onContextMenu={(item, event) => {
            event.preventDefault();
            setMenuState({
              item,
              x: event.clientX,
              y: event.clientY,
            });
          }}
        />

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

      <RowContextMenu
        open={Boolean(menuState)}
        x={menuState?.x ?? 0}
        y={menuState?.y ?? 0}
        item={menuState?.item ?? null}
        criterionCounts={viewState.criterionCounts}
        workspaceContexts={workspaceContexts}
        onClose={() => setMenuState(null)}
        onKeepForCriterion={handleKeepForCriterion}
        onMoveToStatus={handleMoveToStatus}
        onReassignCriterion={handleReassignCriterion}
        onMoveToBundle={handleMoveToBundle}
        onOpenQuickPeek={handleQuickPeek}
        onShowReasoning={(item) =>
          setReasoning({
            title: item.title,
            reasoning: item.reasoning,
          })
        }
      />

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

      {reasoning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--brand-charcoal)]/45 px-4 py-6">
          <div className="setu-panel w-full max-w-[760px] rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-secondary)] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  AI reasoning
                </p>
                <p className="mt-1 text-[14px] font-semibold text-[var(--foreground)]">
                  {reasoning.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReasoning(null)}
                className="setu-ghost-button inline-flex items-center rounded-[8px] px-3 py-2 text-[11px] font-semibold"
              >
                Close
              </button>
            </div>
            <div className="px-4 py-4">
              <p className="text-[12px] leading-7 text-[var(--foreground)]/88">
                {reasoning.reasoning}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {busyDocumentId ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-full border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-2 text-[11px] font-semibold text-[var(--foreground)] shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
          {busyLabel}
        </div>
      ) : null}
    </div>
  );
}
