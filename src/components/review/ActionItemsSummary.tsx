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
        bundleName: "Other bundle",
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
  return EB1A_CRITERIA_DEFINITIONS.map<ContextMenuEntry>((criterion) => ({
    id: `criterion-${criterion.code}`,
    label: `${criterion.legalCode} ${criterion.name}`,
    disabled: item.bucketCode === criterion.code,
    onSelect: () => onSelect(criterion.code),
  }));
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
      "Holding bundle in Other criterion",
      (state) => addBundleToOtherCriterion(state, item),
      async () => {
        if (item.bucketCode !== "REVIEW") {
          await patchBundleCategory(item, "REVIEW");
        }

        await patchBundleCriterionDecision(item.jobId, item.id, "other", null);
      },
      "Bundle moved to Other criterion.",
    );
  }

  function handleReturnFromOtherCriterion(item: ReviewBundleDecisionItem) {
    void runViewStateAction(
      item.id,
      "Returning bundle to criterion review",
      (state) => addBundleToCriterionQueue(state, item),
      async () => {
        await patchBundleCriterionDecision(item.jobId, item.id, "clear", null);
      },
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
                ? "Accept current criterion"
                : "Return to criterion queue",
            disabled:
              bundleActionMenuState.kind === "criterion" ? !currentCriterionCode : false,
            onSelect: () =>
              bundleActionMenuState.kind === "criterion"
                ? handleAcceptCriterion(bundleItem)
                : handleReturnFromOtherCriterion(bundleItem),
          },
          {
            id: "bundle-assign",
            label: "Assign criterion",
            children: criterionChildren,
          },
          ...(bundleActionMenuState.kind === "criterion"
            ? [
                {
                  id: "bundle-other",
                  label: "Move to Other criterion",
                  onSelect: () => handleMarkOtherCriterion(bundleItem),
                } satisfies ContextMenuEntry,
              ]
            : []),
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
              label: "Move to Reference",
              onSelect: () => handleMoveToReference(item),
            },
            {
              id: "file-archive",
              label: "Move to Archive",
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
              label: "Return to active review",
              onSelect: () => handleReturnFromReference(item),
            },
            {
              id: "reference-archive",
              label: "Move to Archive",
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
              label: "Return to bundle review",
              onSelect: () => handleReturnFromOtherBundle(item),
            },
            {
              id: "other-bundle-move",
              label: "Move to bundle",
              children: bundleChildren,
            },
            {
              id: "other-bundle-archive",
              label: "Move to Archive",
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
            label: "Accept bundle",
            onSelect: () => handleAcceptBundle(item),
          },
          {
            id: "bundle-move",
            label: "Move to bundle",
            children: bundleChildren,
          },
          {
            id: "bundle-other",
            label: "Move to Other bundle",
            onSelect: () => handleMarkOtherBundle(item),
          },
          {
            id: "bundle-reference",
            label: "Move to Reference",
            onSelect: () => handleMoveToReference(item),
          },
          {
            id: "bundle-archive",
            label: "Move to Archive",
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

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Review workflow
        </p>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          {totalTagged} tagged document(s) for {clientName}
        </h2>
        <p className="mt-2 max-w-4xl text-[12px] leading-6 text-[var(--muted)]">
          Files leave the active queue as soon as a human makes the next required decision. Setu
          keeps held-later items visible, but the page always defaults to the work that still needs
          a call today.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--foreground)]">{totalTagged}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Tagged</p>
          </div>
          <div className="rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--brand-deep)]">{fileDecisionCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--brand-deep)]">
              File decisions
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--brand-deep)]">{bundleDecisionCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--brand-deep)]">
              Bundle review
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--brand-deep)]">{criterionDecisionCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--brand-deep)]">
              Criterion review
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--state-warning)]">
              {referenceCount + otherBundleCount + otherCriterionCount}
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--state-warning)]">
              Held later
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3">
            <p className="text-[22px] font-semibold text-[var(--foreground)]">{readyCount}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Ready</p>
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
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => handleKeepFile(item)}
                      className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold text-white"
                    >
                      Keep
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
                    <button
                      type="button"
                      onClick={(event) => openDocumentMenuAtElement(item, "file", event.currentTarget)}
                      className={documentActionButtonClass()}
                    >
                      Actions
                    </button>
                  </>
                }
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
                    helperBody="Confirm the current bundle, move this file into a better bundle, or hold it in Other bundle until you decide later."
                    accentTone="muted"
                    onContextMenu={(nextItem, event) => {
                      event.preventDefault();
                      openDocumentMenu(nextItem, "bundle", event.clientX, event.clientY);
                    }}
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => handleAcceptBundle(item)}
                          className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold text-white"
                        >
                          Accept bundle
                        </button>
                        <button
                          type="button"
                          onClick={(event) => openBundlePicker(item, "bundle", event.currentTarget)}
                          className={documentActionButtonClass()}
                        >
                          Move bundle
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkOtherBundle(item)}
                          className={documentActionButtonClass()}
                        >
                          Other bundle
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
                helperText="Accept the current criterion, move the bundle into the right criterion, or park it in Other criterion for later."
                onContextMenu={(nextItem, event) => {
                  event.preventDefault();
                  openBundleActionMenu(nextItem, "criterion", event.currentTarget);
                }}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => handleAcceptCriterion(item)}
                      disabled={!resolveExistingCriterionCode(item)}
                      className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Accept criterion
                    </button>
                    <button
                      type="button"
                      onClick={(event) => openCriterionPicker(item, "criterion", event.currentTarget)}
                      className={documentActionButtonClass()}
                    >
                      Assign criterion
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkOtherCriterion(item)}
                      className={documentActionButtonClass()}
                    >
                      Other criterion
                    </button>
                    <Link
                      href={item.denseReviewHref}
                      className={documentActionButtonClass()}
                    >
                      Dense workbench
                    </Link>
                  </>
                }
              />
            ))
          ) : (
            <p className="text-[12px] leading-6 text-[var(--muted)]">
              No bundle-level criterion calls are waiting right now.
            </p>
          )}
        </CategoryBand>

        <CategoryBand
          legalCode="Hold"
          title="Review later"
          taggedCount={referenceCount + otherBundleCount + otherCriterionCount}
          decisionCount={0}
          routineCount={referenceCount + otherBundleCount + otherCriterionCount}
          note="These items were intentionally held aside. They stay visible without adding noise to the active queue."
          defaultOpen={
            referenceCount + otherBundleCount + otherCriterionCount > 0
          }
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
                Other bundle
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
                      stageLabel="Other bundle"
                      helperLabel="Why it is held"
                      helperBody="Keep this file, but do not force it into a named event until you are confident about the right bundle."
                      accentTone="warning"
                      onContextMenu={(nextItem, event) => {
                        event.preventDefault();
                        openDocumentMenu(nextItem, "other-bundle", event.clientX, event.clientY);
                      }}
                      actions={
                        <>
                          <button
                            type="button"
                            onClick={() => handleReturnFromOtherBundle(item)}
                            className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-1.5 text-[10px] font-semibold text-white"
                          >
                            Return to queue
                          </button>
                          <button
                            type="button"
                            onClick={(event) =>
                              openBundlePicker(item, "other-bundle", event.currentTarget)
                            }
                            className={documentActionButtonClass()}
                          >
                            Move bundle
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
              ))}
            </div>
          ) : null}

          {viewState.otherCriterionQueue.length ? (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Other criterion
              </p>
              {viewState.otherCriterionQueue.map((item) => (
                <WorkflowBundleCard
                  key={item.id}
                  item={item}
                  stageLabel="Other criterion"
                  helperText="This bundle stays out of the active criteria until you are ready to classify it."
                  onContextMenu={(nextItem, event) => {
                    event.preventDefault();
                    openBundleActionMenu(nextItem, "other-criterion", event.currentTarget);
                  }}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => handleReturnFromOtherCriterion(item)}
                        className="setu-primary-button inline-flex items-center rounded-[8px] px-3 py-2 text-[10px] font-semibold text-white"
                      >
                        Return to queue
                      </button>
                      <button
                        type="button"
                        onClick={(event) =>
                          openCriterionPicker(item, "other-criterion", event.currentTarget)
                        }
                        className={documentActionButtonClass()}
                      >
                        Assign criterion
                      </button>
                      <Link
                        href={item.denseReviewHref}
                        className={documentActionButtonClass()}
                      >
                        Dense workbench
                      </Link>
                    </>
                  }
                />
              ))}
            </div>
          ) : null}

          {referenceCount + otherBundleCount + otherCriterionCount === 0 ? (
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
                legalCode={band.legalCode}
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
