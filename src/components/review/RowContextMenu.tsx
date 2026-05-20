"use client";

import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import type { CriterionTagRole, EvidenceReviewStatus } from "@/lib/types";
import { ContextMenu, type ContextMenuEntry } from "@/components/common/ContextMenu";
import type { ReviewDecisionItem } from "@/components/review/DecisionRow";

export interface ReviewWorkspaceBundleOption {
  id: string;
  jobId: string;
  parentBundleId: string | null;
  name: string;
  documentCount: number;
  kind: "bundle" | "sub_bundle";
}

export interface ReviewWorkspaceContext {
  jobId: string;
  workspaceLabel: string;
  bundleOptions: ReviewWorkspaceBundleOption[];
}

interface RowContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  item: ReviewDecisionItem | null;
  criterionCounts: Record<string, number>;
  workspaceContexts: ReviewWorkspaceContext[];
  onClose: () => void;
  onKeepForCriterion: (
    item: ReviewDecisionItem,
    code: string,
    role: CriterionTagRole,
  ) => void;
  onMoveToStatus: (item: ReviewDecisionItem, status: EvidenceReviewStatus) => void;
  onReassignCriterion: (item: ReviewDecisionItem, code: string) => void;
  onMoveToBundle: (
    item: ReviewDecisionItem,
    option: ReviewWorkspaceBundleOption | { kind: "create" },
  ) => void;
  onOpenQuickPeek: (item: ReviewDecisionItem) => void;
  onShowReasoning: (item: ReviewDecisionItem) => void;
}

export function RowContextMenu({
  open,
  x,
  y,
  item,
  criterionCounts,
  workspaceContexts,
  onClose,
  onKeepForCriterion,
  onMoveToStatus,
  onReassignCriterion,
  onMoveToBundle,
  onOpenQuickPeek,
  onShowReasoning,
}: RowContextMenuProps) {
  if (!item) {
    return null;
  }

  const workspace = workspaceContexts.find((entry) => entry.jobId === item.jobId) ?? null;
  const criterionItems = EB1A_CRITERIA_DEFINITIONS.map<ContextMenuEntry>((criterion) => ({
    id: `criterion-${criterion.code}`,
    label: `${criterion.name} · ${criterionCounts[criterion.code] ?? 0} docs`,
  }));

  const keepPrimaryChildren = criterionItems.map((criterion) => ({
    ...criterion,
    onSelect: () => onKeepForCriterion(item, criterion.id.replace("criterion-", ""), "primary"),
  }));

  const keepSupportingChildren = criterionItems.map((criterion) => ({
    ...criterion,
    onSelect: () => onKeepForCriterion(item, criterion.id.replace("criterion-", ""), "supporting"),
  }));

  const reassignChildren = criterionItems.map((criterion) => ({
    ...criterion,
    disabled: criterion.id.replace("criterion-", "") === item.currentCriterionCode,
    onSelect: () => onReassignCriterion(item, criterion.id.replace("criterion-", "")),
  }));

  const bundleChildren: ContextMenuEntry[] = workspace
    ? [
        ...workspace.bundleOptions.map((option) => ({
          id: `bundle-${option.id}`,
          label: `${option.name} · ${option.documentCount} docs`,
          disabled:
            option.kind === "bundle"
              ? option.id === item.currentBundleId && item.currentParentBundleId === null
              : option.id === item.currentBundleId,
          onSelect: () => onMoveToBundle(item, option),
        })),
        {
          id: "bundle-separator",
          type: "separator" as const,
        },
        {
          id: "bundle-create",
          label: "Create new bundle",
          onSelect: () => onMoveToBundle(item, { kind: "create" }),
        },
      ]
    : [];

  const items: ContextMenuEntry[] = [
    {
      id: "keep-primary",
      label: "Keep as primary for",
      children: keepPrimaryChildren,
    },
    {
      id: "keep-supporting",
      label: "Keep as supporting for",
      children: keepSupportingChildren,
    },
    {
      id: "separator-1",
      type: "separator",
    },
    {
      id: "move-reference",
      label: "Move to Reference",
      disabled: item.reviewStatus === "reference",
      onSelect: () => onMoveToStatus(item, "reference"),
    },
    {
      id: "move-archive",
      label: "Move to Archive",
      disabled: item.reviewStatus === "archived",
      onSelect: () => onMoveToStatus(item, "archived"),
      tone: "danger",
    },
    {
      id: "separator-2",
      type: "separator",
    },
    {
      id: "reassign-criterion",
      label: "Reassign criterion",
      disabled: !item.currentCriterionCode,
      children: reassignChildren,
    },
    {
      id: "move-bundle",
      label: "Move to bundle",
      disabled: !workspace || workspace.bundleOptions.length === 0,
      children: bundleChildren,
    },
    {
      id: "separator-3",
      type: "separator",
    },
    {
      id: "quick-peek",
      label: "Open Quick peek",
      onSelect: () => onOpenQuickPeek(item),
    },
    {
      id: "show-reasoning",
      label: "Show AI reasoning",
      onSelect: () => onShowReasoning(item),
    },
  ];

  return <ContextMenu open={open} x={x} y={y} items={items} onClose={onClose} />;
}
