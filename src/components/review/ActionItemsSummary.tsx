"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ContextMenu, type ContextMenuEntry } from "@/components/common/ContextMenu";
import type { ReviewDecisionItem } from "@/components/review/DecisionRow";
import { CategoryBand } from "@/components/review/CategoryBand";
import { RoutineRow } from "@/components/review/RoutineRow";
import { WorkflowBundleCard } from "@/components/review/WorkflowBundleCard";
import { WorkflowDocumentCard } from "@/components/review/WorkflowDocumentCard";
import type { ReviewWorkspaceBundleOption, ReviewWorkspaceContext } from "@/components/review/RowContextMenu";
import type {
  ReviewBundleDecisionItem,
  ReviewBundleFitGroup,
  ReviewCategoryBandData,
} from "@/components/review/workflow-types";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import type { EvidenceReviewStatus } from "@/lib/types";

const OTHER_REVIEW_BUCKET_CODE = "OTHER";

interface ActionItemsSummaryProps {
  clientId: string;
  clientName: string;
  totalTagged: number;
  initialRoutineCount: number;
  initialArchiveCount: number;
  initialReferenceItems: ReviewDecisionItem[];
  workspaceContexts: ReviewWorkspaceContext[];
  readyBands: ReviewCategoryBandData[];
  fileDecisionItems: ReviewDecisionItem[];
  bundleReviewGroups: ReviewBundleFitGroup[];
  otherBundleGroups: ReviewBundleFitGroup[];
  criterionReviewQueue: ReviewBundleDecisionItem[];
  otherCriterionQueue: ReviewBundleDecisionItem[];
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

interface ToastState {
  tone: "error" | "info";
  message: string;
}

interface ViewState {
  readyBands: ReviewCategoryBandData[];
  fileDecisionItems: ReviewDecisionItem[];
  bundleReviewGroups: ReviewBundleFitGroup[];
  otherBundleGroups: ReviewBundleFitGroup[];
  criterionReviewQueue: ReviewBundleDecisionItem[];
  otherCriterionQueue: ReviewBundleDecisionItem[];
  referenceItems: ReviewDecisionItem[];
  archiveCount: number;
  archiveSampleTitles: string[];
}

interface DocumentActionMenuState {
  item: ReviewDecisionItem;
  kind: "file" | "bundle" | "reference" | "other-bundle";
  x: number;
  y: number;
}

interface BundlePickerState {
  item: ReviewDecisionItem;
  source: "bundle" | "other-bundle";
  x: number;
  y: number;
}

interface CriterionPickerState {
  item: ReviewBundleDecisionItem;
  source: "criterion" | "other-criterion";
  x: number;
  y: number;
}

interface BundleActionMenuState {
  item: ReviewBundleDecisionItem;
  kind: "criterion" | "other-criterion";
  x: number;
  y: number;
}

type ReviewMode = "inbox" | "table" | "workbench" | "by-category";
type ReviewStageFilter = "all" | "file" | "bundle" | "criterion";
type WorkbenchGroupBy = "stage" | "bundle" | "workspace";

type ReviewFocusEntry =
  | {
      key: string;
      kind: "file";
      item: ReviewDecisionItem;
    }
  | {
      key: string;
      kind: "bundle";
      item: ReviewDecisionItem;
      groupName: string;
    }
  | {
      key: string;
      kind: "criterion";
      item: ReviewBundleDecisionItem;
    };

function cloneViewState(state: ViewState): ViewState {
  return structuredClone(state);
}

function buildInitialViewState(props: ActionItemsSummaryProps): ViewState {
  return {
    readyBands: props.readyBands,
    fileDecisionItems: props.fileDecisionItems,
    bundleReviewGroups: props.bundleReviewGroups,
    otherBundleGroups: props.otherBundleGroups,
    criterionReviewQueue: props.criterionReviewQueue,
    otherCriterionQueue: props.otherCriterionQueue,
    referenceItems: props.initialReferenceItems,
    archiveCount: props.initialArchiveCount,
    archiveSampleTitles: props.archiveSamples,
  };
}

function readyCountFromBands(bands: ReviewCategoryBandData[]) {
  return bands.reduce((sum, band) => sum + (band.routine?.count ?? 0), 0);
}

function getDisplayBundleName(item: ReviewDecisionItem) {
  return item.currentBundleName ?? "Bundle review needed";
}

function getDisplayBundleId(item: ReviewDecisionItem) {
  return item.currentBundleId ?? `unassigned:${item.id}`;
}

function upsertBundleGroup(
  groups: ReviewBundleFitGroup[],
  input: Omit<ReviewBundleFitGroup, "itemCount" | "items">,
  item: ReviewDecisionItem,
) {
  const nextGroups = groups.map((group) => ({ ...group, items: [...group.items] }));
  const existingIndex = nextGroups.findIndex((group) => group.key === input.key);

  if (existingIndex >= 0) {
    const current = nextGroups[existingIndex];
    current.items = [item, ...current.items];
    current.itemCount = current.items.length;
    return nextGroups;
  }

  return [
    {
      ...input,
      itemCount: 1,
      items: [item],
    },
    ...nextGroups,
  ];
}

function removeItemFromGroups(groups: ReviewBundleFitGroup[], itemId: string) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.id !== itemId),
    }))
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      itemCount: group.items.length,
    }));
}

function addToBundleReviewGroups(state: ViewState, item: ReviewDecisionItem) {
  return {
    ...state,
    bundleReviewGroups: upsertBundleGroup(
      state.bundleReviewGroups,
      {
        key: `${item.jobId}:${getDisplayBundleId(item)}`,
        jobId: item.jobId,
        workspaceLabel: item.workspaceLabel,
        bundleId: item.currentBundleId,
        bundleName: getDisplayBundleName(item),
      },
      { ...item, reviewStatus: "kept" as const },
    ),
  };
}

function addToOtherBundleGroups(state: ViewState, item: ReviewDecisionItem) {
  return {
    ...state,
    otherBundleGroups: upsertBundleGroup(
      state.otherBundleGroups,
      {
        key: `${item.jobId}:other-bundle`,
        jobId: item.jobId,
        workspaceLabel: item.workspaceLabel,
        bundleId: null,
        bundleName: "OTHER",
      },
      { ...item, reviewStatus: "kept" as const },
    ),
  };
}

function moveItemToReference(state: ViewState, item: ReviewDecisionItem) {
  return {
    ...state,
    fileDecisionItems: state.fileDecisionItems.filter((entry) => entry.id !== item.id),
    bundleReviewGroups: removeItemFromGroups(state.bundleReviewGroups, item.id),
    otherBundleGroups: removeItemFromGroups(state.otherBundleGroups, item.id),
    referenceItems: [{ ...item, reviewStatus: "reference" as const }, ...state.referenceItems],
  };
}

function moveItemToArchive(state: ViewState, item: ReviewDecisionItem) {
  return {
    ...state,
    fileDecisionItems: state.fileDecisionItems.filter((entry) => entry.id !== item.id),
    bundleReviewGroups: removeItemFromGroups(state.bundleReviewGroups, item.id),
    otherBundleGroups: removeItemFromGroups(state.otherBundleGroups, item.id),
    referenceItems: state.referenceItems.filter((entry) => entry.id !== item.id),
    archiveCount: state.archiveCount + 1,
    archiveSampleTitles: [item.title, ...state.archiveSampleTitles].slice(0, 4),
  };
}

function moveBundleItemToArchive(
  state: ViewState,
  item: ReviewBundleDecisionItem,
  source: "criterion" | "other-criterion",
) {
  return {
    ...removeBundleItem(state, item.id, source),
    archiveCount: state.archiveCount + item.documentCount,
    archiveSampleTitles: [...item.documentTitles, ...state.archiveSampleTitles].slice(0, 4),
  };
}

function removeBundleItem(state: ViewState, bundleId: string, source: "criterion" | "other-criterion") {
  if (source === "criterion") {
    return {
      ...state,
      criterionReviewQueue: state.criterionReviewQueue.filter((item) => item.id !== bundleId),
    };
  }

  return {
    ...state,
    otherCriterionQueue: state.otherCriterionQueue.filter((item) => item.id !== bundleId),
  };
}

function addBundleToOtherCriterion(state: ViewState, item: ReviewBundleDecisionItem) {
  return {
    ...state,
    criterionReviewQueue: state.criterionReviewQueue.filter((entry) => entry.id !== item.id),
    otherCriterionQueue: [item, ...state.otherCriterionQueue.filter((entry) => entry.id !== item.id)],
  };
}

function addBundleToCriterionQueue(state: ViewState, item: ReviewBundleDecisionItem) {
  return {
    ...state,
    otherCriterionQueue: state.otherCriterionQueue.filter((entry) => entry.id !== item.id),
    criterionReviewQueue: [item, ...state.criterionReviewQueue.filter((entry) => entry.id !== item.id)],
  };
}

function buildCriterionPickerItems(
  item: ReviewBundleDecisionItem,
  onSelect: (criterionCode: string) => void,
) {
  return [
    ...EB1A_CRITERIA_DEFINITIONS.map<ContextMenuEntry>((criterion) => ({
      id: `criterion-${criterion.code}`,
      label: criterion.name,
      disabled: item.bucketCode === criterion.code,
      onSelect: () => onSelect(criterion.code),
    })),
    {
      id: `criterion-${OTHER_REVIEW_BUCKET_CODE}`,
      label: "OTHER",
      disabled: item.bucketCode === OTHER_REVIEW_BUCKET_CODE,
      onSelect: () => onSelect(OTHER_REVIEW_BUCKET_CODE),
    } satisfies ContextMenuEntry,
  ];
}

function resolveExistingCriterionCode(item: ReviewBundleDecisionItem) {
  if (EB1A_CRITERIA_DEFINITIONS.some((criterion) => criterion.code === item.bucketCode)) {
    return item.bucketCode;
  }

  return item.criterionCode;
}

function documentActionButtonClass() {
  return "setu-ghost-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold";
}

function reviewTypeBadgeClass(type: "file" | "bundle") {
  if (type === "bundle") {
    return "rounded-full border border-[var(--brand-charcoal)]/20 bg-[var(--brand-charcoal)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-white";
  }

  return "rounded-full border border-[var(--brand)]/25 bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--brand-deep)]";
}

function reviewModeButtonClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-[8px] px-3 py-2 text-[11px] font-semibold transition ${
    active
      ? "bg-[var(--brand-charcoal)] text-white shadow-[0_10px_18px_rgba(15,23,42,0.14)]"
      : "text-[var(--muted)] hover:bg-[var(--paper-primary)] hover:text-[var(--foreground)]"
  }`;
}

function getFocusStageKey(entry: ReviewFocusEntry): ReviewStageFilter {
  if (entry.kind === "file") {
    return "file";
  }

  if (entry.kind === "bundle") {
    return "bundle";
  }

  return "criterion";
}

function getFocusStageLabel(entry: ReviewFocusEntry) {
  if (entry.kind === "file") {
    return "File decision";
  }

  if (entry.kind === "bundle") {
    return "Bundle review";
  }

  return "Criterion review";
}

function getFocusType(entry: ReviewFocusEntry) {
  return entry.kind === "criterion" ? "bundle" : "file";
}

function getFocusTypeBadgeLabel(entry: ReviewFocusEntry) {
  return getFocusType(entry) === "bundle" ? "BUNDLE" : "FILE";
}

function getFocusTypeDisplayLabel(entry: ReviewFocusEntry) {
  return getFocusType(entry) === "bundle" ? "Bundle" : "Evidence file";
}

function getFocusTitle(entry: ReviewFocusEntry) {
  if (entry.kind === "criterion") {
    return entry.item.bundleName;
  }

  return entry.item.title;
}

function getFocusSummary(entry: ReviewFocusEntry) {
  if (entry.kind === "criterion") {
    return entry.item.rationale;
  }

  return entry.item.shortSummary;
}

function getFocusReasoning(entry: ReviewFocusEntry) {
  if (entry.kind === "criterion") {
    return entry.item.criterionHint ?? entry.item.rationale;
  }

  return entry.item.reasoning;
}

function getFocusWorkspaceLabel(entry: ReviewFocusEntry) {
  return entry.item.workspaceLabel;
}

function getFocusBundleLabel(entry: ReviewFocusEntry) {
  if (entry.kind === "criterion") {
    return entry.item.bundleName;
  }

  return entry.kind === "bundle" ? entry.groupName : entry.item.currentBundleName;
}

function getFocusMetaLabel(entry: ReviewFocusEntry) {
  if (entry.kind === "criterion") {
    return `${entry.item.documentCount} file${entry.item.documentCount === 1 ? "" : "s"}`;
  }

  return entry.item.fileName;
}

function getFocusConfidence(entry: ReviewFocusEntry) {
  if (entry.kind === "criterion") {
    return null;
  }

  return Math.round(entry.item.confidence * 100);
}

function getFocusCriterionLabel(entry: ReviewFocusEntry) {
  if (entry.kind === "criterion") {
    return entry.item.criterionHint ?? null;
  }

  if (entry.item.currentCriterionName) {
    return entry.item.currentCriterionRole
      ? `${entry.item.currentCriterionName} · ${entry.item.currentCriterionRole}`
      : entry.item.currentCriterionName;
  }

  if (entry.item.roleHint) {
    return entry.item.roleHint;
  }

  return null;
}

function getFocusPreviewHref(entry: ReviewFocusEntry) {
  return entry.kind === "criterion" ? null : entry.item.previewHref;
}

function getFocusSourceHref(entry: ReviewFocusEntry) {
  return entry.kind === "criterion" ? null : entry.item.sourceHref;
}

export function ActionItemsSummary({
  clientId,
  clientName,
  totalTagged,
  initialRoutineCount,
  initialArchiveCount,
  initialReferenceItems,
  workspaceContexts,
  readyBands,
  fileDecisionItems,
  bundleReviewGroups,
  otherBundleGroups,
  criterionReviewQueue,
  otherCriterionQueue,
  archiveSamples,
  archiveReviewHref,
  strategyHref,
  denseWorkbenchHref,
}: ActionItemsSummaryProps) {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>(() =>
    buildInitialViewState({
      clientId,
      clientName,
      totalTagged,
      initialRoutineCount,
      initialArchiveCount,
      initialReferenceItems,
      workspaceContexts,
      readyBands,
      fileDecisionItems,
      bundleReviewGroups,
      otherBundleGroups,
      criterionReviewQueue,
      otherCriterionQueue,
      archiveSamples,
      archiveReviewHref,
      strategyHref,
      denseWorkbenchHref,
    }),
  );
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [reasoning, setReasoning] = useState<ReasoningState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState("Saving review action");
  const [documentMenuState, setDocumentMenuState] = useState<DocumentActionMenuState | null>(null);
  const [bundlePickerState, setBundlePickerState] = useState<BundlePickerState | null>(null);
  const [criterionPickerState, setCriterionPickerState] = useState<CriterionPickerState | null>(null);
  const [bundleActionMenuState, setBundleActionMenuState] = useState<BundleActionMenuState | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("by-category");
  const [tableSearch, setTableSearch] = useState("");
  const [tableStageFilter, setTableStageFilter] = useState<ReviewStageFilter>("all");
  const [workbenchGroupBy, setWorkbenchGroupBy] = useState<WorkbenchGroupBy>("stage");
  const [selectedFocusKey, setSelectedFocusKey] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const fileDecisionCount = viewState.fileDecisionItems.length;
  const bundleDecisionCount = useMemo(
    () => viewState.bundleReviewGroups.reduce((sum, group) => sum + group.items.length, 0),
    [viewState.bundleReviewGroups],
  );
  const criterionDecisionCount = viewState.criterionReviewQueue.length;
  const otherBundleCount = useMemo(
    () => viewState.otherBundleGroups.reduce((sum, group) => sum + group.items.length, 0),
    [viewState.otherBundleGroups],
  );
  const otherCriterionCount = viewState.otherCriterionQueue.length;
  const referenceCount = viewState.referenceItems.length;
  const readyCount = useMemo(
    () => readyCountFromBands(viewState.readyBands) || initialRoutineCount,
    [initialRoutineCount, viewState.readyBands],
  );
  const unresolvedCount = fileDecisionCount + bundleDecisionCount + criterionDecisionCount;
  const heldLaterCount = referenceCount + otherBundleCount + otherCriterionCount;
  const resolvedCount = Math.max(totalTagged - unresolvedCount, 0);
  const progressPercent = totalTagged > 0 ? Math.min((resolvedCount / totalTagged) * 100, 100) : 0;

  const focusEntries = useMemo<ReviewFocusEntry[]>(
    () => [
      ...viewState.fileDecisionItems.map((item) => ({
        key: `file:${item.id}`,
        kind: "file" as const,
        item,
      })),
      ...viewState.bundleReviewGroups.flatMap((group) =>
        group.items.map((item) => ({
          key: `bundle:${item.id}`,
          kind: "bundle" as const,
          item,
          groupName: group.bundleName,
        })),
      ),
      ...viewState.criterionReviewQueue.map((item) => ({
        key: `criterion:${item.id}`,
        kind: "criterion" as const,
        item,
      })),
    ],
    [viewState.bundleReviewGroups, viewState.criterionReviewQueue, viewState.fileDecisionItems],
  );

  const activeBundleCount = useMemo(() => {
    const bundleKeys = new Set<string>();

    viewState.bundleReviewGroups.forEach((group) => {
      bundleKeys.add(group.bundleId ?? group.key);
    });

    viewState.otherBundleGroups.forEach((group) => {
      bundleKeys.add(group.bundleId ?? group.key);
    });

    viewState.criterionReviewQueue.forEach((item) => {
      bundleKeys.add(item.id);
    });

    viewState.otherCriterionQueue.forEach((item) => {
      bundleKeys.add(item.id);
    });

    return bundleKeys.size;
  }, [
    viewState.bundleReviewGroups,
    viewState.criterionReviewQueue,
    viewState.otherBundleGroups,
    viewState.otherCriterionQueue,
  ]);

  const filteredTableEntries = useMemo(() => {
    const normalizedSearch = tableSearch.trim().toLowerCase();

    return focusEntries.filter((entry) => {
      if (tableStageFilter !== "all" && getFocusStageKey(entry) !== tableStageFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        getFocusTitle(entry),
        getFocusSummary(entry),
        getFocusReasoning(entry),
        getFocusWorkspaceLabel(entry),
        getFocusBundleLabel(entry) ?? "",
        getFocusMetaLabel(entry),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [focusEntries, tableSearch, tableStageFilter]);

  const groupedWorkbenchEntries = useMemo(() => {
    const groups = new Map<string, ReviewFocusEntry[]>();

    focusEntries.forEach((entry) => {
      let groupLabel = getFocusStageLabel(entry);

      if (workbenchGroupBy === "bundle") {
        groupLabel = getFocusBundleLabel(entry) ?? "Unassigned bundle";
      } else if (workbenchGroupBy === "workspace") {
        groupLabel = getFocusWorkspaceLabel(entry);
      }

      const current = groups.get(groupLabel) ?? [];
      current.push(entry);
      groups.set(groupLabel, current);
    });

    return [...groups.entries()].map(([label, entries]) => ({
      label,
      entries,
    }));
  }, [focusEntries, workbenchGroupBy]);

  const effectiveSelectedFocusKey =
    selectedFocusKey && focusEntries.some((entry) => entry.key === selectedFocusKey)
      ? selectedFocusKey
      : focusEntries[0]?.key ?? null;

  const selectedFocusEntry =
    focusEntries.find((entry) => entry.key === effectiveSelectedFocusKey) ?? focusEntries[0] ?? null;
  const selectedFocusIndex = selectedFocusEntry
    ? focusEntries.findIndex((entry) => entry.key === selectedFocusEntry.key)
    : -1;

  function stepFocus(offset: number) {
    if (selectedFocusIndex < 0) {
      return;
    }

    const nextEntry = focusEntries[selectedFocusIndex + offset];

    if (nextEntry) {
      setSelectedFocusKey(nextEntry.key);
    }
  }

  async function patchReviewStatus(id: string, status: EvidenceReviewStatus) {
    const response = await fetch(`/api/evidence/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error("Unable to save the file decision.");
    }
  }

  async function patchBulkReviewStatus(ids: string[], status: EvidenceReviewStatus) {
    const response = await fetch("/api/evidence/bulk-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids, status }),
    });

    if (!response.ok) {
      throw new Error("Unable to save the bundle archive action.");
    }
  }

  async function patchDocumentBundleDecision(
    jobId: string,
    documentId: string,
    status: "accepted" | "other" | "clear",
  ) {
    const response = await fetch("/api/review-workflow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId,
        type: "document-bundle",
        documentId,
        status,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save the bundle review state.");
    }
  }

  async function patchBundleCriterionDecision(
    jobId: string,
    bundleId: string,
    status: "accepted" | "other" | "clear",
    criterionCode: string | null,
  ) {
    const response = await fetch("/api/review-workflow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId,
        type: "bundle-criterion",
        bundleId,
        status,
        criterionCode,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save the criterion review state.");
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
        targetBundleId: option.kind === "bundle" ? option.id : option.parentBundleId,
        targetSubBundleId: option.kind === "sub_bundle" ? option.id : null,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to move the file to the selected bundle.");
    }
  }

  async function createBundleForItem(item: ReviewDecisionItem) {
    const parentBundleId = item.topLevelBundleId;

    if (!parentBundleId) {
      throw new Error("Setu needs a top-level bundle before it can create a sub-bundle.");
    }

    const response = await fetch(`/api/bundles/${parentBundleId}/sub-bundles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: item.jobId,
        name: `New bundle — ${item.title.slice(0, 36)}`,
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

    return payload.data;
  }

  async function patchBundleCategory(item: ReviewBundleDecisionItem, bucketCode: string) {
    const response = await fetch("/api/overrides", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: item.jobId,
        type: "bundle-category",
        bundleId: item.id,
        bucketCode,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save the criterion assignment.");
    }
  }

  async function runViewStateAction(
    key: string,
    label: string,
    mutator: (state: ViewState) => ViewState,
    runner: () => Promise<void>,
    successMessage?: string,
  ) {
    if (busyKey) {
      return;
    }

    const snapshot = cloneViewState(viewState);
    setBusyKey(key);
    setBusyLabel(label);
    setDocumentMenuState(null);
    setBundlePickerState(null);
    setCriterionPickerState(null);
    setBundleActionMenuState(null);
    setViewState((current) => mutator(cloneViewState(current)));

    try {
      await runner();
      router.refresh();
      if (successMessage) {
        setToast({
          tone: "info",
          message: successMessage,
        });
      }
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
      setBusyKey(null);
      setBusyLabel("Saving review action");
    }
  }

  function openDocumentMenu(
    item: ReviewDecisionItem,
    kind: DocumentActionMenuState["kind"],
    x: number,
    y: number,
  ) {
    setBundlePickerState(null);
    setCriterionPickerState(null);
    setBundleActionMenuState(null);
    setDocumentMenuState({
      item,
      kind,
      x,
      y,
    });
  }

  function openDocumentMenuAtElement(
    item: ReviewDecisionItem,
    kind: DocumentActionMenuState["kind"],
    element: HTMLElement,
  ) {
    const rect = element.getBoundingClientRect();
    openDocumentMenu(item, kind, rect.left, rect.bottom + 6);
  }

  function openBundlePicker(
    item: ReviewDecisionItem,
    source: BundlePickerState["source"],
    element: HTMLElement,
  ) {
    const rect = element.getBoundingClientRect();
    setDocumentMenuState(null);
    setCriterionPickerState(null);
    setBundleActionMenuState(null);
    setBundlePickerState({
      item,
      source,
      x: rect.left,
      y: rect.bottom + 6,
    });
  }

  function openCriterionPicker(
    item: ReviewBundleDecisionItem,
    source: CriterionPickerState["source"],
    element: HTMLElement,
  ) {
    const rect = element.getBoundingClientRect();
    setDocumentMenuState(null);
    setBundlePickerState(null);
    setBundleActionMenuState(null);
    setCriterionPickerState({
      item,
      source,
      x: rect.left,
      y: rect.bottom + 6,
    });
  }

  function openBundleActionMenu(
    item: ReviewBundleDecisionItem,
    kind: BundleActionMenuState["kind"],
    element: HTMLElement,
  ) {
    const rect = element.getBoundingClientRect();
    setDocumentMenuState(null);
    setBundlePickerState(null);
    setCriterionPickerState(null);
    setBundleActionMenuState({
      item,
      kind,
      x: rect.left,
      y: rect.bottom + 6,
    });
  }

  function handleQuickPeek(item: ReviewDecisionItem) {
    setPreview({
      title: item.title,
      previewHref: item.previewHref,
      sourceHref: item.sourceHref,
    });
  }

  function showReasoning(title: string, reasoningText: string) {
    setReasoning({
      title,
      reasoning: reasoningText,
    });
  }

  function handleKeepFile(item: ReviewDecisionItem) {
    void runViewStateAction(
      item.id,
      "Keeping file in the active review set",
      (state) => addToBundleReviewGroups(
        {
          ...state,
          fileDecisionItems: state.fileDecisionItems.filter((entry) => entry.id !== item.id),
        },
        { ...item, reviewStatus: "kept" as const },
      ),
      async () => {
        await patchReviewStatus(item.id, "kept");
      },
    );
  }

  function handleMoveToReference(item: ReviewDecisionItem) {
    void runViewStateAction(
      item.id,
      "Moving file to Reference",
      (state) => moveItemToReference(state, item),
      async () => {
        await patchReviewStatus(item.id, "reference");
      },
    );
  }

  function handleMoveToArchive(item: ReviewDecisionItem) {
    void runViewStateAction(
      item.id,
      "Moving file to Archive",
      (state) => moveItemToArchive(state, item),
      async () => {
        await patchReviewStatus(item.id, "archived");
      },
    );
  }

  function handleReturnFromReference(item: ReviewDecisionItem) {
    void runViewStateAction(
      item.id,
      "Returning file to active review",
      (state) =>
        addToBundleReviewGroups(
          {
            ...state,
            referenceItems: state.referenceItems.filter((entry) => entry.id !== item.id),
          },
          { ...item, reviewStatus: "kept" as const },
        ),
      async () => {
        await patchReviewStatus(item.id, "kept");
      },
    );
  }

  function handleAcceptBundle(item: ReviewDecisionItem) {
    void runViewStateAction(
      item.id,
      "Confirming the bundle fit",
      (state) => ({
        ...state,
        bundleReviewGroups: removeItemFromGroups(state.bundleReviewGroups, item.id),
      }),
      async () => {
        await patchDocumentBundleDecision(item.jobId, item.id, "accepted");
      },
    );
  }

  function handleMarkOtherBundle(item: ReviewDecisionItem) {
    void runViewStateAction(
      item.id,
      "Holding file for a later bundle decision",
      (state) =>
        addToOtherBundleGroups(
          {
            ...state,
            bundleReviewGroups: removeItemFromGroups(state.bundleReviewGroups, item.id),
          },
          { ...item, reviewStatus: "kept" as const },
        ),
      async () => {
        await patchDocumentBundleDecision(item.jobId, item.id, "other");
      },
    );
  }

  function handleReturnFromOtherBundle(item: ReviewDecisionItem) {
    void runViewStateAction(
      item.id,
      "Returning file to bundle review",
      (state) =>
        addToBundleReviewGroups(
          {
            ...state,
            otherBundleGroups: removeItemFromGroups(state.otherBundleGroups, item.id),
          },
          { ...item, reviewStatus: "kept" as const },
        ),
      async () => {
        await patchDocumentBundleDecision(item.jobId, item.id, "clear");
      },
    );
  }

  function handleMoveFileToBundle(
    item: ReviewDecisionItem,
    option: ReviewWorkspaceBundleOption | { kind: "create" },
    source: "bundle" | "other-bundle",
  ) {
    void runViewStateAction(
      item.id,
      "Moving file into the selected bundle",
      (state) => ({
        ...state,
        bundleReviewGroups:
          source === "bundle"
            ? removeItemFromGroups(state.bundleReviewGroups, item.id)
            : state.bundleReviewGroups,
        otherBundleGroups:
          source === "other-bundle"
            ? removeItemFromGroups(state.otherBundleGroups, item.id)
            : state.otherBundleGroups,
      }),
      async () => {
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

        await patchDocumentBundleDecision(item.jobId, item.id, "accepted");
      },
      "Bundle assignment saved.",
    );
  }

  function handleAcceptCriterion(item: ReviewBundleDecisionItem) {
    const targetCriterionCode = resolveExistingCriterionCode(item);

    if (!targetCriterionCode) {
      setToast({
        tone: "error",
        message: "Setu needs a concrete criterion before this bundle can be accepted.",
      });
      return;
    }

    void runViewStateAction(
      item.id,
      "Confirming the bundle criterion",
      (state) => removeBundleItem(state, item.id, "criterion"),
      async () => {
        if (item.bucketCode !== targetCriterionCode) {
          await patchBundleCategory(item, targetCriterionCode);
        }

        await patchBundleCriterionDecision(item.jobId, item.id, "accepted", targetCriterionCode);
      },
      "Criterion assignment confirmed.",
    );
  }

  function handleAssignCriterion(item: ReviewBundleDecisionItem, criterionCode: string, source: "criterion" | "other-criterion") {
    if (criterionCode === OTHER_REVIEW_BUCKET_CODE) {
      handleMarkOtherCriterion(item);
      return;
    }

    void runViewStateAction(
      item.id,
      "Assigning the bundle to a criterion",
      (state) => removeBundleItem(state, item.id, source),
      async () => {
        await patchBundleCategory(item, criterionCode);
        await patchBundleCriterionDecision(item.jobId, item.id, "accepted", criterionCode);
      },
      "Criterion assignment saved.",
    );
  }

  function handleMarkOtherCriterion(item: ReviewBundleDecisionItem) {
    void runViewStateAction(
      item.id,
      "Holding bundle in OTHER",
      (state) => addBundleToOtherCriterion(state, item),
      async () => {
        if (item.bucketCode !== OTHER_REVIEW_BUCKET_CODE) {
          await patchBundleCategory(item, OTHER_REVIEW_BUCKET_CODE);
        }

        await patchBundleCriterionDecision(item.jobId, item.id, "other", null);
      },
      "Bundle moved to OTHER.",
    );
  }

  function handleReturnFromOtherCriterion(item: ReviewBundleDecisionItem) {
    void runViewStateAction(
      item.id,
      "Returning bundle to criterion review",
      (state) => addBundleToCriterionQueue(state, item),
      async () => {
        await patchBundleCategory(
          item,
          item.bucketCode && item.bucketCode !== OTHER_REVIEW_BUCKET_CODE
            ? item.bucketCode
            : "REVIEW",
        );
        await patchBundleCriterionDecision(item.jobId, item.id, "clear", null);
      },
    );
  }

  function handleArchiveCriterionBundle(
    item: ReviewBundleDecisionItem,
    source: "criterion" | "other-criterion",
  ) {
    void runViewStateAction(
      item.id,
      "Archiving the bundle from criterion review",
      (state) => moveBundleItemToArchive(state, item, source),
      async () => {
        await patchBulkReviewStatus(item.documentIds, "archived");
        await patchBundleCriterionDecision(item.jobId, item.id, "clear", null);
      },
      "Bundle archived from review.",
    );
  }

  const bundlePickerItems: ContextMenuEntry[] = bundlePickerState
    ? (() => {
        const workspace =
          workspaceContexts.find((entry) => entry.jobId === bundlePickerState.item.jobId) ?? null;

        if (!workspace) {
          return [];
        }

        return [
          ...workspace.bundleOptions.map((option) => ({
            id: `bundle-${option.id}`,
            label: `${option.name} · ${option.documentCount} file${option.documentCount === 1 ? "" : "s"}`,
            disabled:
              option.kind === "bundle"
                ? option.id === bundlePickerState.item.topLevelBundleId &&
                  bundlePickerState.item.currentParentBundleId === null
                : option.id === bundlePickerState.item.currentBundleId,
            onSelect: () =>
              handleMoveFileToBundle(
                bundlePickerState.item,
                option,
                bundlePickerState.source,
              ),
          })),
          {
            id: "bundle-divider",
            type: "separator" as const,
          },
          {
            id: "bundle-create",
            label: "Create new bundle",
            onSelect: () =>
              handleMoveFileToBundle(
                bundlePickerState.item,
                { kind: "create" },
                bundlePickerState.source,
              ),
          },
        ];
      })()
    : [];

  const criterionPickerItems: ContextMenuEntry[] = criterionPickerState
    ? buildCriterionPickerItems(criterionPickerState.item, (criterionCode) =>
        handleAssignCriterion(
          criterionPickerState.item,
          criterionCode,
          criterionPickerState.source,
        ),
      )
    : [];

  const bundleActionMenuItems: ContextMenuEntry[] = bundleActionMenuState
    ? (() => {
        const bundleItem = bundleActionMenuState.item;
        const criterionChildren = buildCriterionPickerItems(bundleItem, (criterionCode) =>
          handleAssignCriterion(
            bundleItem,
            criterionCode,
            bundleActionMenuState.kind,
          ),
        );
        const currentCriterionCode = resolveExistingCriterionCode(bundleItem);

        return [
          {
            id: "bundle-accept",
            label:
              bundleActionMenuState.kind === "criterion"
                ? "Accept bundle criterion"
                : "Return bundle to criterion queue",
            disabled:
              bundleActionMenuState.kind === "criterion" ? !currentCriterionCode : false,
            onSelect: () =>
              bundleActionMenuState.kind === "criterion"
                ? handleAcceptCriterion(bundleItem)
                : handleReturnFromOtherCriterion(bundleItem),
          },
          {
            id: "bundle-assign",
            label: "Assign bundle to criterion",
            children: criterionChildren,
          },
          ...(bundleActionMenuState.kind === "criterion"
            ? [
                {
                  id: "bundle-other",
                  label: "Move bundle to OTHER",
                  onSelect: () => handleMarkOtherCriterion(bundleItem),
                } satisfies ContextMenuEntry,
              ]
            : []),
          {
            id: "bundle-archive",
            label: "Move bundle to Archive",
            onSelect: () =>
              handleArchiveCriterionBundle(bundleItem, bundleActionMenuState.kind),
          },
          {
            id: "bundle-divider",
            type: "separator" as const,
          },
          {
            id: "bundle-open-dense",
            label: "Open in dense workbench",
            onSelect: () => {
              router.push(bundleItem.denseReviewHref);
            },
          },
          {
            id: "bundle-show-reasoning",
            label: "Show AI reasoning",
            onSelect: () => showReasoning(bundleItem.bundleName, bundleItem.rationale),
          },
        ];
      })()
    : [];

  const documentActionMenuItems: ContextMenuEntry[] = documentMenuState
    ? (() => {
        const item = documentMenuState.item;

        if (documentMenuState.kind === "file") {
          return [
            {
              id: "file-keep",
              label: "Keep file",
              onSelect: () => handleKeepFile(item),
            },
            {
              id: "file-reference",
              label: "Move file to Reference",
              onSelect: () => handleMoveToReference(item),
            },
            {
              id: "file-archive",
              label: "Move file to Archive",
              onSelect: () => handleMoveToArchive(item),
            },
            {
              id: "file-divider",
              type: "separator" as const,
            },
            {
              id: "file-peek",
              label: "Open Quick peek",
              onSelect: () => handleQuickPeek(item),
            },
            {
              id: "file-reasoning",
              label: "Show AI reasoning",
              onSelect: () => showReasoning(item.title, item.reasoning),
            },
          ];
        }

        if (documentMenuState.kind === "reference") {
          return [
            {
              id: "reference-return",
              label: "Return file to active review",
              onSelect: () => handleReturnFromReference(item),
            },
            {
              id: "reference-archive",
              label: "Move file to Archive",
              onSelect: () => handleMoveToArchive(item),
            },
            {
              id: "reference-divider",
              type: "separator" as const,
            },
            {
              id: "reference-peek",
              label: "Open Quick peek",
              onSelect: () => handleQuickPeek(item),
            },
            {
              id: "reference-reasoning",
              label: "Show AI reasoning",
              onSelect: () => showReasoning(item.title, item.reasoning),
            },
          ];
        }

        if (documentMenuState.kind === "other-bundle") {
          const workspace = workspaceContexts.find((entry) => entry.jobId === item.jobId) ?? null;
          const bundleChildren: ContextMenuEntry[] = workspace
            ? [
                ...workspace.bundleOptions.map((option) => ({
                  id: `bundle-${option.id}`,
                  label: `${option.name} · ${option.documentCount} file${option.documentCount === 1 ? "" : "s"}`,
                  onSelect: () => handleMoveFileToBundle(item, option, "other-bundle"),
                })),
                {
                  id: "other-bundle-divider",
                  type: "separator" as const,
                },
                {
                  id: "other-bundle-create",
                  label: "Create new bundle",
                  onSelect: () => handleMoveFileToBundle(item, { kind: "create" }, "other-bundle"),
                },
              ]
            : [];

          return [
            {
              id: "other-bundle-return",
              label: "Return file to bundle review",
              onSelect: () => handleReturnFromOtherBundle(item),
            },
            {
              id: "other-bundle-move",
              label: "Move file to bundle",
              children: bundleChildren,
            },
            {
              id: "other-bundle-archive",
              label: "Move file to Archive",
              onSelect: () => handleMoveToArchive(item),
            },
            {
              id: "other-bundle-divider-two",
              type: "separator" as const,
            },
            {
              id: "other-bundle-peek",
              label: "Open Quick peek",
              onSelect: () => handleQuickPeek(item),
            },
            {
              id: "other-bundle-reasoning",
              label: "Show AI reasoning",
              onSelect: () => showReasoning(item.title, item.reasoning),
            },
          ];
        }

        const workspace = workspaceContexts.find((entry) => entry.jobId === item.jobId) ?? null;
        const bundleChildren: ContextMenuEntry[] = workspace
          ? [
              ...workspace.bundleOptions.map((option) => ({
                id: `bundle-${option.id}`,
                label: `${option.name} · ${option.documentCount} file${option.documentCount === 1 ? "" : "s"}`,
                onSelect: () => handleMoveFileToBundle(item, option, "bundle"),
              })),
              {
                id: "bundle-divider",
                type: "separator" as const,
              },
              {
                id: "bundle-create",
                label: "Create new bundle",
                onSelect: () => handleMoveFileToBundle(item, { kind: "create" }, "bundle"),
              },
            ]
          : [];

        return [
          {
            id: "bundle-accept",
            label: "Accept file in bundle",
            onSelect: () => handleAcceptBundle(item),
          },
          {
            id: "bundle-move",
            label: "Move file to bundle",
            children: bundleChildren,
          },
          {
            id: "bundle-other",
            label: "Move file to OTHER",
            onSelect: () => handleMarkOtherBundle(item),
          },
          {
            id: "bundle-reference",
            label: "Move file to Reference",
            onSelect: () => handleMoveToReference(item),
          },
          {
            id: "bundle-archive",
            label: "Move file to Archive",
            onSelect: () => handleMoveToArchive(item),
          },
          {
            id: "bundle-divider-two",
            type: "separator" as const,
          },
          {
            id: "bundle-peek",
            label: "Open Quick peek",
            onSelect: () => handleQuickPeek(item),
          },
          {
            id: "bundle-reasoning",
            label: "Show AI reasoning",
            onSelect: () => showReasoning(item.title, item.reasoning),
          },
        ];
      })()
    : [];

  function renderFileActionButtons(item: ReviewDecisionItem) {
    return (
      <>
        <button
          type="button"
          onClick={() => handleKeepFile(item)}
          className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold text-white"
        >
          Keep file
        </button>
        <button
          type="button"
          onClick={() => handleMoveToArchive(item)}
          className={documentActionButtonClass()}
        >
          Archive file
        </button>
        <button
          type="button"
          onClick={() => handleQuickPeek(item)}
          className={documentActionButtonClass()}
        >
          Quick peek
        </button>
        <button
          type="button"
          onClick={(event) => openDocumentMenuAtElement(item, "file", event.currentTarget)}
          className={documentActionButtonClass()}
        >
          Actions
        </button>
      </>
    );
  }

  function renderBundleActionButtons(item: ReviewDecisionItem, source: BundlePickerState["source"] = "bundle") {
    return (
      <>
        <button
          type="button"
          onClick={() =>
            source === "other-bundle" ? handleReturnFromOtherBundle(item) : handleAcceptBundle(item)
          }
          className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold text-white"
        >
          {source === "other-bundle" ? "Return file to queue" : "Accept bundle fit"}
        </button>
        <button
          type="button"
          onClick={(event) => openBundlePicker(item, source, event.currentTarget)}
          className={documentActionButtonClass()}
        >
          Move file to bundle
        </button>
        <button
          type="button"
          onClick={() =>
            source === "other-bundle" ? handleQuickPeek(item) : handleMarkOtherBundle(item)
          }
          className={documentActionButtonClass()}
        >
          {source === "other-bundle" ? "Quick peek" : "Move file to OTHER"}
        </button>
        <button
          type="button"
          onClick={() => handleMoveToArchive(item)}
          className={documentActionButtonClass()}
        >
          Archive file
        </button>
        {source === "bundle" ? (
          <button
            type="button"
            onClick={() => handleQuickPeek(item)}
            className={documentActionButtonClass()}
          >
            Quick peek
          </button>
        ) : null}
      </>
    );
  }

  function renderCriterionActionButtons(
    item: ReviewBundleDecisionItem,
    source: CriterionPickerState["source"] = "criterion",
  ) {
    return (
      <>
        <button
          type="button"
          onClick={() =>
            source === "criterion" ? handleAcceptCriterion(item) : handleReturnFromOtherCriterion(item)
          }
          disabled={source === "criterion" ? !resolveExistingCriterionCode(item) : false}
          className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {source === "criterion" ? "Accept bundle criterion" : "Return bundle to queue"}
        </button>
        <button
          type="button"
          onClick={(event) => openCriterionPicker(item, source, event.currentTarget)}
          className={documentActionButtonClass()}
        >
          Assign bundle to criterion
        </button>
        <button
          type="button"
          onClick={() => (source === "criterion" ? handleMarkOtherCriterion(item) : showReasoning(item.bundleName, item.rationale))}
          className={documentActionButtonClass()}
        >
          {source === "criterion" ? "OTHER" : "Reasoning"}
        </button>
        <button
          type="button"
          onClick={() => handleArchiveCriterionBundle(item, source)}
          className={documentActionButtonClass()}
        >
          Archive bundle
        </button>
        <Link href={item.denseReviewHref} className={documentActionButtonClass()}>
          Dense workbench
        </Link>
      </>
    );
  }

  function renderFocusActions(entry: ReviewFocusEntry) {
    if (entry.kind === "file") {
      return renderFileActionButtons(entry.item);
    }

    if (entry.kind === "bundle") {
      return renderBundleActionButtons(entry.item);
    }

    return renderCriterionActionButtons(entry.item);
  }

  function renderFocusDetail(entry: ReviewFocusEntry, compact = false) {
    const previewHref = getFocusPreviewHref(entry);
    const sourceHref = getFocusSourceHref(entry);

    return (
      <div className={`grid gap-3 ${compact ? "lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]" : "xl:grid-cols-[minmax(0,1.35fr)_320px]"}`}>
        <div className="overflow-hidden rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-cream)]">
          <div className="border-b border-[var(--border-secondary)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              {entry.kind === "criterion" ? "Bundle brief" : "Quick preview"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={reviewTypeBadgeClass(getFocusType(entry))}>
                {getFocusTypeBadgeLabel(entry)}
              </span>
              <p className="text-[13px] font-semibold text-[var(--foreground)]">
                {getFocusTitle(entry)}
              </p>
            </div>
          </div>
          {previewHref ? (
            <iframe
              title={getFocusTitle(entry)}
              src={previewHref}
              className={`${compact ? "h-[340px]" : "h-[420px]"} w-full bg-[var(--paper-secondary)]`}
            />
          ) : (
            <div className="space-y-3 px-4 py-4 text-[12px] leading-6 text-[var(--foreground)]/84">
              <p className="font-semibold text-[var(--foreground)]">{getFocusSummary(entry)}</p>
              <p>{getFocusReasoning(entry)}</p>
              {entry.kind === "criterion" ? (
                <Link
                  href={entry.item.denseReviewHref}
                  className="inline-flex items-center gap-2 rounded-[999px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
                >
                  Open dense workbench
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-[16px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-deep)]">
              Setu suggests
            </p>
            <p className="mt-2 text-[12px] leading-6 text-[var(--brand-deep)]">
              {getFocusReasoning(entry)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={reviewTypeBadgeClass(getFocusType(entry))}>
                {getFocusTypeBadgeLabel(entry)}
              </span>
              <span className="rounded-full bg-[var(--paper-primary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                {getFocusStageLabel(entry)}
              </span>
              {getFocusCriterionLabel(entry) ? (
                <span className="rounded-full bg-[var(--paper-primary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                  {getFocusCriterionLabel(entry)}
                </span>
              ) : null}
              {getFocusConfidence(entry) !== null ? (
                <span className="ml-auto text-[10px] font-semibold text-[var(--brand-deep)]">
                  Confidence {getFocusConfidence(entry)}%
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Current placement
            </p>
            <div className="mt-3 space-y-2 text-[11px] leading-5 text-[var(--foreground)]/84">
              <p>
                Type: <strong>{getFocusTypeDisplayLabel(entry)}</strong>
              </p>
              <p>
                Workspace: <strong>{getFocusWorkspaceLabel(entry)}</strong>
              </p>
              <p>
                Bundle: <strong>{getFocusBundleLabel(entry) ?? "Unassigned"}</strong>
              </p>
              <p>
                Detail: <strong>{getFocusMetaLabel(entry)}</strong>
              </p>
            </div>
          </div>

          <div className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Actions
            </p>
            <div className="mt-3 flex flex-wrap gap-2">{renderFocusActions(entry)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.kind !== "criterion" && sourceHref ? (
                <a
                  href={sourceHref}
                  target="_blank"
                  rel="noreferrer"
                  className={documentActionButtonClass()}
                >
                  Open original
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => showReasoning(getFocusTitle(entry), getFocusReasoning(entry))}
                className={documentActionButtonClass()}
              >
                Show reasoning
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="inline-flex w-full flex-wrap items-center gap-1 rounded-[10px] bg-[var(--paper-secondary)] p-1 xl:w-auto">
            <button type="button" onClick={() => setReviewMode("inbox")} className={reviewModeButtonClass(reviewMode === "inbox")}>
              Inbox
            </button>
            <button type="button" onClick={() => setReviewMode("table")} className={reviewModeButtonClass(reviewMode === "table")}>
              Table
            </button>
            <button type="button" onClick={() => setReviewMode("workbench")} className={reviewModeButtonClass(reviewMode === "workbench")}>
              Workbench
            </button>
            <button type="button" onClick={() => setReviewMode("by-category")} className={reviewModeButtonClass(reviewMode === "by-category")}>
              By category
            </button>
          </div>
          <p className="text-[11px] text-[var(--muted)] xl:flex-1">
            <span className="font-semibold text-[var(--foreground)]">{totalTagged}</span> documents across{" "}
            <span className="font-semibold text-[var(--foreground)]">{activeBundleCount}</span> bundles ·{" "}
            <span className="font-semibold text-[var(--foreground)]">{unresolvedCount}</span> open next-step decisions
          </p>
          <div className="inline-flex items-center gap-2 rounded-[999px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Held later
            <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[var(--brand-deep)]">
              {heldLaterCount}
            </span>
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

      {reviewMode === "inbox" ? (
        focusEntries.length ? (
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Progress
                </p>
                <p className="mt-2 font-mono text-[30px] font-semibold text-[var(--foreground)]">
                  {resolvedCount}
                </p>
                <p className="text-[11px] text-[var(--muted)]">of {totalTagged} files moved forward</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--paper-primary)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-4 space-y-2 text-[11px] text-[var(--muted)]">
                  <div className="flex items-center justify-between">
                    <span>File decisions</span>
                    <span className="font-mono font-semibold text-[var(--foreground)]">{fileDecisionCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bundle review</span>
                    <span className="font-mono font-semibold text-[var(--foreground)]">{bundleDecisionCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Criterion review</span>
                    <span className="font-mono font-semibold text-[var(--foreground)]">{criterionDecisionCount}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border-secondary)] pt-2">
                    <span>Ready</span>
                    <span className="font-mono font-semibold text-[var(--foreground)]">{readyCount}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] px-4 py-4 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  Working order
                </p>
                <div className="mt-3 space-y-3 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span>1. Keep or archive</span>
                    <span className="rounded-[4px] bg-white/10 px-2 py-0.5 font-mono">Files</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>2. Confirm bundle fit</span>
                    <span className="rounded-[4px] bg-white/10 px-2 py-0.5 font-mono">Bundles</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>3. Confirm criterion fit</span>
                    <span className="rounded-[4px] bg-white/10 px-2 py-0.5 font-mono">Criteria</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Held later</span>
                    <span className="rounded-[4px] bg-white/10 px-2 py-0.5 font-mono">OTHER</span>
                  </div>
                </div>
              </div>
            </aside>

            <div className="rounded-[20px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              {selectedFocusEntry ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-secondary)] pb-3">
                    <span className="rounded-full bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {getFocusStageLabel(selectedFocusEntry)}
                    </span>
                    <p className="text-[14px] font-semibold text-[var(--foreground)]">
                      {getFocusTitle(selectedFocusEntry)}
                    </p>
                    <span className="text-[10px] font-mono text-[var(--muted)]">
                      {selectedFocusIndex + 1} / {focusEntries.length}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => stepFocus(-1)}
                        disabled={selectedFocusIndex <= 0}
                        className="setu-ghost-button rounded-[8px] px-2.5 py-1.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => stepFocus(1)}
                        disabled={selectedFocusIndex >= focusEntries.length - 1}
                        className="setu-ghost-button rounded-[8px] px-2.5 py-1.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">{renderFocusDetail(selectedFocusEntry, true)}</div>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-5 text-[12px] leading-6 text-[var(--muted)]">
            The inbox is clear. Setu does not see any open next-step review decisions right now.
          </div>
        )
      ) : null}

      {reviewMode === "table" ? (
        <div className="space-y-3">
          <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-4 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All open", count: focusEntries.length },
                  { key: "file", label: "Files", count: fileDecisionCount },
                  { key: "bundle", label: "Bundles", count: bundleDecisionCount },
                  { key: "criterion", label: "Criteria", count: criterionDecisionCount },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setTableStageFilter(filter.key as ReviewStageFilter)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                      tableStageFilter === filter.key
                        ? "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-white"
                        : "border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--foreground)]"
                    }`}
                  >
                    {filter.label} · {filter.count}
                  </button>
                ))}
              </div>
              <input
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
                placeholder="Search titles, summaries, bundles, or workspaces"
                className="w-full rounded-[10px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] text-[var(--foreground)] outline-none xl:ml-auto xl:max-w-[360px]"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-[var(--paper-tertiary)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">AI summary</th>
                    <th className="px-4 py-3">Workspace</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Bundle</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTableEntries.length ? (
                    filteredTableEntries.map((entry) => (
                      <tr key={entry.key} className="border-t border-[var(--border-secondary)] align-top">
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFocusKey(entry.key);
                              setReviewMode("workbench");
                            }}
                            className="text-left"
                          >
                            <span className={reviewTypeBadgeClass(getFocusType(entry))}>
                              {getFocusTypeBadgeLabel(entry)}
                            </span>
                            <p className="text-[12px] font-semibold text-[var(--foreground)]">
                              {getFocusTitle(entry)}
                            </p>
                            <p className="mt-1 text-[10px] text-[var(--muted)]">
                              {getFocusMetaLabel(entry)}
                            </p>
                          </button>
                        </td>
                        <td className="px-4 py-4 text-[11px] text-[var(--muted)]">
                          {getFocusTypeDisplayLabel(entry)}
                        </td>
                        <td className="max-w-[320px] px-4 py-4 text-[11px] leading-5 text-[var(--foreground)]/82">
                          {getFocusSummary(entry)}
                        </td>
                        <td className="px-4 py-4 text-[11px] text-[var(--muted)]">{getFocusWorkspaceLabel(entry)}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                            {getFocusStageLabel(entry)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[11px] text-[var(--muted)]">
                          {getFocusBundleLabel(entry) ?? "Unassigned"}
                        </td>
                        <td className="px-4 py-4 text-[11px] font-semibold text-[var(--foreground)]">
                          {getFocusConfidence(entry) !== null ? `${getFocusConfidence(entry)}%` : "—"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">{renderFocusActions(entry)}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-5 text-[12px] text-[var(--muted)]">
                        No open items match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {reviewMode === "workbench" ? (
        focusEntries.length ? (
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)]">
              <div className="border-b border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Group by
                  </span>
                  {[
                    { key: "stage", label: "Stage" },
                    { key: "bundle", label: "Bundle" },
                    { key: "workspace", label: "Workspace" },
                  ].map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setWorkbenchGroupBy(group.key as WorkbenchGroupBy)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        workbenchGroupBy === group.key
                          ? "bg-[var(--brand-charcoal)] text-white"
                          : "bg-[var(--paper-primary)] text-[var(--muted)]"
                      }`}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-[720px] overflow-y-auto px-3 py-3">
                {groupedWorkbenchEntries.map((group) => (
                  <div key={group.label} className="mb-4">
                    <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      <span>{group.label}</span>
                      <span>{group.entries.length}</span>
                    </div>
                    <div className="space-y-2">
                      {group.entries.map((entry) => (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => setSelectedFocusKey(entry.key)}
                          className={`w-full rounded-[14px] border px-3 py-3 text-left transition ${
                            selectedFocusEntry?.key === entry.key
                              ? "border-[var(--brand-charcoal)] bg-[var(--paper-tertiary)]"
                              : "border-[var(--border-secondary)] bg-[var(--paper-primary)] hover:bg-[var(--paper-tertiary)]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={reviewTypeBadgeClass(getFocusType(entry))}>
                                  {getFocusTypeBadgeLabel(entry)}
                                </span>
                                <p className="truncate text-[12px] font-semibold text-[var(--foreground)]">
                                  {getFocusTitle(entry)}
                                </p>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)]">
                                <span>{getFocusStageLabel(entry)}</span>
                                <span>•</span>
                                <span>{getFocusTypeDisplayLabel(entry)}</span>
                                <span>•</span>
                                <span>{getFocusMetaLabel(entry)}</span>
                              </div>
                            </div>
                            {getFocusConfidence(entry) !== null ? (
                              <span className="text-[10px] font-semibold text-[var(--muted)]">
                                {getFocusConfidence(entry)}%
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <div className="overflow-hidden rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              {selectedFocusEntry ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-secondary)] px-4 py-3">
                    <span className={reviewTypeBadgeClass(getFocusType(selectedFocusEntry))}>
                      {getFocusTypeBadgeLabel(selectedFocusEntry)}
                    </span>
                    <span className="rounded-full bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      {getFocusStageLabel(selectedFocusEntry)}
                    </span>
                    <p className="text-[14px] font-semibold text-[var(--foreground)]">
                      {getFocusTitle(selectedFocusEntry)}
                    </p>
                    <span className="text-[10px] font-mono text-[var(--muted)]">
                      {selectedFocusIndex + 1} / {focusEntries.length}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => stepFocus(-1)}
                        disabled={selectedFocusIndex <= 0}
                        className="setu-ghost-button rounded-[8px] px-2.5 py-1.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => stepFocus(1)}
                        disabled={selectedFocusIndex >= focusEntries.length - 1}
                        className="setu-ghost-button rounded-[8px] px-2.5 py-1.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-4">{renderFocusDetail(selectedFocusEntry)}</div>
                </>
              ) : (
                <div className="px-4 py-5 text-[12px] text-[var(--muted)]">
                  Pick an item from the list to inspect it in detail.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-5 text-[12px] leading-6 text-[var(--muted)]">
            The workbench is clear. Setu does not see any open next-step review decisions right now.
          </div>
        )
      ) : null}

      {reviewMode === "by-category" ? (
        <>
          <div className="rounded-[18px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-4 py-4">
            <p className="text-[13px] font-semibold text-[var(--brand-deep)]">
              {totalTagged} tagged documents for {clientName}
            </p>
            <p className="mt-2 text-[12px] leading-6 text-[var(--brand-deep)]">
              {readyCount} files are fully settled. {unresolvedCount} still need a human decision.
              {heldLaterCount > 0 ? ` ${heldLaterCount} are parked in OTHER or Reference for later cleanup.` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <div className="flex flex-col">
                <span className="font-mono text-[18px] font-semibold text-[var(--brand-deep)]">{readyCount}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--brand-deep)]">Ready</span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[18px] font-semibold text-[var(--brand-deep)]">{unresolvedCount}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--brand-deep)]">Need decisions</span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[18px] font-semibold text-[var(--brand-deep)]">{activeBundleCount}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--brand-deep)]">Bundles in play</span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[18px] font-semibold text-[var(--brand-deep)]">{heldLaterCount}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--brand-deep)]">Held later</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <CategoryBand
              legalCode="1"
              title="Keep or archive files"
              taggedCount={fileDecisionCount}
              decisionCount={fileDecisionCount}
              routineCount={0}
              note="Start here. Decide whether the file stays in the active petition set before making any bundle or criterion call."
              defaultOpen={fileDecisionCount > 0}
              headerChipClassName="bg-[var(--brand-soft)] text-[var(--brand-deep)]"
            >
              {viewState.fileDecisionItems.length ? (
                viewState.fileDecisionItems.map((item) => (
                  <WorkflowDocumentCard
                    key={item.id}
                    item={item}
                    stageLabel="File decision"
                    helperLabel="What needs a call"
                    helperBody={item.reasoning}
                    onContextMenu={(nextItem, event) => {
                      event.preventDefault();
                      openDocumentMenu(nextItem, "file", event.clientX, event.clientY);
                    }}
                    actions={renderFileActionButtons(item)}
                  />
                ))
              ) : (
                <p className="text-[12px] leading-6 text-[var(--muted)]">
                  No file-level decisions are waiting right now.
                </p>
              )}
            </CategoryBand>

            <CategoryBand
              legalCode="2"
              title="Confirm the right bundle"
              taggedCount={bundleDecisionCount}
              decisionCount={bundleDecisionCount}
              routineCount={0}
              note="Once a file is kept, confirm whether it belongs in the current bundle or move it before criterion review begins."
              defaultOpen={bundleDecisionCount > 0}
              headerChipClassName="bg-[var(--brand-soft)] text-[var(--brand-deep)]"
            >
              {viewState.bundleReviewGroups.length ? (
                viewState.bundleReviewGroups.map((group) => (
                  <div
                    key={group.key}
                    className="space-y-3 rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--foreground)]">
                        {group.bundleName}
                      </span>
                      <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
                        {group.itemCount} file{group.itemCount === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
                        {group.workspaceLabel}
                      </span>
                    </div>
                    {group.items.map((item) => (
                      <WorkflowDocumentCard
                        key={item.id}
                        item={item}
                        stageLabel="Bundle review"
                        helperLabel="Why Setu paused"
                        helperBody="Confirm the current bundle, move this file into a better bundle, or hold it in OTHER until you decide later."
                        accentTone="muted"
                        onContextMenu={(nextItem, event) => {
                          event.preventDefault();
                          openDocumentMenu(nextItem, "bundle", event.clientX, event.clientY);
                        }}
                        actions={renderBundleActionButtons(item)}
                      />
                    ))}
                  </div>
                ))
              ) : (
                <p className="text-[12px] leading-6 text-[var(--muted)]">
                  No kept files are waiting for a bundle call right now.
                </p>
              )}
            </CategoryBand>

            <CategoryBand
              legalCode="3"
              title="Confirm the right criterion"
              taggedCount={criterionDecisionCount}
              decisionCount={criterionDecisionCount}
              routineCount={0}
              note="Only bundles whose kept files have already cleared bundle review appear here."
              defaultOpen={criterionDecisionCount > 0}
              headerChipClassName="bg-[var(--brand-soft)] text-[var(--brand-deep)]"
            >
              {viewState.criterionReviewQueue.length ? (
                viewState.criterionReviewQueue.map((item) => (
                  <WorkflowBundleCard
                    key={item.id}
                    item={item}
                    stageLabel="Criterion review"
                    helperText="Accept the current criterion, move the bundle into the right criterion, or park it in OTHER for later."
                    onContextMenu={(nextItem, event) => {
                      event.preventDefault();
                      openBundleActionMenu(nextItem, "criterion", event.currentTarget);
                    }}
                    actions={renderCriterionActionButtons(item)}
                  />
                ))
              ) : (
                <p className="text-[12px] leading-6 text-[var(--muted)]">
                  No bundle-level criterion calls are waiting right now.
                </p>
              )}
            </CategoryBand>

            <CategoryBand
              legalCode="OTHER"
              title="OTHER"
              taggedCount={heldLaterCount}
              decisionCount={0}
              routineCount={heldLaterCount}
              note="This placeholder holds evidence and bundles that you want to revisit later for bundling, categorization, or classification without blocking the active queue."
              defaultOpen={heldLaterCount > 0}
              headerChipClassName="bg-[var(--state-warning-soft)] text-[var(--state-warning)]"
            >
              {viewState.referenceItems.length ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Reference
                  </p>
                  {viewState.referenceItems.map((item) => (
                    <WorkflowDocumentCard
                      key={item.id}
                      item={item}
                      stageLabel="Reference"
                      helperLabel="Why it is held"
                      helperBody="This file is real and retrievable, but it is not currently load-bearing for a claimed criterion."
                      accentTone="warning"
                      onContextMenu={(nextItem, event) => {
                        event.preventDefault();
                        openDocumentMenu(nextItem, "reference", event.clientX, event.clientY);
                      }}
                      actions={
                        <>
                          <button
                            type="button"
                            onClick={() => handleReturnFromReference(item)}
                            className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold text-white"
                          >
                            Return to review
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveToArchive(item)}
                            className={documentActionButtonClass()}
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickPeek(item)}
                            className={documentActionButtonClass()}
                          >
                            Quick peek
                          </button>
                        </>
                      }
                    />
                  ))}
                </div>
              ) : null}

              {viewState.otherBundleGroups.length ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Bundling placeholder
                  </p>
                  {viewState.otherBundleGroups.map((group) => (
                    <div
                      key={group.key}
                      className="space-y-3 rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--foreground)]">
                          {group.workspaceLabel}
                        </span>
                        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-[var(--muted)]">
                          {group.itemCount} file{group.itemCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      {group.items.map((item) => (
                        <WorkflowDocumentCard
                          key={item.id}
                          item={item}
                          stageLabel="OTHER"
                          helperLabel="Why it is held"
                          helperBody="Keep this file, but hold it in OTHER until you are confident about the right bundle."
                          accentTone="warning"
                          onContextMenu={(nextItem, event) => {
                            event.preventDefault();
                            openDocumentMenu(nextItem, "other-bundle", event.clientX, event.clientY);
                          }}
                          actions={renderBundleActionButtons(item, "other-bundle")}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              {viewState.otherCriterionQueue.length ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Category placeholder
                  </p>
                  {viewState.otherCriterionQueue.map((item) => (
                    <WorkflowBundleCard
                      key={item.id}
                      item={item}
                      stageLabel="OTHER"
                      helperText="This bundle stays in the OTHER placeholder until you are ready to classify it confidently."
                      onContextMenu={(nextItem, event) => {
                        event.preventDefault();
                        openBundleActionMenu(nextItem, "other-criterion", event.currentTarget);
                      }}
                      actions={renderCriterionActionButtons(item, "other-criterion")}
                    />
                  ))}
                </div>
              ) : null}

              {heldLaterCount === 0 ? (
                <p className="text-[12px] leading-6 text-[var(--muted)]">
                  Nothing is parked for later right now.
                </p>
              ) : null}
            </CategoryBand>

            <CategoryBand
              legalCode="Ready"
              title="Ready library"
              taggedCount={readyCount}
              decisionCount={0}
              routineCount={readyCount}
              note="These files already cleared keep/archive, bundle fit, and criterion fit."
              defaultOpen={readyCount > 0}
            >
              {viewState.readyBands.length ? (
                viewState.readyBands.map((band) => (
                  <CategoryBand
                    key={band.key}
                    legalCode=""
                    title={band.title}
                    taggedCount={band.taggedCount}
                    decisionCount={0}
                    routineCount={band.routine?.count ?? 0}
                    note={band.note}
                  >
                    {band.routine ? (
                      <RoutineRow
                        label={band.routine.label}
                        count={band.routine.count}
                        samples={band.routine.samples}
                        href={band.routine.denseReviewHref}
                      />
                    ) : null}
                  </CategoryBand>
                ))
              ) : (
                <p className="text-[12px] leading-6 text-[var(--muted)]">
                  Files will land here once all three review steps are complete.
                </p>
              )}
            </CategoryBand>

            <CategoryBand
              legalCode="Archive"
              title="Archived out of the active petition set"
              taggedCount={viewState.archiveCount}
              decisionCount={0}
              routineCount={viewState.archiveCount}
              note="Archived files stay available in the dense workbench, but they are no longer part of the active review workflow."
            >
              <RoutineRow
                label="archived file"
                count={viewState.archiveCount}
                samples={viewState.archiveSampleTitles}
                href={archiveReviewHref}
              />
            </CategoryBand>
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-[12px] leading-6 text-[var(--muted)]">
          {unresolvedCount > 0
            ? "Strategy should wait until the next-step queues are resolved. Reference and Other holds can stay parked without blocking the rest of the case."
            : "All required review steps are complete. You can move straight into Strategy."}
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
            <Link
              href={strategyHref}
              className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-2 text-[11px] font-semibold text-white"
            >
              Preview strategy with pending queues
            </Link>
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

      <ContextMenu
        open={Boolean(documentMenuState)}
        x={documentMenuState?.x ?? 0}
        y={documentMenuState?.y ?? 0}
        items={documentActionMenuItems}
        onClose={() => setDocumentMenuState(null)}
      />

      <ContextMenu
        open={Boolean(bundlePickerState)}
        x={bundlePickerState?.x ?? 0}
        y={bundlePickerState?.y ?? 0}
        items={bundlePickerItems}
        onClose={() => setBundlePickerState(null)}
      />

      <ContextMenu
        open={Boolean(criterionPickerState)}
        x={criterionPickerState?.x ?? 0}
        y={criterionPickerState?.y ?? 0}
        items={criterionPickerItems}
        onClose={() => setCriterionPickerState(null)}
      />

      <ContextMenu
        open={Boolean(bundleActionMenuState)}
        x={bundleActionMenuState?.x ?? 0}
        y={bundleActionMenuState?.y ?? 0}
        items={bundleActionMenuItems}
        onClose={() => setBundleActionMenuState(null)}
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
                  Review note
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

      {busyKey ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-full border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-2 text-[11px] font-semibold text-[var(--foreground)] shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
          {busyLabel}
        </div>
      ) : null}
    </div>
  );
}
