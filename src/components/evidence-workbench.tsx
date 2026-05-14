"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useMemo,
  useEffect,
  useDeferredValue,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Archive,
  ArrowUpRight,
  Binary,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  FileStack,
  FolderOpen,
  FolderTree,
  GripVertical,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type {
  ClientDocument,
  EventBundleKind,
  JobRecord,
  LibrarySnapshot,
  ReviewBucketKind,
  SearchResult,
  SettingsSnapshot,
  WorkspaceCriteriaTaggingState,
  WorkspaceEb1aClassificationState,
  WorkspaceEventBundleState,
} from "@/lib/types";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import { isReviewableEvidenceFile } from "@/lib/evidence-filters";
import {
  DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
  DEFAULT_SUMMARY_PROMPT_TEMPLATE,
  DEFAULT_TAGGING_PROMPT_TEMPLATE,
} from "@/lib/prompt-library";

interface EvidenceWorkbenchProps {
  initialSnapshot: LibrarySnapshot;
  pageMode?: "dashboard" | "review";
}

interface PendingFolderStats {
  fileCount: number;
  totalBytes: number;
  rootLabel: string;
  fileTypes: string[];
}

interface SettingsDraft {
  candidateName: string;
  summaryPrompt: string;
  classificationPrompt: string;
  taggingPrompt: string;
  apiKey: string;
  summaryModel: string;
  embeddingModel: string;
  embeddingDimensions: string;
  outputRootPath: string;
}

interface WorkspaceActivity {
  tone: string;
  title: string;
  detail: string;
  progress: number | null;
}

type ReviewPipelineStageStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

interface ReviewPipelineStage {
  id: string;
  label: string;
  status: ReviewPipelineStageStatus;
  detail: string;
  progress: number | null;
}

interface ReviewPipeline {
  overallProgress: number;
  currentStageLabel: string;
  stages: ReviewPipelineStage[];
}

interface VisibleEventBundle {
  id: string;
  bundleKind: EventBundleKind;
  name: string;
  shortSummary: string;
  detailedSummary: string;
  eventType: string;
  latestRelevantDate: string | null;
  timeframeLabel: string;
  location: string;
  organizations: string[];
  people: string[];
  keywords: string[];
  confidence: number;
  leadDocumentId: string | null;
  evidenceDocuments: ClientDocument[];
}

interface VisibleReviewBucket {
  bucketCode: string;
  bucketName: string;
  bucketKind: ReviewBucketKind;
  folderName: string;
  bundles: VisibleEventBundle[];
  fileCount: number;
}

type DragState =
  | {
      type: "bundle";
      bundleId: string;
      sourceBucketCode: string;
    }
  | {
      type: "document";
      documentId: string;
      sourceBundleId: string;
    };

type DocumentReviewAction = "keep" | "archive" | "unwanted";
type EvidenceStatusFilter = "all" | "kept" | "pending" | "archived";
type ReadyViewMode = "by-bundle" | "by-criterion";
type PeekTab = "summary" | "criteria" | "citations" | "notes";

type ResizablePanel = "left" | "right";

interface ReviewSubBundleView {
  id: string;
  name: string;
  documents: ClientDocument[];
}

interface ReviewBundleView extends VisibleEventBundle {
  rootDocuments: ClientDocument[];
  subBundles: ReviewSubBundleView[];
  filteredDocuments: ClientDocument[];
}

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  mode:
    | "evidence-single"
    | "evidence-multi"
    | "bundle"
    | "criterion"
    | null;
  documentIds: string[];
  bundleId: string | null;
  criterionCode: string | null;
  submenu: "criterion" | "bundle" | null;
}

interface ContextMenuLayout {
  left: number;
  top: number;
  submenuDirection: "left" | "right";
  criterionTop: number;
  bundleTop: number;
}

interface ReviewBucketTone {
  card: string;
  badge: string;
  accentBar: string;
}

const REVIEW_BUCKET_TONES: Record<string, ReviewBucketTone> = {
  "01": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#fff0f7] text-[#b24376]",
    accentBar: "bg-[#d96da1]",
  },
  "02": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#e8faf5] text-[#187a68]",
    accentBar: "bg-[#33b69b]",
  },
  "03": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#edf3ff] text-[#3f63c9]",
    accentBar: "bg-[#6c8ff1]",
  },
  "04": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#f0ebff] text-[#6a4dd2]",
    accentBar: "bg-[#8a6ee5]",
  },
  "05": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#eafaf0] text-[#23784b]",
    accentBar: "bg-[#41af68]",
  },
  "06": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#ebf4ff] text-[#2c69b6]",
    accentBar: "bg-[#5592de]",
  },
  "07": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#fff1e8] text-[#b7642f]",
    accentBar: "bg-[#eb8d4d]",
  },
  "08": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#fff3df] text-[#9a6415]",
    accentBar: "bg-[#d59a3c]",
  },
  "09": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#eef9e8] text-[#4d8635]",
    accentBar: "bg-[#7cba56]",
  },
  "10": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#e8f7f7] text-[#246f77]",
    accentBar: "bg-[#3ca6b1]",
  },
  "11": {
    card: "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#eef1f7] text-[#58627f]",
    accentBar: "bg-[#7a86a8]",
  },
  ARCHIVE: {
    card: "border-slate-200 bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-slate-100 text-slate-700",
    accentBar: "bg-slate-500",
  },
  UNWANTED: {
    card: "border-rose-200 bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#fff1f3] text-[#be445d]",
    accentBar: "bg-[#e36b86]",
  },
  REVIEW: {
    card: "border-amber-200 bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
    badge: "bg-[#fff4df] text-[#a56b11]",
    accentBar: "bg-[#e0a43f]",
  },
};

const CONTEXT_MENU_VIEWPORT_PADDING = 12;
const CONTEXT_SUBMENU_GAP = 4;
const CONTEXT_SUBMENU_WIDTH = 250;
const DASHBOARD_LEFT_PANEL_DEFAULT_WIDTH = 268;
const REVIEW_LEFT_PANEL_DEFAULT_WIDTH = 232;
const REVIEW_RIGHT_PANEL_DEFAULT_WIDTH = 296;
const LEFT_PANEL_MIN_WIDTH = 220;
const LEFT_PANEL_MAX_WIDTH = 420;
const RIGHT_PANEL_MIN_WIDTH = 248;
const RIGHT_PANEL_MAX_WIDTH = 420;

const HIERARCHY_TONES = {
  criteria: "border border-slate-200 bg-slate-50 text-slate-700",
  bundle: "border border-slate-200 bg-slate-50 text-slate-700",
  evidence: "border border-slate-200 bg-slate-50 text-slate-700",
} as const;

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatElapsedTime(startValue: string | null, endValue?: string | null) {
  if (!startValue) {
    return "Not started";
  }

  const start = new Date(startValue).getTime();
  const end = endValue ? new Date(endValue).getTime() : Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "Not started";
  }

  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getJobLastRunAt(job: JobRecord) {
  return job.completedAt || job.startedAt || job.createdAt;
}

function formatJobHistoryLabel(job: JobRecord) {
  return `${job.folderLabel} · ${formatDateTime(getJobLastRunAt(job))}`;
}

function jobStatusBadgeClassName(status: JobRecord["status"]) {
  if (status === "completed") {
    return "bg-[var(--brand-soft)] text-[var(--brand-deep)]";
  }

  if (status === "completed_with_errors") {
    return "bg-[var(--state-warning-soft)] text-[var(--state-warning)]";
  }

  if (status === "failed" || status === "canceled") {
    return "bg-[var(--state-danger-soft)] text-[var(--state-danger)]";
  }

  if (status === "processing" || status === "queued" || status === "canceling") {
    return "bg-[var(--state-info-soft)] text-[var(--state-info)]";
  }

  return "bg-[var(--paper-secondary)] text-[var(--ink-secondary)]";
}

function formatPrimaryDate(value: string | null | undefined) {
  if (!value) {
    return "No dated event";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Untracked";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

function isActiveJob(status: JobRecord["status"]) {
  return status === "queued" || status === "processing" || status === "canceling";
}

function summarizeFolder(files: File[]): PendingFolderStats {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const rootLabel =
    files[0]?.webkitRelativePath.split("/").filter(Boolean)[0] || "Evidence folder";
  const fileTypes = Array.from(
    new Set(
      files.map((file) => {
        const extension = file.name.split(".").pop();
        return extension ? extension.toUpperCase() : "FILE";
      }),
    ),
  ).slice(0, 10);

  return {
    fileCount: files.length,
    totalBytes,
    rootLabel,
    fileTypes,
  };
}

function statusTone(status: JobRecord["status"]) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "completed_with_errors") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "canceling") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "canceled") {
    return "bg-slate-100 text-slate-700";
  }

  if (status === "failed") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-sky-50 text-sky-700";
}

function documentStatusTone(status: ClientDocument["processingStatus"]) {
  if (status === "completed") {
    return "bg-[var(--brand-soft)] text-[var(--brand-deep)]";
  }

  if (status === "failed") {
    return "bg-[var(--state-danger-soft)] text-[var(--state-danger)]";
  }

  if (status === "processing") {
    return "bg-[var(--state-info-soft)] text-[var(--state-info)]";
  }

  return "bg-[var(--paper-secondary)] text-[var(--ink-tertiary)]";
}

function reviewStatusTone(status: ClientDocument["reviewStatus"]) {
  if (status === "archived") {
    return "bg-[var(--paper-secondary)] text-[var(--ink-secondary)]";
  }

  if (status === "pending") {
    return "bg-[var(--state-warning-soft)] text-[var(--state-warning)]";
  }

  return "bg-[var(--brand-soft)] text-[var(--brand-deep)]";
}

function confidenceBand(confidence: number) {
  if (confidence >= 0.75) {
    return "high";
  }

  if (confidence >= 0.55) {
    return "medium";
  }

  return "low";
}

function criterionChipTone(role: "primary" | "supporting", source: "ai" | "manual") {
  if (source === "manual") {
    return role === "primary"
      ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
      : "border-[var(--border-primary)] bg-[var(--paper-secondary)] text-[var(--ink-secondary)]";
  }

  return role === "primary"
    ? "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-white"
    : "border-[var(--border-primary)] bg-[var(--paper-secondary)] text-[var(--ink-secondary)]";
}

function filterDocumentByReviewState(
  document: ClientDocument,
  input: {
    statusFilter: EvidenceStatusFilter;
    criterionFilter: string | null;
  },
) {
  if (input.statusFilter !== "all" && document.reviewStatus !== input.statusFilter) {
    return false;
  }

  if (
    input.criterionFilter &&
    !document.criteriaTags.some((criterion) => criterion.code === input.criterionFilter)
  ) {
    return false;
  }

  return true;
}

function buildReviewBundleViews(input: {
  bundles: VisibleEventBundle[];
  reviewState: LibrarySnapshot["reviewState"];
  statusFilter: EvidenceStatusFilter;
  criterionFilter: string | null;
}) {
  const subBundleLookup = new Map<string, ReviewSubBundleView[]>();

  input.reviewState?.subBundles.forEach((subBundle) => {
    const bundle = input.bundles.find((entry) => entry.id === subBundle.parentBundleId);

    if (!bundle) {
      return;
    }

    const documents = subBundle.evidenceDocumentIds
      .map((documentId) =>
        bundle.evidenceDocuments.find((document) => document.id === documentId) ?? null,
      )
      .filter((document): document is ClientDocument => Boolean(document))
      .filter((document) =>
        filterDocumentByReviewState(document, {
          statusFilter: input.statusFilter,
          criterionFilter: input.criterionFilter,
        }),
      );

    if (!documents.length) {
      return;
    }

    const existing = subBundleLookup.get(subBundle.parentBundleId) ?? [];
    existing.push({
      id: subBundle.id,
      name: subBundle.name,
      documents,
    });
    subBundleLookup.set(subBundle.parentBundleId, existing);
  });

  return input.bundles
    .map((bundle) => {
      const filteredDocuments = bundle.evidenceDocuments.filter((document) =>
        filterDocumentByReviewState(document, {
          statusFilter: input.statusFilter,
          criterionFilter: input.criterionFilter,
        }),
      );
      const subBundles = subBundleLookup.get(bundle.id) ?? [];
      const subBundleDocumentIds = new Set(
        subBundles.flatMap((subBundle) => subBundle.documents.map((document) => document.id)),
      );
      const rootDocuments = filteredDocuments.filter(
        (document) => !subBundleDocumentIds.has(document.id),
      );

      return {
        ...bundle,
        rootDocuments,
        subBundles,
        filteredDocuments,
      } satisfies ReviewBundleView;
    })
    .filter((bundle) => bundle.filteredDocuments.length > 0);
}

function buildCriterionBucketViews(input: {
  reviewBuckets: VisibleReviewBucket[];
  reviewBundles: ReviewBundleView[];
  criterionFilter: string | null;
}) {
  const bundleLookup = new Map(input.reviewBundles.map((bundle) => [bundle.id, bundle]));

  return input.reviewBuckets
    .filter((bucket) =>
      input.criterionFilter ? bucket.bucketCode === input.criterionFilter : true,
    )
    .map((bucket) => {
      const bundles = bucket.bundles
        .map((bundle) => bundleLookup.get(bundle.id))
        .filter((bundle): bundle is ReviewBundleView => Boolean(bundle))
        .filter((bundle) => bundle.filteredDocuments.length > 0);

      return {
        ...bucket,
        bundles,
        fileCount: bundles.reduce((count, bundle) => count + bundle.filteredDocuments.length, 0),
      };
    })
    .filter((bucket) => bucket.bundles.length > 0);
}

function buildSettingsDraft(settings: SettingsSnapshot): SettingsDraft {
  return {
    candidateName: settings.candidateName,
    summaryPrompt: settings.summaryPrompt,
    classificationPrompt: settings.classificationPrompt,
    taggingPrompt: settings.taggingPrompt,
    apiKey: "",
    summaryModel: settings.summaryModel,
    embeddingModel: settings.embeddingModel,
    embeddingDimensions: String(settings.embeddingDimensions),
    outputRootPath: settings.outputRootPath,
  };
}

async function requestLibrarySnapshot(jobId?: string | null) {
  const searchParams = new URLSearchParams();

  if (jobId) {
    searchParams.set("jobId", jobId);
  }

  const response = await fetch(`/api/library${searchParams.toString() ? `?${searchParams.toString()}` : ""}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as LibrarySnapshot;
}

function getDocumentScore(document: ClientDocument) {
  return typeof (document as SearchResult).score === "number"
    ? (document as SearchResult).score
    : null;
}

function getDocumentCandidate(document: ClientDocument, fallbackCandidate: string) {
  return document.candidateName.trim() || fallbackCandidate.trim() || "Candidate not set";
}

function compactList(values: string[] | undefined, limit: number) {
  const safeValues = (values ?? []).filter(Boolean);

  if (safeValues.length <= limit) {
    return safeValues;
  }

  return [...safeValues.slice(0, limit), `+${safeValues.length - limit}`];
}

function metricValueClassName() {
  return "mt-1 text-lg font-semibold tracking-tight text-[var(--foreground)]";
}

function evidenceActionButtonClassName(
  tone: "preview" | "keep" | "archive" | "unwanted",
  active = false,
  disabled = false,
) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition";

  if (disabled) {
    return `${base} cursor-not-allowed border-[var(--border-secondary)] bg-[var(--paper-secondary)] text-[var(--ink-tertiary)]`;
  }

  if (tone === "preview") {
    return active
      ? `${base} border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]`
      : `${base} border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--foreground)] hover:bg-[var(--paper-secondary)]`;
  }

  if (tone === "keep") {
    return active
      ? `${base} border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]`
      : `${base} border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--foreground)] hover:bg-[var(--brand-soft)]`;
  }

  if (tone === "archive") {
    return active
      ? `${base} border-[var(--border-primary)] bg-[var(--paper-secondary)] text-[var(--ink-secondary)]`
      : `${base} border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--foreground)] hover:bg-[var(--paper-secondary)]`;
  }

  return active
    ? `${base} border-[var(--state-danger)] bg-[var(--state-danger-soft)] text-[var(--state-danger)]`
    : `${base} border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--foreground)] hover:bg-[var(--state-danger-soft)]`;
}

function truncateText(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return "";
  }

  return value.length <= maxLength ? value : `${value.slice(0, maxLength).trim()}...`;
}

function eventBundleMatchesFilter(bundle: VisibleEventBundle, filter: string) {
  if (!filter) {
    return true;
  }

  const haystack = [
    bundle.name,
    bundle.shortSummary,
    bundle.detailedSummary,
    bundle.eventType,
    bundle.timeframeLabel,
    bundle.location,
    bundle.organizations.join(" "),
    bundle.people.join(" "),
    bundle.keywords.join(" "),
    ...bundle.evidenceDocuments.flatMap((document) => [
      document.fileName,
      document.relativePath,
      document.summary?.title ?? "",
      document.summary?.shortSummary ?? "",
      document.summary?.documentType ?? "",
      document.summary?.tags.join(" ") ?? "",
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(filter.toLowerCase());
}

function documentMatchesFilter(document: ClientDocument, filter: string) {
  if (!filter) {
    return true;
  }

  const haystack = [
    document.fileName,
    document.relativePath,
    document.processingStatus,
    document.summary?.title ?? "",
    document.summary?.shortSummary ?? "",
    document.summary?.detailedSummary ?? "",
    document.summary?.documentType ?? "",
    document.summary?.tags.join(" ") ?? "",
    document.summary?.organizations.join(" ") ?? "",
    document.summary?.people.join(" ") ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(filter.toLowerCase());
}

function buildVisibleEventBundles(input: {
  bundleState: WorkspaceEventBundleState | null;
  documents: ClientDocument[];
  filter: string;
  semanticResultIds: Set<string> | null;
}) {
  if (!input.bundleState) {
    return [];
  }

  const documentLookup = new Map(input.documents.map((document) => [document.id, document]));

  return input.bundleState.bundles
    .map((bundle) => {
      const evidenceDocuments = bundle.evidenceDocumentIds
        .map((documentId) => documentLookup.get(documentId))
        .filter((document): document is ClientDocument => Boolean(document));

      return {
        ...bundle,
        evidenceDocuments,
      } satisfies VisibleEventBundle;
    })
    .filter((bundle) => bundle.evidenceDocuments.length > 0)
    .filter((bundle) => {
      if (input.semanticResultIds && !bundle.evidenceDocuments.some((document) => input.semanticResultIds?.has(document.id))) {
        return false;
      }

      return eventBundleMatchesFilter(bundle, input.filter);
    });
}

function buildVisibleDocuments(input: {
  documents: ClientDocument[];
  filter: string;
  semanticResultIds: Set<string> | null;
}) {
  return [...input.documents]
    .filter((document) => isReviewableEvidenceFile(document))
    .filter((document) => {
      if (input.semanticResultIds && !input.semanticResultIds.has(document.id)) {
        return false;
      }

      return documentMatchesFilter(document, input.filter);
    })
    .sort((left, right) => {
      const leftPrimaryDate = left.summary?.primaryDate ?? null;
      const rightPrimaryDate = right.summary?.primaryDate ?? null;

      if (leftPrimaryDate && rightPrimaryDate) {
        const dateSort = rightPrimaryDate.localeCompare(leftPrimaryDate);

        if (dateSort !== 0) {
          return dateSort;
        }
      } else if (leftPrimaryDate) {
        return -1;
      } else if (rightPrimaryDate) {
        return 1;
      }

      return right.updatedAt.localeCompare(left.updatedAt) || left.fileName.localeCompare(right.fileName);
    });
}

function buildCriterionDecisionLookup(
  classification: WorkspaceEb1aClassificationState | null,
) {
  return new Map(
    (classification?.decisions ?? []).map((decision) => [decision.bundleId, decision]),
  );
}

function buildCriterionSummary(
  classification: WorkspaceEb1aClassificationState | null,
) {
  if (!classification || classification.status !== "completed") {
    return [];
  }

  return classification.buckets
    .filter((bucket) => bucket.bucketKind === "criterion")
    .map((bucket) => ({
      code: bucket.criterionCode,
      name: bucket.criterionName,
      count: bucket.bundleIds.length,
    }))
    .filter((bucket) => bucket.count > 0);
}

function buildVisibleReviewBuckets(
  bundles: VisibleEventBundle[],
  classification: WorkspaceEb1aClassificationState | null,
) {
  if (!classification || classification.status !== "completed") {
    return [];
  }

  const bundleLookup = new Map(bundles.map((bundle) => [bundle.id, bundle]));

  return classification.buckets
    .map((bucket) => {
      const bucketBundles = bucket.bundleIds
        .map((bundleId) => bundleLookup.get(bundleId))
        .filter((bundle): bundle is VisibleEventBundle => Boolean(bundle));

      return {
        bucketCode: bucket.criterionCode,
        bucketName: bucket.criterionName,
        bucketKind: bucket.bucketKind,
        folderName: bucket.folderName,
        bundles: bucketBundles,
        fileCount: bucketBundles.reduce(
          (count, bundle) => count + bundle.evidenceDocuments.length,
          0,
        ),
      } satisfies VisibleReviewBucket;
    })
    .filter((bucket) => bucket.bundles.length > 0);
}

function countManualCategoryOverrides(snapshot: LibrarySnapshot) {
  return Object.keys(snapshot.manualOverrides?.categoryOverrides ?? {}).length;
}

function countManualEventOverrides(snapshot: LibrarySnapshot) {
  return Object.keys(snapshot.manualOverrides?.documentEventOverrides ?? {}).length;
}

function hasManualCategoryOverride(snapshot: LibrarySnapshot, bundleId: string) {
  return Boolean(snapshot.manualOverrides?.categoryOverrides?.[bundleId]);
}

function hasManualEventOverride(snapshot: LibrarySnapshot, documentId: string) {
  return Boolean(snapshot.manualOverrides?.documentEventOverrides?.[documentId]);
}

function getDocumentReviewAction(
  snapshot: LibrarySnapshot,
  documentId: string,
  bundleKind: EventBundleKind | null | undefined,
): DocumentReviewAction {
  const override = snapshot.manualOverrides?.documentDispositionOverrides?.[documentId];

  if (override === "archive" || override === "unwanted") {
    return override;
  }

  if (bundleKind === "archive") {
    return "archive";
  }

  if (bundleKind === "unwanted") {
    return "unwanted";
  }

  return "keep";
}

function countBundlesByDisposition(
  classification: WorkspaceEb1aClassificationState | null,
  disposition: "classified" | "unclassified" | "archive" | "unwanted",
) {
  if (!classification || classification.status !== "completed") {
    return 0;
  }

  return classification.decisions.filter(
    (decision) => decision.reviewDisposition === disposition,
  ).length;
}

function getReviewBucketTone(bucketCode: string, bucketKind: ReviewBucketKind) {
  if (REVIEW_BUCKET_TONES[bucketCode]) {
    return REVIEW_BUCKET_TONES[bucketCode];
  }

  if (bucketKind === "archive") {
    return REVIEW_BUCKET_TONES.ARCHIVE;
  }

  if (bucketKind === "unwanted") {
    return REVIEW_BUCKET_TONES.UNWANTED;
  }

  if (bucketKind === "human_review") {
    return REVIEW_BUCKET_TONES.REVIEW;
  }

  return REVIEW_BUCKET_TONES["04"];
}

function decisionBadgeClassName(bucketCode: string, bucketKind: ReviewBucketKind) {
  return getReviewBucketTone(bucketCode, bucketKind).badge;
}

function decisionBucketLabel(
  classification: WorkspaceEb1aClassificationState["decisions"][number] | null,
) {
  if (!classification) {
    return null;
  }

  return classification.reviewDisposition === "classified" &&
    classification.primaryCriterionCode &&
    classification.primaryCriterionName
    ? `${classification.primaryCriterionCode} · ${classification.primaryCriterionName}`
    : classification.bucketName;
}

function reviewBucketCardClassName(bucketCode: string, bucketKind: ReviewBucketKind) {
  return getReviewBucketTone(bucketCode, bucketKind).card;
}

function reviewBucketAccentBarClassName(bucketCode: string, bucketKind: ReviewBucketKind) {
  return getReviewBucketTone(bucketCode, bucketKind).accentBar;
}

function hierarchyBadgeClassName(level: keyof typeof HIERARCHY_TONES) {
  return HIERARCHY_TONES[level];
}

function bundleCardClassName(
  bundleKind: EventBundleKind,
  isDropTarget: boolean,
) {
  const baseClassName =
    bundleKind === "archive"
      ? "border-slate-200 bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
      : bundleKind === "unwanted"
        ? "border-rose-200 bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
        : "border-[#e6e9f2] bg-white/96 shadow-[0_12px_28px_rgba(15,23,42,0.04)]";

  return `${baseClassName} ${isDropTarget ? "ring-2 ring-[var(--brand)]/35" : ""}`;
}

function bundleMetadataCardClassName(bundleKind: EventBundleKind) {
  if (bundleKind === "archive") {
    return "border-slate-200 bg-slate-50/90";
  }

  if (bundleKind === "unwanted") {
    return "border-rose-200 bg-rose-50/90";
  }

  return "border-[#e6e9f2] bg-slate-50/90";
}

function evidenceRowClassName(selected: boolean) {
  if (selected) {
    return "setu-selected-row border-[var(--brand)]/18 bg-[var(--paper-secondary)]";
  }

  return "border-[var(--border-secondary)] bg-[var(--paper-primary)] hover:bg-[var(--paper-secondary)]";
}

function evidenceTableRowClassName(selected: boolean) {
  return selected
    ? "setu-selected-row bg-[var(--paper-secondary)]"
    : "bg-[var(--paper-primary)] hover:bg-[var(--paper-secondary)]";
}

function findBundleDecision(
  bundleId: string,
  classification: WorkspaceEb1aClassificationState | null,
) {
  return classification?.decisions.find((decision) => decision.bundleId === bundleId) ?? null;
}

function getJobProgress(job: JobRecord | null) {
  if (!job || job.totalFiles <= 0) {
    return 0;
  }

  return Math.min((job.processedFiles / job.totalFiles) * 100, 100);
}

function stageStatusLabel(status: ReviewPipelineStageStatus) {
  if (status === "completed") {
    return "Done";
  }

  if (status === "processing") {
    return "In progress";
  }

  if (status === "queued") {
    return "Queued";
  }

  if (status === "failed") {
    return "Needs attention";
  }

  return "Waiting";
}

function stageStatusClassName(status: ReviewPipelineStageStatus) {
  if (status === "completed") {
    return "bg-[var(--brand-charcoal)] text-white";
  }

  if (status === "processing" || status === "queued") {
    return "bg-[var(--paper-secondary)] text-[var(--ink-secondary)]";
  }

  if (status === "failed") {
    return "bg-[var(--state-danger-soft)] text-[var(--state-danger)]";
  }

  return "bg-[var(--paper-secondary)] text-[var(--ink-tertiary)]";
}

function normalizeBundlingStatus(
  status: WorkspaceEventBundleState["status"] | null | undefined,
): ReviewPipelineStageStatus {
  if (!status || status === "idle") {
    return "pending";
  }

  if (status === "canceled") {
    return "failed";
  }

  return status;
}

function buildReviewPipeline(input: {
  activeJob: JobRecord | null;
  eventBundles: WorkspaceEventBundleState | null;
  eb1aClassification: WorkspaceEb1aClassificationState | null;
  criteriaTagging: WorkspaceCriteriaTaggingState | null;
  pendingStats: PendingFolderStats | null;
  isUploading: boolean;
}) : ReviewPipeline {
  if (input.isUploading && input.pendingStats) {
    return {
      overallProgress: 5,
      currentStageLabel: "Indexing documents",
      stages: [
        {
          id: "indexing",
          label: "Indexing documents",
          status: "processing",
          detail: `Uploading ${input.pendingStats.fileCount} file(s) from ${input.pendingStats.rootLabel} and creating the isolated workspace.`,
          progress: 5,
        },
        {
          id: "bundling",
          label: "Bundling events",
          status: "pending",
          detail: "This starts after document summaries finish.",
          progress: null,
        },
        {
          id: "classification",
          label: "Classifying EB1A",
          status: "pending",
          detail: "This starts after event bundling finishes.",
          progress: null,
        },
        {
          id: "tagging",
          label: "Tagging evidence",
          status: "pending",
          detail: "Document-level evidence tagging starts after EB1A classification finishes.",
          progress: null,
        },
        {
          id: "review",
          label: "Ready to review",
          status: "pending",
          detail: "The full review surface unlocks after indexing, bundling, classification, and evidence tagging complete.",
          progress: null,
        },
      ],
    };
  }

  if (input.pendingStats) {
    return {
      overallProgress: 0,
      currentStageLabel: "Waiting to index",
      stages: [
        {
          id: "indexing",
          label: "Indexing documents",
          status: "pending",
          detail: `${input.pendingStats.fileCount} file(s) are selected and ready for indexing.`,
          progress: null,
        },
        {
          id: "bundling",
          label: "Bundling events",
          status: "pending",
          detail: "AI event bundling begins only after document indexing finishes.",
          progress: null,
        },
        {
          id: "classification",
          label: "Classifying EB1A",
          status: "pending",
          detail: "This starts after event bundling finishes.",
          progress: null,
        },
        {
          id: "tagging",
          label: "Tagging evidence",
          status: "pending",
          detail: "Document-level evidence tagging starts after EB1A classification finishes.",
          progress: null,
        },
        {
          id: "review",
          label: "Ready to review",
          status: "pending",
          detail: "Choose Index Folder to start the full pipeline.",
          progress: null,
        },
      ],
    };
  }

  if (!input.activeJob) {
    return {
      overallProgress: 0,
      currentStageLabel: "No active folder",
      stages: [
        {
          id: "indexing",
          label: "Indexing documents",
          status: "pending",
          detail: "Select a folder workspace or upload a new one to begin.",
          progress: null,
        },
        {
          id: "bundling",
          label: "Bundling events",
          status: "pending",
          detail: "Bundling is not available until indexing has produced summaries.",
          progress: null,
        },
        {
          id: "classification",
          label: "Classifying EB1A",
          status: "pending",
          detail: "Classification is not available until event bundling has produced completed bundles.",
          progress: null,
        },
        {
          id: "tagging",
          label: "Tagging evidence",
          status: "pending",
          detail: "Evidence tagging is not available until EB1A classification completes.",
          progress: null,
        },
        {
          id: "review",
          label: "Ready to review",
          status: "pending",
          detail: "Review becomes available after the full pipeline completes.",
          progress: null,
        },
      ],
    };
  }

  const indexProgress = Math.round(getJobProgress(input.activeJob));
  const bundlingStatus = normalizeBundlingStatus(input.eventBundles?.status);
  const indexingComplete =
    input.activeJob.status === "completed" || input.activeJob.status === "completed_with_errors";
  const indexingFailed =
    input.activeJob.status === "failed" || input.activeJob.status === "canceled";
  const classificationStatus = normalizeBundlingStatus(input.eb1aClassification?.status);
  const taggingStatus = normalizeBundlingStatus(input.criteriaTagging?.status);

  const indexingStage: ReviewPipelineStage = {
    id: "indexing",
    label: "Indexing documents",
    status: indexingFailed
      ? "failed"
      : input.activeJob.status === "canceling"
        ? "processing"
      : input.activeJob.status === "queued"
        ? "queued"
        : input.activeJob.status === "processing"
          ? "processing"
          : "completed",
    detail: indexingFailed
      ? input.activeJob.error || `Indexing stopped for ${input.activeJob.folderLabel}.`
      : input.activeJob.status === "canceling"
        ? `Cancellation was requested for ${input.activeJob.folderLabel}. The current file will stop before the next pipeline step begins.`
      : input.activeJob.status === "queued"
        ? `${input.activeJob.folderLabel} is queued and waiting for parsing to begin.`
        : input.activeJob.status === "processing"
          ? `${input.activeJob.processedFiles} of ${input.activeJob.totalFiles} file(s) processed.${input.activeJob.failedFiles ? ` ${input.activeJob.failedFiles} file(s) have already failed.` : ""}`
          : `${input.activeJob.processedFiles} of ${input.activeJob.totalFiles} file(s) finished indexing.${input.activeJob.failedFiles ? ` ${input.activeJob.failedFiles} file(s) need follow-up.` : ""}`,
    progress:
      input.activeJob.status === "processing" ||
      input.activeJob.status === "canceling" ||
      indexingComplete
        ? indexProgress
        : null,
  };

  const bundlingStage: ReviewPipelineStage = indexingFailed
    ? {
        id: "bundling",
        label: "Bundling events",
        status: "pending",
        detail: "Bundling cannot start until document indexing completes successfully.",
        progress: null,
      }
    : !indexingComplete
      ? {
          id: "bundling",
          label: "Bundling events",
          status: "pending",
          detail: "Bundling is waiting for document summaries from the indexing pass.",
          progress: null,
        }
      : {
          id: "bundling",
          label: "Bundling events",
          status: bundlingStatus,
          detail:
            bundlingStatus === "queued"
              ? "Document summaries are ready. Event bundling is queued next."
              : bundlingStatus === "processing"
                ? input.eventBundles?.message ||
                  "AI is grouping evidence into event-level bundles now."
                : bundlingStatus === "failed"
                  ? input.eventBundles?.error ||
                    "Event bundling did not complete for this folder workspace."
                  : input.eventBundles?.message ||
                    "Event bundles are ready for review.",
          progress:
            bundlingStatus === "completed"
              ? 100
              : bundlingStatus === "processing"
                ? 65
                : bundlingStatus === "queued"
                  ? 5
                : null,
        };

  const classificationStage: ReviewPipelineStage =
    indexingFailed
      ? {
          id: "classification",
          label: "Classifying EB1A",
          status: "pending",
          detail: "EB1A classification cannot start until indexing finishes successfully.",
          progress: null,
        }
      : bundlingStatus !== "completed"
        ? {
            id: "classification",
            label: "Classifying EB1A",
            status: "pending",
            detail: "EB1A classification is waiting for completed event bundles.",
            progress: null,
          }
        : {
            id: "classification",
            label: "Classifying EB1A",
            status: classificationStatus,
            detail:
              classificationStatus === "queued"
                ? "Event bundles are ready. EB1A classification is queued next."
                : classificationStatus === "processing"
                  ? input.eb1aClassification?.message ||
                    "AI is assigning event bundles to EB1A criteria and preparing the output package."
                  : classificationStatus === "failed"
                    ? input.eb1aClassification?.error ||
                      "The EB1A classification pass did not complete for this workspace."
                    : input.eb1aClassification?.message ||
                      "EB1A classification and output packaging are ready for review.",
            progress:
              classificationStatus === "completed"
                ? 100
                : classificationStatus === "processing"
                  ? 68
                  : classificationStatus === "queued"
                    ? 8
                    : null,
          };

  const taggingStage: ReviewPipelineStage =
    indexingFailed
      ? {
          id: "tagging",
          label: "Tagging evidence",
          status: "pending",
          detail: "Evidence tagging cannot start until indexing finishes successfully.",
          progress: null,
        }
      : classificationStatus !== "completed"
        ? {
            id: "tagging",
            label: "Tagging evidence",
            status: "pending",
            detail: "Document-level evidence tagging is waiting for completed EB1A classification.",
            progress: null,
          }
        : {
            id: "tagging",
            label: "Tagging evidence",
            status: taggingStatus,
            detail:
              taggingStatus === "queued"
                ? "Bundle classification is ready. Evidence tagging is queued next."
                : taggingStatus === "processing"
                  ? input.criteriaTagging?.message ||
                    "AI is tagging individual evidence files with keep/archive hints and criterion suggestions."
                  : taggingStatus === "failed"
                    ? input.criteriaTagging?.error ||
                      "The evidence tagging pass did not complete for this workspace."
                    : input.criteriaTagging?.message ||
                      "Document-level evidence tagging is complete.",
            progress:
              taggingStatus === "completed"
                ? 100
                : taggingStatus === "processing"
                  ? 72
                  : taggingStatus === "queued"
                    ? 10
                    : null,
          };

  const reviewStage: ReviewPipelineStage =
    indexingFailed
      ? {
          id: "review",
          label: "Ready to review",
          status: "failed",
          detail: "Review is blocked because indexing did not finish.",
          progress: null,
        }
      : indexingComplete &&
          bundlingStatus === "completed" &&
          classificationStatus === "completed" &&
          taggingStatus === "completed"
        ? {
            id: "review",
            label: "Ready to review",
            status: "completed",
            detail: "Bundle review, EB1A category review, document-level triage, and output-package review are all unlocked for this folder workspace.",
            progress: 100,
          }
        : taggingStatus === "failed"
          ? {
              id: "review",
              label: "Ready to review",
              status: "failed",
              detail: "Event and EB1A review are available, but evidence tagging needs another pass.",
              progress: null,
            }
        : classificationStatus === "failed"
          ? {
              id: "review",
              label: "Ready to review",
              status: "failed",
              detail: "Event review is available, but EB1A classification and output packaging need another pass.",
              progress: null,
            }
        : bundlingStatus === "failed"
          ? {
              id: "review",
              label: "Ready to review",
              status: "failed",
              detail: "Document review is available, but bundle-level review needs another bundling run.",
              progress: null,
            }
          : {
              id: "review",
              label: "Ready to review",
              status: "pending",
              detail: indexingComplete
                ? classificationStatus === "completed"
                  ? "Event bundles and criteria are ready. The workspace unlocks fully as soon as evidence tagging finishes."
                  : bundlingStatus === "completed"
                    ? "Event bundles can already be reviewed while EB1A classification finishes."
                    : "Completed documents can already be opened while the bundle map finishes."
                : "Completed documents will appear here as soon as indexing starts producing summaries.",
              progress: null,
            };

  let overallProgress = 0;

  if (input.activeJob.status === "queued") {
    overallProgress = 8;
  } else if (
    input.activeJob.status === "processing" ||
    input.activeJob.status === "canceling"
  ) {
    overallProgress = Math.min(70, 10 + indexProgress * 0.6);
  } else if (indexingComplete) {
    if (bundlingStatus === "queued") {
      overallProgress = 76;
    } else if (bundlingStatus === "processing") {
      overallProgress = 88;
    } else if (bundlingStatus === "completed" && classificationStatus === "queued") {
      overallProgress = 91;
    } else if (bundlingStatus === "completed" && classificationStatus === "processing") {
      overallProgress = 96;
    } else if (
      bundlingStatus === "completed" &&
      classificationStatus === "completed" &&
      taggingStatus === "queued"
    ) {
      overallProgress = 97;
    } else if (
      bundlingStatus === "completed" &&
      classificationStatus === "completed" &&
      taggingStatus === "processing"
    ) {
      overallProgress = 99;
    } else if (
      bundlingStatus === "completed" &&
      classificationStatus === "completed" &&
      taggingStatus === "completed"
    ) {
      overallProgress = 100;
    } else if (
      bundlingStatus === "completed" &&
      classificationStatus === "completed" &&
      taggingStatus === "failed"
    ) {
      overallProgress = 97;
    } else if (bundlingStatus === "completed" && classificationStatus === "failed") {
      overallProgress = 94;
    } else if (bundlingStatus === "failed") {
      overallProgress = 84;
    } else {
      overallProgress = 72;
    }
  }

  const activeStage =
    [indexingStage, bundlingStage, classificationStage, taggingStage, reviewStage].find((stage) =>
      stage.status === "processing" || stage.status === "queued" || stage.status === "failed",
    ) ??
    reviewStage;

  return {
    overallProgress,
    currentStageLabel: `${activeStage.label} • ${stageStatusLabel(activeStage.status)}`,
    stages: [indexingStage, bundlingStage, classificationStage, taggingStage, reviewStage],
  };
}

function buildWorkspaceActivity(input: {
  activeJob: JobRecord | null;
  eventBundles: WorkspaceEventBundleState | null;
  eb1aClassification: WorkspaceEb1aClassificationState | null;
  criteriaTagging: WorkspaceCriteriaTaggingState | null;
  pendingStats: PendingFolderStats | null;
  isUploading: boolean;
  totalJobs: number;
  hasCandidateName: boolean;
}) : WorkspaceActivity {
  if (input.isUploading && input.pendingStats) {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "Preparing the folder upload",
      detail: `Saving the workspace settings and staging ${input.pendingStats.fileCount} file(s) from ${input.pendingStats.rootLabel} for indexing.`,
      progress: null,
    };
  }

  if (input.pendingStats) {
    return {
      tone: "border-slate-200 bg-slate-50 text-slate-800",
      title: "Folder selected and waiting for action",
      detail: `${input.pendingStats.fileCount} file(s) from ${input.pendingStats.rootLabel} are ready. Click Index folder to create a new isolated workspace.`,
      progress: null,
    };
  }

  if (input.activeJob?.status === "queued") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "Folder queued for indexing",
      detail: `The folder ${input.activeJob.folderLabel} is isolated as its own workspace and is waiting for parsing to start.`,
      progress: getJobProgress(input.activeJob),
    };
  }

  if (input.activeJob?.status === "canceling") {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      title: "Stopping the active run",
      detail: `Cancellation was requested for ${input.activeJob.folderLabel}. The current AI step will stop before the next stage starts.`,
      progress: getJobProgress(input.activeJob),
    };
  }

  if (input.activeJob?.status === "processing") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "Indexing is in progress",
      detail: `${input.activeJob.processedFiles} of ${input.activeJob.totalFiles} file(s) have been processed for ${input.activeJob.folderLabel}.${input.activeJob.failedFiles ? ` ${input.activeJob.failedFiles} file(s) have failed so far.` : ""}`,
      progress: getJobProgress(input.activeJob),
    };
  }

  const indexingCompleted =
    input.activeJob?.status === "completed" || input.activeJob?.status === "completed_with_errors";

  if (indexingCompleted && input.eventBundles?.status === "queued") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "Event bundling is queued",
      detail: "Document summaries are ready. AI event grouping is queued for this folder workspace.",
      progress: null,
    };
  }

  if (indexingCompleted && input.eventBundles?.status === "processing") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "Building event bundles",
      detail:
        input.eventBundles.message ||
        "AI is grouping related evidence into event bundles for this folder workspace.",
      progress: null,
    };
  }

  if (indexingCompleted && input.eventBundles?.status === "failed") {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      title: "Event bundling needs attention",
      detail:
        input.eventBundles.error ||
        "The workspace finished indexing, but event bundling did not complete.",
      progress: null,
    };
  }

  if (indexingCompleted && input.eventBundles?.status === "canceled") {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      title: "Event bundling was canceled",
      detail:
        input.eventBundles.message ||
        "The workspace finished indexing, but event bundling was stopped before completion.",
      progress: null,
    };
  }

  if (indexingCompleted && input.eb1aClassification?.status === "queued") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "EB1A classification is queued",
      detail:
        "Event bundles are ready. The next AI pass will assign EB1A criteria and prepare the output package.",
      progress: null,
    };
  }

  if (indexingCompleted && input.eb1aClassification?.status === "processing") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "Classifying bundles into EB1A criteria",
      detail:
        input.eb1aClassification.message ||
        "AI is assigning bundle-level EB1A categories and writing the organized output package.",
      progress: null,
    };
  }

  if (indexingCompleted && input.eb1aClassification?.status === "failed") {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      title: "EB1A classification needs attention",
      detail:
        input.eb1aClassification.error ||
        "The workspace is reviewable, but the EB1A classification/export pass did not complete.",
      progress: null,
    };
  }

  if (indexingCompleted && input.eb1aClassification?.status === "canceled") {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      title: "EB1A classification was canceled",
      detail:
        input.eb1aClassification.message ||
        "The workspace remains indexed, but the EB1A classification pass was stopped.",
      progress: null,
    };
  }

  if (indexingCompleted && input.criteriaTagging?.status === "queued") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "Evidence tagging is queued",
      detail:
        "Bundle classification is ready. The next AI pass will tag evidence files with criterion hints and keep/archive review states.",
      progress: null,
    };
  }

  if (indexingCompleted && input.criteriaTagging?.status === "processing") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      title: "Tagging evidence files for review",
      detail:
        input.criteriaTagging.message ||
        "AI is tagging evidence files with criterion suggestions and keep/archive review hints.",
      progress: null,
    };
  }

  if (indexingCompleted && input.criteriaTagging?.status === "failed") {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      title: "Evidence tagging needs attention",
      detail:
        input.criteriaTagging.error ||
        "The workspace is bundled and classified, but the evidence tagging pass did not complete.",
      progress: null,
    };
  }

  if (indexingCompleted && input.criteriaTagging?.status === "canceled") {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      title: "Evidence tagging was canceled",
      detail:
        input.criteriaTagging.message ||
        "The workspace remains indexed, bundled, and classified, but the evidence tagging pass was stopped.",
      progress: null,
    };
  }

  if (input.activeJob?.status === "completed_with_errors") {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      title: "Folder review is ready with some errors",
      detail: `${input.activeJob.folderLabel} has finished indexing. ${input.activeJob.failedFiles} file(s) need manual attention, and only this folder's backend details are shown in the table below.`,
      progress: 100,
    };
  }

  if (input.activeJob?.status === "failed") {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      title: "Indexing stopped",
      detail: input.activeJob.error
        ? `The folder ${input.activeJob.folderLabel} stopped because: ${input.activeJob.error}`
        : `The folder ${input.activeJob.folderLabel} stopped before indexing could finish.`,
      progress: null,
    };
  }

  if (input.activeJob?.status === "canceled") {
    return {
      tone: "border-slate-200 bg-slate-50 text-slate-800",
      title: "Process canceled",
      detail:
        input.activeJob.error ||
        `The folder ${input.activeJob.folderLabel} was canceled before the full pipeline could finish.`,
      progress: null,
    };
  }

  if (input.activeJob?.status === "completed") {
    return {
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      title: "Folder workspace is ready",
      detail:
        input.criteriaTagging?.status === "completed"
          ? `You are reviewing the isolated backend data for ${input.activeJob.folderLabel}. ${input.eventBundles?.bundles.length ?? 0} event bundle(s) are now organized into criteria, archive, unwanted, or human-review buckets, document-level tagging is complete, an output package was saved locally, and files from other folders are not shown in this view.`
          : input.eb1aClassification?.status === "completed"
          ? `You are reviewing the isolated backend data for ${input.activeJob.folderLabel}. ${input.eventBundles?.bundles.length ?? 0} event bundle(s) are now organized into criteria, archive, unwanted, or human-review buckets, an output package was saved locally, and files from other folders are not shown in this view.`
          : input.eventBundles?.status === "completed"
            ? `You are reviewing the isolated backend data for ${input.activeJob.folderLabel}. ${input.eventBundles.bundles.length} event bundle(s) are ready, and files from other folders are not shown in this view.`
            : `You are reviewing the isolated backend data for ${input.activeJob.folderLabel}. Files from other folders are not shown in this view.`,
      progress: 100,
    };
  }

  if (!input.hasCandidateName) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      title: "Candidate name is still missing",
      detail: "Add the beneficiary name first so new folder workspaces can be indexed with the right candidate context.",
      progress: null,
    };
  }

  if (input.totalJobs > 0) {
    return {
      tone: "border-slate-200 bg-slate-50 text-slate-800",
      title: "No indexing is running right now",
      detail: "Select a processed folder workspace to review its backend data, or choose a new folder to start another isolated indexing run.",
      progress: null,
    };
  }

  return {
    tone: "border-slate-200 bg-slate-50 text-slate-800",
    title: "No folder workspace exists yet",
    detail: "Choose a folder to start the first isolated evidence workspace. Until then, there is nothing to parse or review.",
    progress: null,
  };
}

export function EvidenceWorkbench({
  initialSnapshot,
  pageMode = "dashboard",
}: EvidenceWorkbenchProps) {
  const router = useRouter();
  const leftPanelStorageKey =
    pageMode === "review"
      ? "eb1a-evidence-studio.review.left-panel-width"
      : "eb1a-evidence-studio.dashboard.left-panel-width";
  const rightPanelStorageKey = "eb1a-evidence-studio.review.right-panel-width";
  const [library, setLibrary] = useState(initialSnapshot);
  const [activeJobId, setActiveJobId] = useState<string | null>(
    initialSnapshot.activeJobId ?? null,
  );
  const [semanticResults, setSemanticResults] = useState<SearchResult[] | null>(null);
  const [semanticQuery, setSemanticQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    initialSnapshot.documents[0]?.id ?? null,
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingStats, setPendingStats] = useState<PendingFolderStats | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isApplyingOverride, setIsApplyingOverride] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(() =>
    buildSettingsDraft(initialSnapshot.settings),
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isCancelingProcess, setIsCancelingProcess] = useState(false);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<{
    kind: "bucket" | "bundle";
    id: string;
  } | null>(null);
  const [expandedBucketIds, setExpandedBucketIds] = useState<Record<string, boolean>>({});
  const [expandedBundleIds, setExpandedBundleIds] = useState<Record<string, boolean>>({});
  const [expandedBundleSummaryIds, setExpandedBundleSummaryIds] = useState<Record<string, boolean>>({});
  const [expandedSubBundleIds, setExpandedSubBundleIds] = useState<Record<string, boolean>>({});
  const [readyView, setReadyView] = useState<ReadyViewMode>("by-bundle");
  const [statusFilter, setStatusFilter] = useState<EvidenceStatusFilter>("all");
  const [criterionFilter, setCriterionFilter] = useState<string | null>(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [peekTab, setPeekTab] = useState<PeekTab>("summary");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    mode: null,
    documentIds: [],
    bundleId: null,
    criterionCode: null,
    submenu: null,
  });
  const [contextMenuLayout, setContextMenuLayout] = useState<ContextMenuLayout>({
    left: 0,
    top: 0,
    submenuDirection: "right",
    criterionTop: 0,
    bundleTop: 0,
  });
  const [subBundleDialog, setSubBundleDialog] = useState<{
    open: boolean;
    bundleId: string | null;
    documentIds: string[];
  }>({
    open: false,
    bundleId: null,
    documentIds: [],
  });
  const [subBundleNameDraft, setSubBundleNameDraft] = useState("");
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const fallbackWidth =
      pageMode === "review" ? REVIEW_LEFT_PANEL_DEFAULT_WIDTH : DASHBOARD_LEFT_PANEL_DEFAULT_WIDTH;

    if (typeof window === "undefined") {
      return fallbackWidth;
    }

    const storedWidth = window.localStorage.getItem(leftPanelStorageKey);
    const parsed = storedWidth ? Number.parseInt(storedWidth, 10) : Number.NaN;

    if (!Number.isFinite(parsed)) {
      return fallbackWidth;
    }

    return Math.min(LEFT_PANEL_MAX_WIDTH, Math.max(LEFT_PANEL_MIN_WIDTH, parsed));
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window === "undefined") {
      return REVIEW_RIGHT_PANEL_DEFAULT_WIDTH;
    }

    const storedWidth = window.localStorage.getItem(rightPanelStorageKey);
    const parsed = storedWidth ? Number.parseInt(storedWidth, 10) : Number.NaN;

    if (!Number.isFinite(parsed)) {
      return REVIEW_RIGHT_PANEL_DEFAULT_WIDTH;
    }

    return Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, parsed));
  });
  const [resizingPanel, setResizingPanel] = useState<{
    panel: ResizablePanel;
    startX: number;
    startWidth: number;
  } | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const criterionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const bundleMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const criterionSubmenuRef = useRef<HTMLDivElement | null>(null);
  const bundleSubmenuRef = useRef<HTMLDivElement | null>(null);

  const deferredFilter = useDeferredValue(quickFilter.trim());
  const semanticResultIds = semanticResults
    ? new Set(semanticResults.map((document) => document.id))
    : null;
  const visibleEventBundles = buildVisibleEventBundles({
    bundleState: library.eventBundles,
    documents: library.documents,
    filter: deferredFilter,
    semanticResultIds,
  });
  const visibleDocuments = buildVisibleDocuments({
    documents: library.documents,
    filter: deferredFilter,
    semanticResultIds,
  });
  const flattenedVisibleDocuments = visibleEventBundles.flatMap((bundle) => bundle.evidenceDocuments);
  const documentsForSelection = flattenedVisibleDocuments.length
    ? flattenedVisibleDocuments
    : visibleDocuments;
  const selectedDocumentFromBundles =
    flattenedVisibleDocuments.find((document) => document.id === selectedDocumentId) ?? null;
  const selectedVisibleDocument =
    visibleDocuments.find((document) => document.id === selectedDocumentId) ?? null;
  const activeJob = library.activeJob;
  const activeJobProgress = getJobProgress(activeJob);
  const workspaceJobs = [...library.jobs].sort(
    (left, right) =>
      new Date(getJobLastRunAt(right)).getTime() - new Date(getJobLastRunAt(left)).getTime(),
  );
  const recentWorkspaceRuns = workspaceJobs.slice(0, 2);
  const additionalWorkspaceHistoryCount = Math.max(0, workspaceJobs.length - 2);
  const selectedDocument =
    selectedDocumentFromBundles ??
    selectedVisibleDocument ??
    documentsForSelection[0] ??
    null;
  const workspaceCandidate =
    settingsDraft.candidateName.trim() || library.settings.candidateName.trim();
  const candidateDisplayName = workspaceCandidate || "Candidate not set";
  const candidateNameInput = settingsDraft.candidateName.trim();
  const activeWorkspaceRunAt = activeJob ? formatDateTime(getJobLastRunAt(activeJob)) : "Not yet";
  const reviewWorkspaceHref = activeJobId ? `/review/${activeJobId}` : null;
  const activeWorkspaceDocuments = library.overview.totalDocuments;
  const indexProgressDocuments = useMemo(
    () =>
      [...library.documents].sort((left, right) => {
        const activityComparison = right.updatedAt.localeCompare(left.updatedAt);

        if (activityComparison !== 0) {
          return activityComparison;
        }

        return left.fileName.localeCompare(right.fileName);
      }),
    [library.documents],
  );
  const indexingElapsedLabel = activeJob
    ? formatElapsedTime(activeJob.startedAt, activeJob.completedAt)
    : "Not started";
  const workspaceTotalAiCost =
    library.overview.totalOpenAiCostUsd +
    (library.eventBundles?.totalCostUsd ?? 0) +
    (library.eb1aClassification?.totalCostUsd ?? 0) +
    (library.criteriaTagging?.totalCostUsd ?? 0);
  const selectedEventBundle =
    visibleEventBundles.find((bundle) => bundle.evidenceDocuments.some((document) => document.id === selectedDocument?.id)) ??
    null;
  const classificationReady = library.eb1aClassification?.status === "completed";
  const effectiveReadyView = classificationReady ? readyView : "by-bundle";
  const taggingReady = library.criteriaTagging?.status === "completed";
  const criterionDecisionLookup = buildCriterionDecisionLookup(library.eb1aClassification);
  const criterionSummary = buildCriterionSummary(library.eb1aClassification);
  const visibleReviewBuckets = buildVisibleReviewBuckets(
    visibleEventBundles,
    library.eb1aClassification,
  );
  const reviewBundleViews = buildReviewBundleViews({
    bundles: visibleEventBundles,
    reviewState: library.reviewState,
    statusFilter,
    criterionFilter,
  });
  const reviewCriterionBuckets = buildCriterionBucketViews({
    reviewBuckets: visibleReviewBuckets,
    reviewBundles: reviewBundleViews,
    criterionFilter,
  });
  const visibleBucketLegend = Array.from(
    new Map(
      visibleReviewBuckets.map((bucket) => [
        bucket.bucketCode,
        {
          code: bucket.bucketCode,
          name: bucket.bucketName,
          kind: bucket.bucketKind,
        },
      ]),
    ).values(),
  );
  const selectedEvidenceSet = new Set(selectedEvidenceIds);
  const taggedDocumentCount =
    library.criteriaTagging?.taggedDocuments ??
    library.documents.filter((document) => document.criteriaTags.length > 0).length;
  const confidentDocumentIds = library.documents
    .filter((document) =>
      document.criteriaTags.some(
        (criterion) => criterion.role === "primary" && criterion.confidence >= 0.75,
      ),
    )
    .map((document) => document.id);
  const pendingReviewDocumentCount = library.documents.filter(
    (document) => document.reviewStatus === "pending",
  ).length;
  const manualCategoryOverrideCount = countManualCategoryOverrides(library);
  const manualEventOverrideCount = countManualEventOverrides(library);
  const classifiedBundleCount = countBundlesByDisposition(
    library.eb1aClassification,
    "classified",
  );
  const unclassifiedBundleCount = countBundlesByDisposition(
    library.eb1aClassification,
    "unclassified",
  );
  const archiveBundleCount = countBundlesByDisposition(
    library.eb1aClassification,
    "archive",
  );
  const unwantedBundleCount = countBundlesByDisposition(
    library.eb1aClassification,
    "unwanted",
  );
  const selectedBundleDecision = selectedEventBundle
    ? findBundleDecision(selectedEventBundle.id, library.eb1aClassification)
    : null;
  const previewUrl = selectedDocument
    ? `/api/documents/${selectedDocument.id}/preview/index.html${
        activeJobId ? `?jobId=${encodeURIComponent(activeJobId)}` : ""
      }`
    : null;
  const sourceUrl = selectedDocument
    ? `/api/documents/${selectedDocument.id}/source${
        activeJobId ? `?jobId=${encodeURIComponent(activeJobId)}` : ""
      }`
    : null;
  const workspaceActivity = buildWorkspaceActivity({
    activeJob,
    eventBundles: library.eventBundles,
    eb1aClassification: library.eb1aClassification,
    criteriaTagging: library.criteriaTagging,
    pendingStats,
    isUploading,
    totalJobs: library.jobs.length,
    hasCandidateName: Boolean(settingsDraft.candidateName.trim()),
  });
  const reviewPipeline = buildReviewPipeline({
    activeJob,
    eventBundles: library.eventBundles,
    eb1aClassification: library.eb1aClassification,
    criteriaTagging: library.criteriaTagging,
    pendingStats,
    isUploading,
  });
  const bundleReviewReady = library.eventBundles?.status === "completed";
  const reviewStageReady = reviewPipeline.stages.some(
    (stage) => stage.id === "review" && stage.status === "completed",
  );
  const showDashboardReview = pageMode === "dashboard" && reviewStageReady;
  const shouldRenderReviewSurface = pageMode === "review" || showDashboardReview;
  const hasAbortableProcessing = Boolean(
    activeJobId &&
      (activeJob?.status === "queued" ||
        activeJob?.status === "processing" ||
        activeJob?.status === "canceling" ||
        Boolean(activeJob?.cancellationRequestedAt) ||
        library.eventBundles?.status === "queued" ||
        library.eventBundles?.status === "processing" ||
        library.eb1aClassification?.status === "queued" ||
        library.eb1aClassification?.status === "processing" ||
        library.criteriaTagging?.status === "queued" ||
        library.criteriaTagging?.status === "processing"),
  );
  const canStartIndexing = Boolean(
    pendingFiles.length &&
      pendingStats &&
      candidateNameInput &&
      !isUploading &&
      !hasAbortableProcessing &&
      !isCancelingProcess,
  );
  const canCancelSelection =
    pendingFiles.length > 0 && !isUploading && !hasAbortableProcessing && !isCancelingProcess;
  const canDeleteSelectedWorkspace = Boolean(
    activeJobId &&
      !isDeletingWorkspace &&
      !hasAbortableProcessing &&
      activeJob &&
      activeJob.status !== "queued" &&
      activeJob.status !== "processing" &&
      activeJob.status !== "canceling",
  );
  const hasExpandedBucketSelection = Object.values(expandedBucketIds).some(Boolean);
  const hasExpandedBundleSelection = Object.values(expandedBundleIds).some(Boolean);
  const panelGridStyle = useMemo(() => {
    return {
      "--left-panel-width": `${leftPanelWidth}px`,
      "--right-panel-width": `${rightPanelWidth}px`,
    } as CSSProperties;
  }, [leftPanelWidth, rightPanelWidth]);

  const refreshLibrary = useCallback(
    async (requestedJobId?: string | null) => {
      const snapshot = await requestLibrarySnapshot(requestedJobId ?? activeJobId);

      if (!snapshot) {
        return;
      }

      startTransition(() => {
        setLibrary(snapshot);
        setActiveJobId(snapshot.activeJobId);
        if (!settingsOpen) {
          setSettingsDraft(buildSettingsDraft(snapshot.settings));
        }
      });
    },
    [activeJobId, settingsOpen],
  );

  const startPanelResize = useCallback(
    (panel: ResizablePanel, event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setResizingPanel({
        panel,
        startX: event.clientX,
        startWidth: panel === "left" ? leftPanelWidth : rightPanelWidth,
      });
    },
    [leftPanelWidth, rightPanelWidth],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(leftPanelStorageKey, String(leftPanelWidth));
  }, [leftPanelStorageKey, leftPanelWidth]);

  useEffect(() => {
    if (typeof window === "undefined" || pageMode !== "review") {
      return;
    }

    window.localStorage.setItem(rightPanelStorageKey, String(rightPanelWidth));
  }, [pageMode, rightPanelStorageKey, rightPanelWidth]);

  useEffect(() => {
    if (!resizingPanel) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (resizingPanel.panel === "left") {
        const nextWidth = resizingPanel.startWidth + (event.clientX - resizingPanel.startX);

        setLeftPanelWidth(Math.min(LEFT_PANEL_MAX_WIDTH, Math.max(LEFT_PANEL_MIN_WIDTH, nextWidth)));
        return;
      }

      const nextWidth = resizingPanel.startWidth - (event.clientX - resizingPanel.startX);
      setRightPanelWidth(Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, nextWidth)));
    };

    const handleMouseUp = () => {
      setResizingPanel(null);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingPanel]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const snapshot = await requestLibrarySnapshot(initialSnapshot.activeJobId);

      if (!active || !snapshot) {
        return;
      }

      startTransition(() => {
        setLibrary(snapshot);
        setActiveJobId(snapshot.activeJobId);
        setSettingsDraft(buildSettingsDraft(snapshot.settings));
      });
    })();

    return () => {
      active = false;
    };
  }, [initialSnapshot.activeJobId]);

  useEffect(() => {
    const hasActiveIndexing = library.jobs.some((job) => isActiveJob(job.status));
    const hasActiveBundling =
      library.eventBundles?.status === "queued" || library.eventBundles?.status === "processing";
    const hasActiveClassification =
      library.eb1aClassification?.status === "queued" ||
      library.eb1aClassification?.status === "processing";
    const hasActiveTagging =
      library.criteriaTagging?.status === "queued" ||
      library.criteriaTagging?.status === "processing";

    if (!hasActiveIndexing && !hasActiveBundling && !hasActiveClassification && !hasActiveTagging) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshLibrary();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [
    library.eb1aClassification?.status,
    library.criteriaTagging?.status,
    library.eventBundles?.status,
    library.jobs,
    refreshLibrary,
  ]);

  const persistSettings = async (options?: {
    successMessage?: string | null;
    closeModal?: boolean;
  }) => {
    setIsSavingSettings(true);
    setBannerMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateName: settingsDraft.candidateName,
          summaryPrompt: settingsDraft.summaryPrompt,
          classificationPrompt: settingsDraft.classificationPrompt,
          taggingPrompt: settingsDraft.taggingPrompt,
          apiKey: settingsDraft.apiKey,
          summaryModel: settingsDraft.summaryModel,
          embeddingModel: settingsDraft.embeddingModel,
          embeddingDimensions: Number(settingsDraft.embeddingDimensions),
          outputRootPath: settingsDraft.outputRootPath,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save settings.");
      }

      startTransition(() => {
        setLibrary((current) => ({
          ...current,
          settings: payload.settings,
        }));
        setSettingsDraft(buildSettingsDraft(payload.settings));
      });

      if (options?.closeModal) {
        setSettingsOpen(false);
      }

      if (options?.successMessage) {
        setBannerMessage(options.successMessage);
      }

      return true;
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Unable to save settings.");
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleFolderPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPendingFiles(files);
    setPendingStats(files.length ? summarizeFolder(files) : null);
    setBannerMessage(null);
  };

  const handleCancelProcess = async () => {
    if (canCancelSelection) {
      setPendingFiles([]);
      setPendingStats(null);
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
      setBannerMessage("Folder selection cleared.");
      return;
    }

    if (!activeJobId || !hasAbortableProcessing) {
      setBannerMessage("There is no active indexing process to cancel.");
      return;
    }

    setIsCancelingProcess(true);
    setBannerMessage(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(activeJobId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "cancel",
        }),
      });
      const snapshot = (await response.json()) as LibrarySnapshot | { error?: string };

      if (!response.ok || !("documents" in snapshot)) {
        throw new Error(("error" in snapshot && snapshot.error) || "Unable to cancel the process.");
      }

      startTransition(() => {
        setLibrary(snapshot);
        setActiveJobId(snapshot.activeJobId);
        if (!settingsOpen) {
          setSettingsDraft(buildSettingsDraft(snapshot.settings));
        }
      });

      setBannerMessage(
        "Cancellation requested. The current AI step will stop as soon as it safely can.",
      );
    } catch (error) {
      setBannerMessage(
        error instanceof Error ? error.message : "Unable to cancel the process.",
      );
    } finally {
      setIsCancelingProcess(false);
    }
  };

  const handleDeleteSelectedWorkspace = async () => {
    if (!activeJobId || !activeJob) {
      setBannerMessage("Select a folder workspace before deleting backend data.");
      return;
    }

    const shouldDelete = window.confirm(
      `Delete the workspace "${activeJob.folderLabel}" for ${activeJob.candidateName || "this candidate"}?\n\nThis removes uploaded files, vector data, previews, exports, and saved review state for this folder workspace.`,
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeletingWorkspace(true);
    setBannerMessage(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(activeJobId)}`, {
        method: "DELETE",
      });
      const snapshot = (await response.json()) as LibrarySnapshot | { error?: string };

      if (!response.ok || !("documents" in snapshot)) {
        throw new Error(
          ("error" in snapshot && snapshot.error) || "Unable to delete the selected workspace.",
        );
      }

      const deletedFolderLabel = activeJob.folderLabel;
      const nextJobId = snapshot.activeJobId;

      startTransition(() => {
        setLibrary(snapshot);
        setActiveJobId(nextJobId);
        setSemanticResults(null);
        setSemanticQuery("");
        setQuickFilter("");
        setSelectedDocumentId(snapshot.documents[0]?.id ?? null);
        setIsPreviewOpen(false);
        setDragState(null);
        setActiveDropTarget(null);
        setExpandedBucketIds({});
        setExpandedBundleIds({});
        setExpandedBundleSummaryIds({});
        setExpandedSubBundleIds({});
        setSelectedEvidenceIds([]);
        setSelectionAnchorId(null);
        setCriterionFilter(null);
        setStatusFilter("all");
        setContextMenu({
          open: false,
          x: 0,
          y: 0,
          mode: null,
          documentIds: [],
          bundleId: null,
          criterionCode: null,
          submenu: null,
        });
        if (!settingsOpen) {
          setSettingsDraft(buildSettingsDraft(snapshot.settings));
        }
      });

      if (pageMode === "review") {
        if (nextJobId) {
          router.push(`/review/${nextJobId}`);
        } else {
          router.push("/");
        }
      }

      setBannerMessage(`Deleted backend data for ${deletedFolderLabel}.`);
    } catch (error) {
      setBannerMessage(
        error instanceof Error ? error.message : "Unable to delete the selected workspace.",
      );
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  const handleSelectJob = async (jobId: string) => {
    setActiveJobId(jobId);
    setSemanticResults(null);
    setSemanticQuery("");
    setSelectedDocumentId(null);
    setIsPreviewOpen(false);
    setDragState(null);
    setActiveDropTarget(null);
    setExpandedBucketIds({});
    setExpandedBundleIds({});
    setExpandedBundleSummaryIds({});
    setExpandedSubBundleIds({});
    setSelectedEvidenceIds([]);
    setSelectionAnchorId(null);
    setCriterionFilter(null);
    setStatusFilter("all");
    setContextMenu({
      open: false,
      x: 0,
      y: 0,
      mode: null,
      documentIds: [],
      bundleId: null,
      criterionCode: null,
      submenu: null,
    });
    setBannerMessage(null);

    if (pageMode === "review") {
      router.push(`/review/${jobId}`);
      return;
    }

    await refreshLibrary(jobId);
  };

  const applyManualOverride = async (
    payload:
      | {
          jobId: string;
          type: "bundle-category";
          bundleId: string;
          bucketCode: string;
        }
      | {
          jobId: string;
          type: "document-event";
          documentId: string;
          targetBundleId: string;
        }
      | {
          jobId: string;
          type: "document-review";
          documentId: string;
          reviewDisposition: DocumentReviewAction;
        },
    successMessage: string,
  ) => {
    setIsApplyingOverride(true);
    setBannerMessage(null);

    try {
      const response = await fetch("/api/overrides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const snapshot = (await response.json()) as LibrarySnapshot | { error?: string };

      if (!response.ok || !("documents" in snapshot)) {
        throw new Error(("error" in snapshot && snapshot.error) || "Unable to apply override.");
      }

      startTransition(() => {
        setLibrary(snapshot);
        setActiveJobId(snapshot.activeJobId);
        if (!settingsOpen) {
          setSettingsDraft(buildSettingsDraft(snapshot.settings));
        }
      });

      setBannerMessage(successMessage);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Unable to apply override.");
    } finally {
      setIsApplyingOverride(false);
      setDragState(null);
      setActiveDropTarget(null);
    }
  };

  const openPreview = (documentId: string) => {
    if (isPreviewOpen && selectedDocumentId === documentId) {
      setIsPreviewOpen(false);
      return;
    }

    setSelectedDocumentId(documentId);
    setIsPreviewOpen(true);
  };

  const routeDocumentForReview = (
    documentId: string,
    reviewDisposition: DocumentReviewAction,
  ) => {
    if (!activeJobId) {
      return;
    }

    const successMessage =
      reviewDisposition === "keep"
        ? "Evidence restored to the active petition review set."
        : reviewDisposition === "archive"
          ? "Evidence moved to Archive Category for later review."
          : "Evidence moved to Unwanted so it stays out of petition drafting.";

    void applyManualOverride(
      {
        jobId: activeJobId,
        type: "document-review",
        documentId,
        reviewDisposition,
      },
      successMessage,
    );
  };

  const handleUpload = async () => {
    if (!pendingFiles.length || !pendingStats) {
      return;
    }

    if (!settingsDraft.candidateName.trim()) {
      setBannerMessage("Add a candidate name before indexing evidence.");
      return;
    }

    setIsUploading(true);
    setBannerMessage(null);

    try {
      const persisted = await persistSettings();

      if (!persisted) {
        return;
      }

      const formData = new FormData();
      formData.append("candidateName", settingsDraft.candidateName.trim());
      formData.append("folderLabel", pendingStats.rootLabel);

      pendingFiles.forEach((file) => {
        formData.append("files", file, file.name);
        formData.append("paths", file.webkitRelativePath || file.name);
      });

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Folder ingestion failed.");
      }

      setPendingFiles([]);
      setPendingStats(null);
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }

      setSemanticResults(null);
      setSemanticQuery("");
      setSelectedDocumentId(null);
      setActiveJobId(payload.jobId);
      setBannerMessage(
        `Started indexing ${payload.totalFiles} files for ${payload.candidateName} from ${payload.folderLabel}.`,
      );
      await refreshLibrary(payload.jobId);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Folder ingestion failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSemanticSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!semanticQuery.trim()) {
      setSemanticResults(null);
      return;
    }

    if (!activeJobId) {
      setBannerMessage("Select a folder workspace before running semantic search.");
      return;
    }

    setIsSearching(true);
    setBannerMessage(null);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(semanticQuery.trim())}&jobId=${encodeURIComponent(activeJobId)}`,
        {
          cache: "no-store",
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Search failed.");
      }

      startTransition(() => {
        setSemanticResults(payload.results);
      });
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const closeContextMenu = () => {
    setContextMenu((current) => ({
      ...current,
      open: false,
      submenu: null,
    }));
  };

  const persistEvidenceStatus = async (
    documentIds: string[],
    status: "kept" | "pending" | "archived",
  ) => {
    if (!documentIds.length) {
      return;
    }

    setBannerMessage(null);

    try {
      const response = await fetch(
        documentIds.length === 1
          ? `/api/evidence/${encodeURIComponent(documentIds[0])}/status`
          : "/api/evidence/bulk-status",
        {
          method: documentIds.length === 1 ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            documentIds.length === 1 ? { status } : { ids: documentIds, status },
          ),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || payload.error || "Unable to save evidence status.");
      }

      setSelectedEvidenceIds([]);
      await refreshLibrary(activeJobId);
    } catch (error) {
      setBannerMessage(
        error instanceof Error ? error.message : "Unable to save evidence status.",
      );
    }
  };

  const cycleCriterionForDocument = async (
    document: ClientDocument,
    criterionCode: string,
    explicitRole?: "primary" | "supporting" | null,
  ) => {
    const existing = document.criteriaTags.find((criterion) => criterion.code === criterionCode);
    const nextRole =
      explicitRole !== undefined
        ? explicitRole
        : !existing
          ? "primary"
          : existing.role === "primary"
            ? "supporting"
            : null;

    try {
      const response = await fetch(
        nextRole === null
          ? `/api/evidence/${encodeURIComponent(document.id)}/criteria/${encodeURIComponent(criterionCode)}`
          : existing
            ? `/api/evidence/${encodeURIComponent(document.id)}/criteria/${encodeURIComponent(criterionCode)}`
            : `/api/evidence/${encodeURIComponent(document.id)}/criteria`,
        {
          method: nextRole === null ? "DELETE" : existing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body:
            nextRole === null
              ? undefined
              : JSON.stringify(
                  existing ? { role: nextRole } : { code: criterionCode, role: nextRole },
                ),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || payload.error || "Unable to edit criteria.");
      }

      await refreshLibrary(activeJobId);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Unable to edit criteria.");
    }
  };

  const moveEvidenceDocuments = async (
    documentIds: string[],
    targetBundleId: string,
    targetSubBundleId?: string | null,
  ) => {
    if (!activeJobId || !documentIds.length) {
      return;
    }

    try {
      const response = await fetch(
        documentIds.length === 1
          ? `/api/evidence/${encodeURIComponent(documentIds[0])}/move`
          : "/api/evidence/bulk-move",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            documentIds.length === 1
              ? {
                  jobId: activeJobId,
                  targetBundleId,
                  targetSubBundleId: targetSubBundleId ?? null,
                }
              : {
                  jobId: activeJobId,
                  ids: documentIds,
                  targetBundleId,
                  targetSubBundleId: targetSubBundleId ?? null,
                },
          ),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || payload.error || "Unable to move evidence.");
      }

      setSelectedEvidenceIds([]);
      await refreshLibrary(activeJobId);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Unable to move evidence.");
    }
  };

  const createSubBundleFromSelection = async () => {
    if (!activeJobId || !subBundleDialog.bundleId || !subBundleNameDraft.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `/api/bundles/${encodeURIComponent(subBundleDialog.bundleId)}/sub-bundles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jobId: activeJobId,
            name: subBundleNameDraft.trim(),
            evidenceIds: subBundleDialog.documentIds,
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error?.message || payload.error || "Unable to create sub-bundle.");
      }

      setSubBundleDialog({
        open: false,
        bundleId: null,
        documentIds: [],
      });
      setSubBundleNameDraft("");
      setSelectedEvidenceIds([]);
      await refreshLibrary(activeJobId);
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Unable to create sub-bundle.");
    }
  };

  const openEvidenceContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    documentId: string,
    bundleId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const nextIds = selectedEvidenceSet.has(documentId)
      ? selectedEvidenceIds
      : selectedEvidenceIds.length > 0
        ? [...new Set([...selectedEvidenceIds, documentId])]
        : [documentId];

    if (!selectedEvidenceSet.has(documentId)) {
      setSelectedEvidenceIds(nextIds);
      setSelectionAnchorId(documentId);
    }

    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      mode: nextIds.length > 1 ? "evidence-multi" : "evidence-single",
      documentIds: nextIds,
      bundleId,
      criterionCode: null,
      submenu: null,
    });
  };

  useEffect(() => {
    if (!contextMenu.open) {
      return;
    }

    const close = () => closeContextMenu();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu.open]);

  useEffect(() => {
    if (!contextMenu.open) {
      return;
    }

    let frame = 0;

    const updateLayout = () => {
      frame = window.requestAnimationFrame(() => {
        const menuRect = contextMenuRef.current?.getBoundingClientRect();

        if (!menuRect) {
          return;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const nextLeft = Math.min(
          Math.max(CONTEXT_MENU_VIEWPORT_PADDING, contextMenu.x),
          viewportWidth - menuRect.width - CONTEXT_MENU_VIEWPORT_PADDING,
        );
        const nextTop = Math.min(
          Math.max(CONTEXT_MENU_VIEWPORT_PADDING, contextMenu.y),
          viewportHeight - menuRect.height - CONTEXT_MENU_VIEWPORT_PADDING,
        );
        const submenuDirection =
          nextLeft + menuRect.width + CONTEXT_SUBMENU_GAP + CONTEXT_SUBMENU_WIDTH >
          viewportWidth - CONTEXT_MENU_VIEWPORT_PADDING
            ? "left"
            : "right";

        const criterionTriggerRect =
          criterionMenuTriggerRef.current?.getBoundingClientRect() ?? null;
        const bundleTriggerRect = bundleMenuTriggerRef.current?.getBoundingClientRect() ?? null;
        const criterionSubmenuHeight =
          criterionSubmenuRef.current?.getBoundingClientRect().height ?? menuRect.height;
        const bundleSubmenuHeight =
          bundleSubmenuRef.current?.getBoundingClientRect().height ?? menuRect.height;
        const criterionViewportTop = criterionTriggerRect
          ? Math.min(
              Math.max(CONTEXT_MENU_VIEWPORT_PADDING, criterionTriggerRect.top),
              viewportHeight - criterionSubmenuHeight - CONTEXT_MENU_VIEWPORT_PADDING,
            )
          : nextTop;
        const bundleViewportTop = bundleTriggerRect
          ? Math.min(
              Math.max(CONTEXT_MENU_VIEWPORT_PADDING, bundleTriggerRect.top),
              viewportHeight - bundleSubmenuHeight - CONTEXT_MENU_VIEWPORT_PADDING,
            )
          : nextTop;
        const nextLayout: ContextMenuLayout = {
          left: nextLeft,
          top: nextTop,
          submenuDirection,
          criterionTop: criterionViewportTop - nextTop,
          bundleTop: bundleViewportTop - nextTop,
        };

        setContextMenuLayout((current) =>
          current.left === nextLayout.left &&
          current.top === nextLayout.top &&
          current.submenuDirection === nextLayout.submenuDirection &&
          current.criterionTop === nextLayout.criterionTop &&
          current.bundleTop === nextLayout.bundleTop
            ? current
            : nextLayout,
        );
      });
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateLayout);
    };
  }, [contextMenu.open, contextMenu.submenu, contextMenu.x, contextMenu.y]);

  const renderEvidenceActionStrip = (
    document: ClientDocument,
    bundleKind: EventBundleKind | null,
    disableReviewRouting = false,
  ) => {
    const previewActive = isPreviewOpen && selectedDocument?.id === document.id;
    const reviewAction = getDocumentReviewAction(library, document.id, bundleKind);

    return (
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => openPreview(document.id)}
          className={evidenceActionButtonClassName("preview", previewActive)}
        >
          <Eye className="h-3 w-3" />
          Quick peek
        </button>
        <button
          type="button"
          disabled={disableReviewRouting || isApplyingOverride}
          onClick={() => routeDocumentForReview(document.id, "keep")}
          className={evidenceActionButtonClassName(
            "keep",
            reviewAction === "keep",
            disableReviewRouting || isApplyingOverride,
          )}
        >
          <Check className="h-3 w-3" />
          Keep
        </button>
        <button
          type="button"
          disabled={disableReviewRouting || isApplyingOverride}
          onClick={() => routeDocumentForReview(document.id, "archive")}
          className={evidenceActionButtonClassName(
            "archive",
            reviewAction === "archive",
            disableReviewRouting || isApplyingOverride,
          )}
        >
          <Archive className="h-3 w-3" />
          Archive
        </button>
        <button
          type="button"
          disabled={disableReviewRouting || isApplyingOverride}
          onClick={() => routeDocumentForReview(document.id, "unwanted")}
          className={evidenceActionButtonClassName(
            "unwanted",
            reviewAction === "unwanted",
            disableReviewRouting || isApplyingOverride,
          )}
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>
    );
  };

  const selectableDocumentsInView =
    effectiveReadyView === "by-criterion" && classificationReady
      ? reviewCriterionBuckets.flatMap((bucket) =>
          bucket.bundles.flatMap((bundle) => [
            ...bundle.rootDocuments,
            ...bundle.subBundles.flatMap((subBundle) => subBundle.documents),
          ]),
        )
      : reviewBundleViews.flatMap((bundle) => [
          ...bundle.rootDocuments,
          ...bundle.subBundles.flatMap((subBundle) => subBundle.documents),
        ]);
  const selectionScopedDocuments = selectableDocumentsInView.filter((document) =>
    selectedEvidenceSet.has(document.id),
  );
  const selectionBundleIds = Array.from(
    new Set(
      reviewBundleViews
        .filter((bundle) =>
          bundle.filteredDocuments.some((document) => selectedEvidenceSet.has(document.id)),
        )
        .map((bundle) => bundle.id),
    ),
  );
  const selectionBundleId = selectionBundleIds.length === 1 ? selectionBundleIds[0] : null;
  const canGroupSelection =
    selectionScopedDocuments.length > 1 && Boolean(selectionBundleId);
  const showReviewSurface = pageMode === "review" || showDashboardReview;
  const pipelineCards = [
    {
      key: "indexing",
      label: "Indexing",
      detail: activeJob
        ? `${activeJob.processedFiles} of ${activeJob.totalFiles} file(s) processed.`
        : "Waiting for a folder upload.",
      status:
        activeJob?.status === "queued" || activeJob?.status === "processing"
          ? "active"
          : activeJob?.status === "completed" || activeJob?.status === "completed_with_errors"
            ? "done"
            : activeJob?.status === "failed" || activeJob?.status === "canceled"
              ? "problem"
              : "idle",
    },
    {
      key: "bundling",
      label: "Bundling",
      detail:
        library.eventBundles?.message ||
        "Event bundling starts after document summaries complete.",
      status:
        library.eventBundles?.status === "queued" || library.eventBundles?.status === "processing"
          ? "active"
          : library.eventBundles?.status === "completed"
            ? "done"
            : library.eventBundles?.status === "failed" ||
                library.eventBundles?.status === "canceled"
              ? "problem"
              : "idle",
    },
    {
      key: "classification",
      label: "Classifying",
      detail:
        library.eb1aClassification?.message ||
        "EB1A criteria classification starts after bundling.",
      status:
        library.eb1aClassification?.status === "queued" ||
        library.eb1aClassification?.status === "processing"
          ? "active"
          : library.eb1aClassification?.status === "completed"
            ? "done"
            : library.eb1aClassification?.status === "failed" ||
                library.eb1aClassification?.status === "canceled"
              ? "problem"
              : "idle",
    },
    {
      key: "tagging",
      label: "Tagging",
      detail:
        library.criteriaTagging?.message ||
        "Document-level evidence tagging starts after classification.",
      status:
        library.criteriaTagging?.status === "queued" ||
        library.criteriaTagging?.status === "processing"
          ? "active"
          : library.criteriaTagging?.status === "completed"
            ? "done"
            : library.criteriaTagging?.status === "failed" ||
                library.criteriaTagging?.status === "canceled"
              ? "problem"
              : "idle",
    },
    {
      key: "ready",
      label: "Ready",
      detail:
        taggingReady
          ? "Evidence is ready for bundle, criterion, and file review."
          : classificationReady
            ? "Final review unlocks as soon as evidence tagging finishes."
            : "Review unlocks as the AI passes complete.",
      status: taggingReady ? "done" : classificationReady ? "active" : "idle",
    },
  ] as const;

  const selectEvidenceDocument = (
    documentId: string,
    mode: "replace" | "toggle" | "range" = "replace",
  ) => {
    if (mode === "replace") {
      setSelectedEvidenceIds([documentId]);
      setSelectionAnchorId(documentId);
      setSelectedDocumentId(documentId);
      return;
    }

    if (mode === "toggle") {
      setSelectedEvidenceIds((current) =>
        current.includes(documentId)
          ? current.filter((entry) => entry !== documentId)
          : [...current, documentId],
      );
      setSelectionAnchorId((current) => current ?? documentId);
      return;
    }

    const anchor = selectionAnchorId ?? documentId;
    const orderedIds = selectableDocumentsInView.map((document) => document.id);
    const anchorIndex = orderedIds.indexOf(anchor);
    const targetIndex = orderedIds.indexOf(documentId);

    if (anchorIndex === -1 || targetIndex === -1) {
      setSelectedEvidenceIds([documentId]);
      setSelectionAnchorId(documentId);
      return;
    }

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    setSelectedEvidenceIds(orderedIds.slice(start, end + 1));
  };

  const saveDocumentMeta = async (documentId: string, payload: { notes?: string; isPinned?: boolean }) => {
    try {
      const response = await fetch(`/api/evidence/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error?.message || body.error || "Unable to save document details.");
      }

      await refreshLibrary(activeJobId);
    } catch (error) {
      setBannerMessage(
        error instanceof Error ? error.message : "Unable to save document details.",
      );
    }
  };

  const useWireframeV3 = true;

  if (useWireframeV3) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
        <div className="mx-auto max-w-[1780px] 2xl:max-w-[1880px]">
          <header className="setu-topbar rounded-[18px] px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="setu-brand-block">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="setu-wordmark" aria-label="setu">
                    <span className="setu-wordmark-letters">setu</span>
                    <span className="setu-wordmark-deck" aria-hidden="true" />
                  </span>
                  <span className="setu-scope-chip">
                    <span className="setu-scope-dot" />
                    <span>{activeJob?.folderLabel || "No workspace yet"}</span>
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="setu-brand-tagline">
                    Confident petitions, faster.
                  </p>
                  <p className="setu-brand-meta">
                    Candidate-centered, local-first review studio for organized evidence work.
                  </p>
                  <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--brand-deep)]">
                    The studio for immigration practice
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="setu-scope-chip">
                  <UserRound className="h-3.5 w-3.5 text-[var(--brand)]" />
                  Candidate · {candidateDisplayName}
                </span>
                {pageMode === "review" ? (
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)]"
                  >
                    Back to dashboard
                  </Link>
                ) : reviewWorkspaceHref ? (
                  <Link
                    href={reviewWorkspaceHref}
                    className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)]"
                  >
                    Detailed review
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)]"
                >
                  <Settings2 className="h-3.5 w-3.5 text-[var(--brand)]" />
                  Prompts
                </button>
                <button
                  type="button"
                  onClick={() => void refreshLibrary()}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)]"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[var(--brand)]" />
                  Refresh
                </button>
              </div>
            </div>
          </header>

          {bannerMessage ? (
            <div className="mt-4 rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-4 py-3 text-[12px] text-[var(--brand-deep)]">
              {bannerMessage}
            </div>
          ) : null}

          <div
            className="mt-4 grid gap-4 xl:grid-cols-[var(--left-panel-width)_minmax(0,1fr)_var(--right-panel-width)]"
            style={panelGridStyle}
          >
            <aside className="setu-paper-panel relative rounded-[18px] p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <div className="space-y-3.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Candidate
                  </p>
                  <div className="mt-2 rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] text-[var(--foreground)]">
                    {candidateDisplayName}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Folder workspaces
                  </p>
                  <select
                    value={activeJobId ?? ""}
                    onChange={(event) => {
                      if (event.target.value) {
                        void handleSelectJob(event.target.value);
                      }
                    }}
                    className="mt-2 w-full rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2 text-[12px] outline-none"
                  >
                    {workspaceJobs.length ? null : <option value="">No workspace yet</option>}
                    {workspaceJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {formatJobHistoryLabel(job)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                    Active workspace last run: {activeWorkspaceRunAt}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Recent history
                    </p>
                    {additionalWorkspaceHistoryCount > 0 ? (
                      <span className="rounded-full bg-[var(--paper-primary)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                        +{additionalWorkspaceHistoryCount} more
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-2">
                    {recentWorkspaceRuns.length ? (
                      recentWorkspaceRuns.map((job) => {
                        const isActive = job.id === activeJobId;

                        return (
                          <button
                            key={`recent-${job.id}`}
                            type="button"
                            onClick={() => void handleSelectJob(job.id)}
                            className={`w-full rounded-[14px] border px-3 py-2.5 text-left transition ${
                              isActive
                                ? "border-[var(--brand)]/20 bg-[var(--brand-soft)]/7"
                                : "border-[var(--border-secondary)] bg-[var(--paper-primary)] hover:bg-[var(--paper-secondary)]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-[var(--foreground)]">
                                  {job.folderLabel}
                                </p>
                                <p className="mt-1 text-[10px] text-[var(--muted)]">
                                  {formatDateTime(getJobLastRunAt(job))}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${jobStatusBadgeClassName(
                                  job.status,
                                )}`}
                              >
                                {job.status.replaceAll("_", " ")}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[10px] text-[var(--muted)]">
                        No workspace runs yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Indexed", String(library.overview.completedDocuments)],
                    ["Bundles", String(library.eventBundles?.bundles.length ?? 0)],
                    ["Tagged", String(taggedDocumentCount)],
                    ["Cost", formatCurrency(workspaceTotalAiCost)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2"
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        {label}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                aria-label="Resize left panel"
                onMouseDown={(event) => startPanelResize("left", event)}
                className="absolute -right-2 top-0 hidden h-full w-4 cursor-col-resize items-center justify-center xl:flex"
              >
                <span
                    className={`setu-resize-handle flex h-16 w-2 items-center justify-center rounded-full border transition ${
                      resizingPanel?.panel === "left"
                        ? "is-active"
                        : ""
                    }`}
                >
                  <GripVertical className="h-3 w-3" />
                </span>
              </button>
            </aside>

            <main className="space-y-4">
              <section className="setu-panel rounded-[18px] p-4">
                <div className="flex flex-col gap-4">
                  {pageMode === "dashboard" ? (
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      directory=""
                      webkitdirectory=""
                      onChange={handleFolderPicked}
                      className="hidden"
                    />
                  ) : null}

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {pageMode === "review" ? "Detailed review" : "Workspace intake"}
                      </p>
                      <h1 className="mt-1 text-[22px] font-semibold leading-tight text-[var(--foreground)]">
                        {pageMode === "review"
                          ? activeJob?.folderLabel || "Select a workspace"
                          : "Upload a folder and let the studio prepare review-ready evidence"}
                      </h1>
                      <p className="mt-2 max-w-3xl text-[12px] leading-6 text-[var(--muted)]">
                        The current product still runs in the same multi-pass order: document
                        parsing, event bundling, bundle-level EB1A classification, then
                        document-level review tagging for keep/archive and criterion hints.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {pageMode === "dashboard" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleCancelProcess()}
                            disabled={!canCancelSelection && !hasAbortableProcessing}
                            className="setu-ghost-button rounded-[6px] px-3 py-2 text-[11px] font-medium disabled:opacity-40"
                          >
                            {activeJob?.status === "canceling" ? "Canceling..." : "Cancel"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSelectedWorkspace()}
                            disabled={!canDeleteSelectedWorkspace}
                            className="inline-flex items-center gap-2 rounded-[6px] border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isDeletingWorkspace ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            {isDeletingWorkspace ? "Deleting..." : "Delete workspace"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {pageMode === "dashboard" ? (
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                      <label className="block rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
                        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                          1. Candidate full name
                        </span>
                        <input
                          value={settingsDraft.candidateName}
                          onChange={(event) =>
                            setSettingsDraft((current) => ({
                              ...current,
                              candidateName: event.target.value,
                            }))
                          }
                          placeholder="Enter the beneficiary full name"
                          className="w-full rounded-[12px] border border-[var(--border-secondary)] bg-white px-3 py-3 text-[12px] outline-none transition focus:border-[var(--brand)]"
                        />
                        <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                          This is required before indexing starts and becomes the center point for
                          summaries, bundling, and review.
                        </p>
                      </label>

                      <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                              2. Choose folder
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                              Pick the evidence folder, then start indexing from this same box.
                            </p>
                          </div>
                          <span className="rounded-full border border-[var(--border-secondary)] bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                            {pendingStats ? "Selected" : "Waiting"}
                          </span>
                        </div>

                        <div className="mt-3 rounded-[14px] border border-[var(--border-secondary)] bg-white px-3 py-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                            Evidence folder
                          </p>
                          <p className="mt-1 truncate text-[13px] font-semibold text-[var(--foreground)]">
                            {pendingStats?.rootLabel ?? "No folder selected"}
                          </p>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-[12px] border border-[var(--border-secondary)] bg-white px-3 py-2.5">
                            <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
                              Files
                            </p>
                            <p className="mt-1 font-semibold text-[var(--foreground)]">
                              {pendingStats?.fileCount ?? 0}
                            </p>
                          </div>
                          <div className="rounded-[12px] border border-[var(--border-secondary)] bg-white px-3 py-2.5">
                            <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
                              Size
                            </p>
                            <p className="mt-1 font-semibold text-[var(--foreground)]">
                              {pendingStats ? formatBytes(pendingStats.totalBytes) : "0 B"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => folderInputRef.current?.click()}
                            className="setu-ghost-button inline-flex items-center gap-2 rounded-[8px] px-3 py-2 text-[11px] font-medium"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Choose folder
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleUpload()}
                            disabled={!canStartIndexing}
                            className="setu-primary-button inline-flex items-center gap-2 rounded-[8px] px-3 py-2 text-[11px] font-medium text-white disabled:opacity-40"
                          >
                            {isUploading ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            {isUploading ? "Indexing..." : "Index folder"}
                          </button>
                        </div>

                        <p className="mt-3 text-[10px] leading-5 text-[var(--muted)]">
                          {!candidateNameInput
                            ? "Enter the candidate name first, then choose a folder to unlock indexing."
                            : pendingStats
                              ? "Ready to create a new isolated workspace for this candidate."
                              : "Choose a folder to unlock indexing for this candidate."}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {pipelineCards.map((step, index) => (
                      <div key={step.key} className="flex items-center gap-2">
                        <div
                          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            step.status === "done" || step.status === "active"
                              ? "bg-[var(--brand-charcoal)] text-white"
                              : step.status === "problem"
                                ? "bg-[var(--state-danger-soft)] text-[var(--state-danger)]"
                                : "bg-[var(--paper-secondary)] text-[var(--ink-secondary)]"
                          }`}
                        >
                          {index + 1}. {step.label}
                        </div>
                        {index < pipelineCards.length - 1 ? (
                          <span className={`h-[2px] w-4 ${step.status === "done" ? "bg-[var(--brand)]" : "bg-[var(--border-secondary)]"}`} />
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2 lg:grid-cols-5">
                    {pipelineCards.map((step) => (
                      <div
                        key={`detail-${step.key}`}
                        className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-[var(--foreground)]">
                            {step.label}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${stageStatusClassName(
                            step.status === "active"
                              ? "processing"
                              : step.status === "done"
                                ? "completed"
                                : step.status === "problem"
                                  ? "failed"
                                  : "pending",
                          )}`}>
                            {step.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">
                          {step.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {pageMode === "dashboard" ? (
                <section className="grid gap-4 xl:items-start xl:grid-cols-[minmax(0,1.15fr)_340px]">
                  <div className="setu-paper-panel rounded-[18px] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Coverage
                        </p>
                        <div className="mt-2 flex items-end gap-3">
                          <p className="text-[34px] leading-none font-semibold text-[var(--brand-deep)]">
                            {library.coverage?.strongCount ?? 0}
                          </p>
                          <p className="pb-1 text-[12px] leading-5 text-[var(--muted)]">
                            of{" "}
                            {library.coverage?.criteria.length ??
                              EB1A_CRITERIA_DEFINITIONS.length}{" "}
                            criteria strong
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          library.coverage?.meetsMinimum
                            ? "bg-[var(--state-success-soft)] text-[var(--state-success)]"
                            : "bg-[var(--state-warning-soft)] text-[var(--state-warning)]"
                        }`}
                      >
                        {library.coverage?.meetsMinimum
                          ? "Meets 3-of-10 minimum"
                          : "Below minimum"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                      {(library.coverage?.criteria ?? []).map((criterion) => (
                        <button
                          key={criterion.code}
                          type="button"
                          onClick={() => {
                            setCriterionFilter(criterion.code);
                            if (classificationReady) {
                              setReadyView("by-criterion");
                            }
                          }}
                          className={`flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-[13px] ${
                            criterionFilter === criterion.code
                              ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
                              : "bg-[var(--paper-primary)] hover:bg-[var(--paper-secondary)]"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              criterion.state === "strong"
                                ? "bg-[var(--brand)]"
                                : criterion.state === "partial"
                                  ? "bg-[var(--state-warning)]"
                                  : "bg-[var(--border-primary)]"
                            }`}
                          />
                          <span className="font-mono text-[11px] text-[var(--muted)]">
                            {criterion.legalCode}
                          </span>
                          <span className="flex-1 truncate">{criterion.name}</span>
                          <span className="font-mono text-[11px] text-[var(--muted)]">
                            {criterion.keptCount}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="setu-paper-panel rounded-[18px] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Workspace state
                    </p>
                    <div className="mt-3 grid gap-2 text-[12px] leading-5 text-[var(--foreground)]">
                      <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                          Folder
                        </p>
                        <p className="mt-1 font-semibold text-[var(--foreground)]">
                          {activeJob?.folderLabel || "No folder selected"}
                        </p>
                      </div>
                      <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                          Last indexed
                        </p>
                        <p className="mt-1 font-semibold text-[var(--foreground)]">
                          {formatDateTime(library.overview.latestCompletionAt)}
                        </p>
                      </div>
                      <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                          Models
                        </p>
                        <p className="mt-1 text-[12px] text-[var(--foreground)]">
                          {library.settings.summaryModel}
                          <br />
                          {library.settings.embeddingModel}
                        </p>
                      </div>
                      <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                          Tagging cost
                        </p>
                        <p className="mt-1 font-semibold text-[var(--foreground)]">
                          {formatCurrency(library.criteriaTagging?.totalCostUsd ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeJob && !showReviewSurface ? (
                <section className="setu-panel rounded-[18px] p-4">
                  <div className="flex flex-col gap-3 border-b border-[var(--border-secondary)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Indexing progress
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
                        Latest updated evidence appears first. Scroll this pane to review completed
                        files while indexing continues.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                          Processed
                        </p>
                        <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
                          {activeJob.processedFiles}/{activeJob.totalFiles}
                        </p>
                      </div>
                      <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                          Initial indexing elapsed
                        </p>
                        <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
                          {indexingElapsedLabel}
                        </p>
                      </div>
                      <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                          Progress
                        </p>
                        <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
                          {Math.round(activeJobProgress)}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-[14px] border border-[var(--border-secondary)]">
                    <div className="max-h-[25rem] overflow-auto">
                      <table className="min-w-full text-left text-[12px]">
                        <thead className="sticky top-0 z-10 bg-[var(--paper-tertiary)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Evidence</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                            <th className="px-3 py-2 font-semibold">Updated</th>
                            <th className="px-3 py-2 font-semibold">Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {indexProgressDocuments.map((document) => (
                            <tr key={document.id} className="border-t border-[var(--border-secondary)]">
                              <td className="px-3 py-2 align-top">
                                <p className="font-semibold text-[var(--foreground)]">
                                  {document.summary?.title || document.fileName}
                                </p>
                                <p className="text-[10px] text-[var(--muted)]">
                                  {document.relativePath}
                                </p>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <span
                                  className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${documentStatusTone(
                                    document.processingStatus,
                                  )}`}
                                >
                                  {document.processingStatus}
                                </span>
                              </td>
                              <td className="px-3 py-2 align-top text-[11px] text-[var(--muted)]">
                                {formatDateTime(document.updatedAt)}
                              </td>
                              <td className="px-3 py-2 align-top text-[11px] text-[var(--muted)]">
                                {truncateText(
                                  document.summary?.shortSummary ||
                                    (document.processingStatus === "failed"
                                      ? document.error || "This file failed during indexing."
                                      : document.processingStatus === "completed"
                                        ? "Summary completed."
                                        : "Waiting for AI summary."),
                                  150,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              ) : null}

              {showReviewSurface ? (
                <section className="setu-panel rounded-[18px] p-4">
                  <div className="flex flex-col gap-3 border-b border-[var(--border-secondary)] pb-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Ready review
                        </p>
                        <h2 className="mt-1 text-[18px] font-semibold text-[var(--foreground)]">
                          {classificationReady
                            ? "Evidence criteria -> event bundles -> files"
                            : "Event bundles -> files"}
                        </h2>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                          Review keeps the current folder isolated. Search narrows the current
                          workspace only, while drag/drop and right-click keep manual overrides
                          available at any point.
                        </p>
                      </div>
                      {pageMode === "review" ? (
                        <form onSubmit={handleSemanticSearch} className="flex w-full max-w-[560px] gap-2">
                          <input
                            value={semanticQuery}
                            onChange={(event) => setSemanticQuery(event.target.value)}
                            placeholder="Search by meaning inside this workspace"
                            className="min-w-0 flex-1 rounded-[6px] border border-[var(--border-primary)] bg-[var(--paper-tertiary)] px-4 py-2 text-[12px] outline-none"
                          />
                          <button
                            type="submit"
                            disabled={isSearching}
                            className="setu-primary-button rounded-[6px] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
                          >
                            {isSearching ? "Searching" : "Search meaning"}
                          </button>
                        </form>
                      ) : reviewWorkspaceHref ? (
                        <Link
                          href={reviewWorkspaceHref}
                          className="setu-ghost-button rounded-[6px] px-3 py-2 text-[11px] font-semibold"
                        >
                          Open detailed search
                        </Link>
                      ) : null}
                    </div>

                    <div className="rounded-[14px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-4 py-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="pr-4">
                            <p className="text-[18px] font-semibold text-[var(--brand-deep)]">
                              {taggedDocumentCount}
                            </p>
                            <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                              Tagged files
                            </p>
                          </div>
                          <div className="border-l border-[var(--brand)]/20 pl-4">
                            <p className="text-[18px] font-semibold text-[var(--brand-deep)]">
                              {confidentDocumentIds.length}
                            </p>
                            <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                              Confident
                            </p>
                          </div>
                          <div className="border-l border-[var(--brand)]/20 pl-4">
                            <p className="text-[18px] font-semibold text-[var(--brand-deep)]">
                              {pendingReviewDocumentCount}
                            </p>
                            <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                              Need review
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void persistEvidenceStatus(confidentDocumentIds, "kept");
                              setStatusFilter("pending");
                            }}
                            className="setu-primary-button rounded-[6px] px-3 py-2 text-[11px] font-semibold text-white"
                          >
                            Accept confident
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatusFilter("pending")}
                            className="setu-ghost-button rounded-[6px] px-3 py-2 text-[11px] font-semibold"
                          >
                            Review uncertain
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex overflow-hidden rounded-[6px] border border-[var(--border-primary)] bg-[var(--paper-primary)]">
                          <button
                            type="button"
                            onClick={() => setReadyView("by-bundle")}
                            className={`px-3 py-1.5 text-[11px] font-semibold ${effectiveReadyView === "by-bundle" ? "bg-[var(--paper-secondary)] text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                          >
                            By bundle
                          </button>
                          <button
                            type="button"
                            onClick={() => classificationReady && setReadyView("by-criterion")}
                            className={`border-l border-[var(--border-primary)] px-3 py-1.5 text-[11px] font-semibold ${effectiveReadyView === "by-criterion" ? "bg-[var(--paper-secondary)] text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                          >
                            By criterion
                          </button>
                        </div>
                        {(["all", "kept", "pending", "archived"] as const).map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setStatusFilter(filter)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusFilter === filter ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--muted)]"}`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                      <input
                        value={quickFilter}
                        onChange={(event) => setQuickFilter(event.target.value)}
                        placeholder="Filter by bundle, file, tag, org, or path"
                        className="w-full max-w-[420px] rounded-[6px] border border-[var(--border-primary)] bg-[var(--paper-tertiary)] px-4 py-2 text-[12px] outline-none"
                      />
                    </div>

                    {selectedEvidenceIds.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-[var(--foreground)] px-3 py-2 text-[11px] text-white">
                        <span className="font-mono font-semibold">{selectedEvidenceIds.length}</span>
                        <span>selected</span>
                        <div className="ml-auto flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void persistEvidenceStatus(selectedEvidenceIds, "kept")}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            onClick={() => void persistEvidenceStatus(selectedEvidenceIds, "pending")}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1"
                          >
                            Pending
                          </button>
                          <button
                            type="button"
                            onClick={() => void persistEvidenceStatus(selectedEvidenceIds, "archived")}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1"
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            disabled={!canGroupSelection}
                            onClick={() =>
                              setSubBundleDialog({
                                open: true,
                                bundleId: selectionBundleId,
                                documentIds: selectedEvidenceIds,
                              })
                            }
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 disabled:opacity-40"
                          >
                            Group into sub-bundle
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedEvidenceIds([])}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {effectiveReadyView === "by-criterion" && classificationReady ? (
                      reviewCriterionBuckets.map((bucket) => {
                        const expanded = expandedBucketIds[bucket.bucketCode] ?? true;
                        return (
                          <div
                            key={bucket.bucketCode}
                            onDragOver={(event) => {
                              if (dragState?.type !== "bundle") {
                                return;
                              }
                              event.preventDefault();
                              setActiveDropTarget({ kind: "bucket", id: bucket.bucketCode });
                            }}
                            onDrop={(event) => {
                              if (
                                dragState?.type !== "bundle" ||
                                !activeJobId ||
                                dragState.sourceBucketCode === bucket.bucketCode
                              ) {
                                return;
                              }
                              event.preventDefault();
                              void applyManualOverride(
                                {
                                  jobId: activeJobId,
                                  type: "bundle-category",
                                  bundleId: dragState.bundleId,
                                  bucketCode: bucket.bucketCode,
                                },
                                `Bundle moved to ${bucket.bucketName}.`,
                              );
                            }}
                            className={`rounded-[16px] border border-[#ebe9e2] bg-white ${activeDropTarget?.kind === "bucket" && activeDropTarget.id === bucket.bucketCode ? "ring-2 ring-[var(--brand)]/30" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBucketIds((current) => ({
                                  ...current,
                                  [bucket.bucketCode]: !expanded,
                                }))
                              }
                              className="flex w-full items-start gap-3 px-4 py-3 text-left"
                            >
                              {expanded ? (
                                <ChevronDown className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
                              ) : (
                                <ChevronRight className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
                              )}
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                    {bucket.bucketCode} · {bucket.bucketName}
                                  </span>
                                  <span className="rounded-full border border-[#ebe9e2] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                    {bucket.bundles.length} bundle(s)
                                  </span>
                                  <span className="rounded-full border border-[#ebe9e2] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                    {bucket.fileCount} file(s)
                                  </span>
                                </div>
                                <p className="mt-2 text-[13px] font-semibold text-[var(--foreground)]">
                                  {bucket.bucketName}
                                </p>
                              </div>
                            </button>

                            {expanded ? (
                              <div className="border-t border-[#f0eee7] px-3 py-3">
                                <div className="space-y-3">
                                  {bucket.bundles.map((bundle) => {
                                    const expandedBundle = expandedBundleIds[bundle.id] ?? false;
                                    return (
                                      <div
                                        key={bundle.id}
                                        onDragOver={(event) => {
                                          if (dragState?.type !== "document") {
                                            return;
                                          }
                                          event.preventDefault();
                                          setActiveDropTarget({ kind: "bundle", id: bundle.id });
                                        }}
                                        onDrop={(event) => {
                                          if (
                                            dragState?.type !== "document" ||
                                            dragState.sourceBundleId === bundle.id
                                          ) {
                                            return;
                                          }
                                          event.preventDefault();
                                          void moveEvidenceDocuments([dragState.documentId], bundle.id);
                                        }}
                                        className={`rounded-[14px] border border-[#ebe9e2] bg-[#fcfbf8] ${activeDropTarget?.kind === "bundle" && activeDropTarget.id === bundle.id ? "ring-2 ring-[var(--brand)]/30" : ""}`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedBundleIds((current) => ({
                                              ...current,
                                              [bundle.id]: !expandedBundle,
                                            }))
                                          }
                                          className="flex w-full items-start gap-3 px-3 py-3 text-left"
                                        >
                                          <span
                                            draggable
                                            onDragStart={() =>
                                              setDragState({
                                                type: "bundle",
                                                bundleId: bundle.id,
                                                sourceBucketCode: bucket.bucketCode,
                                              })
                                            }
                                            onDragEnd={() => {
                                              setDragState(null);
                                              setActiveDropTarget(null);
                                            }}
                                            className="cursor-grab text-[var(--muted)]"
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </span>
                                          {expandedBundle ? (
                                            <ChevronDown className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
                                          ) : (
                                            <ChevronRight className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
                                          )}
                                          <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                Event bundle
                                              </span>
                                              <span className="rounded-full bg-[#eef4ff] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                {bundle.eventType}
                                              </span>
                                              <span className="rounded-full bg-[#ecfbf1] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                                {formatPrimaryDate(bundle.latestRelevantDate)}
                                              </span>
                                            </div>
                                            <p className="mt-2 text-[13px] font-semibold text-[var(--foreground)]">
                                              {bundle.name}
                                            </p>
                                            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                                              {truncateText(
                                                bundle.detailedSummary || bundle.shortSummary,
                                                220,
                                              )}
                                            </p>
                                          </div>
                                        </button>
                                        {expandedBundle ? (
                                          <div className="border-t border-[#f0eee7] px-3 py-3">
                                            <div className="space-y-2">
                                              {[...bundle.subBundles, { id: `${bundle.id}-root`, name: "Files", documents: bundle.rootDocuments }].map((group) => (
                                                <div key={group.id} className="space-y-2">
                                                  {"rootDocuments" in bundle && group.id !== `${bundle.id}-root` ? (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setExpandedSubBundleIds((current) => ({
                                                          ...current,
                                                          [group.id]: !current[group.id],
                                                        }))
                                                      }
                                                      className="flex w-full items-center gap-2 rounded-[12px] bg-white px-3 py-2 text-left"
                                                    >
                                                      {expandedSubBundleIds[group.id] ?? true ? (
                                                        <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
                                                      ) : (
                                                        <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
                                                      )}
                                                      <span className="text-[11px] font-semibold text-[var(--foreground)]">
                                                        {group.name}
                                                      </span>
                                                      <span className="rounded-full border border-[#ebe9e2] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                        {group.documents.length}
                                                      </span>
                                                    </button>
                                                  ) : null}
                                                  {(group.id === `${bundle.id}-root` || (expandedSubBundleIds[group.id] ?? true)) ? (
                                                    group.documents.map((document) => (
                                                      <div
                                                        key={document.id}
                                                        draggable
                                                        onDragStart={() =>
                                                          setDragState({
                                                            type: "document",
                                                            documentId: document.id,
                                                            sourceBundleId: bundle.id,
                                                          })
                                                        }
                                                        onDragEnd={() => {
                                                          setDragState(null);
                                                          setActiveDropTarget(null);
                                                        }}
                                                        onContextMenu={(event) =>
                                                          openEvidenceContextMenu(event, document.id, bundle.id)
                                                        }
                                                        className={`grid grid-cols-[20px_1fr_auto_auto_28px] items-center gap-3 rounded-[12px] border border-[#ebe9e2] bg-white px-3 py-2 ${selectedEvidenceSet.has(document.id) ? "bg-[var(--brand-soft)]/55" : ""} ${document.reviewStatus === "archived" ? "opacity-60" : ""}`}
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          checked={selectedEvidenceSet.has(document.id)}
                                                          onChange={() =>
                                                            selectEvidenceDocument(document.id, "toggle")
                                                          }
                                                          className="h-3.5 w-3.5 rounded border-slate-300"
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            selectEvidenceDocument(document.id, "replace");
                                                            openPreview(document.id);
                                                          }}
                                                          className="min-w-0 text-left"
                                                        >
                                                          <p className="truncate text-[12px] font-semibold text-[var(--foreground)]">
                                                            {document.summary?.title || document.fileName}
                                                          </p>
                                                          <p className="truncate text-[10px] text-[var(--muted)]">
                                                            {document.summary?.shortSummary || document.relativePath}
                                                          </p>
                                                          <div className="mt-1 flex flex-wrap gap-1">
                                                            {(document.criteriaTags.length ? document.criteriaTags : []).slice(0, 3).map((criterion) => (
                                                              <button
                                                                key={`${document.id}-${criterion.code}`}
                                                                type="button"
                                                                onClick={(event) => {
                                                                  event.stopPropagation();
                                                                  void cycleCriterionForDocument(document, criterion.code);
                                                                }}
                                                                className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${criterionChipTone(
                                                                  criterion.role,
                                                                  criterion.source,
                                                                )}`}
                                                              >
                                                                {criterion.legalCode} {criterion.role}
                                                              </button>
                                                            ))}
                                                          </div>
                                                        </button>
                                                        <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${reviewStatusTone(document.reviewStatus)}`}>
                                                          {document.reviewStatus}
                                                        </span>
                                                        <button
                                                          type="button"
                                                          onClick={() => openPreview(document.id)}
                                                          className="rounded-full border border-[#ebe9e2] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
                                                        >
                                                          Peek
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={(event) =>
                                                            openEvidenceContextMenu(event, document.id, bundle.id)
                                                          }
                                                          className="text-[16px] text-[var(--muted)]"
                                                        >
                                                          ⋯
                                                        </button>
                                                      </div>
                                                    ))
                                                  ) : null}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      reviewBundleViews.map((bundle) => {
                        const expandedBundle = expandedBundleIds[bundle.id] ?? true;
                        return (
                          <div
                            key={bundle.id}
                            onDragOver={(event) => {
                              if (dragState?.type !== "document") {
                                return;
                              }
                              event.preventDefault();
                              setActiveDropTarget({ kind: "bundle", id: bundle.id });
                            }}
                            onDrop={(event) => {
                              if (
                                dragState?.type !== "document" ||
                                dragState.sourceBundleId === bundle.id
                              ) {
                                return;
                              }
                              event.preventDefault();
                              void moveEvidenceDocuments([dragState.documentId], bundle.id);
                            }}
                            className={`rounded-[16px] border border-[#ebe9e2] bg-white ${activeDropTarget?.kind === "bundle" && activeDropTarget.id === bundle.id ? "ring-2 ring-[var(--brand)]/30" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBundleIds((current) => ({
                                  ...current,
                                  [bundle.id]: !expandedBundle,
                                }))
                              }
                              className="flex w-full items-start gap-3 px-4 py-3 text-left"
                            >
                              {expandedBundle ? (
                                <ChevronDown className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
                              ) : (
                                <ChevronRight className="mt-0.5 h-4 w-4 text-[var(--muted)]" />
                              )}
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                    Event bundle
                                  </span>
                                  <span className="rounded-full bg-[#eef4ff] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                    {bundle.eventType}
                                  </span>
                                  <span className="rounded-full bg-[#ecfbf1] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                    {formatPrimaryDate(bundle.latestRelevantDate)}
                                  </span>
                                  <span className="rounded-full border border-[#ebe9e2] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                    {bundle.filteredDocuments.length} file(s)
                                  </span>
                                </div>
                                <p className="mt-2 text-[14px] font-semibold text-[var(--foreground)]">
                                  {bundle.name}
                                </p>
                                <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                                  {truncateText(bundle.detailedSummary || bundle.shortSummary, 220)}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {compactList(bundle.keywords, 6).map((keyword) => (
                                    <span
                                      key={`${bundle.id}-${keyword}`}
                                      className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </button>

                            {expandedBundle ? (
                              <div className="border-t border-[#f0eee7] px-3 py-3">
                                <div className="mb-3 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
                                  <p>
                                    Right-click a file for triage, tagging, or move actions. Drag a
                                    file into another bundle to override the event assignment.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSubBundleDialog({
                                        open: true,
                                        bundleId: bundle.id,
                                        documentIds: [],
                                      })
                                    }
                                    className="rounded-full border border-[#ebe9e2] bg-white px-3 py-1 text-[10px] font-semibold text-[var(--foreground)]"
                                  >
                                    Add sub-bundle
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {[...bundle.subBundles, { id: `${bundle.id}-root`, name: "Files", documents: bundle.rootDocuments }].map((group) => (
                                    <div key={group.id} className="space-y-2">
                                      {group.id !== `${bundle.id}-root` ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedSubBundleIds((current) => ({
                                              ...current,
                                              [group.id]: !current[group.id],
                                            }))
                                          }
                                          className="flex w-full items-center gap-2 rounded-[12px] bg-[#faf9f5] px-3 py-2 text-left"
                                        >
                                          {expandedSubBundleIds[group.id] ?? true ? (
                                            <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
                                          )}
                                          <span className="text-[11px] font-semibold text-[var(--foreground)]">
                                            {group.name}
                                          </span>
                                          <span className="rounded-full border border-[#ebe9e2] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                            {group.documents.length}
                                          </span>
                                        </button>
                                      ) : null}

                                      {(group.id === `${bundle.id}-root` || (expandedSubBundleIds[group.id] ?? true)) ? (
                                        group.documents.map((document) => (
                                          <div
                                            key={document.id}
                                            draggable
                                            onDragStart={() =>
                                              setDragState({
                                                type: "document",
                                                documentId: document.id,
                                                sourceBundleId: bundle.id,
                                              })
                                            }
                                            onDragEnd={() => {
                                              setDragState(null);
                                              setActiveDropTarget(null);
                                            }}
                                            onContextMenu={(event) =>
                                              openEvidenceContextMenu(event, document.id, bundle.id)
                                            }
                                            className={`grid grid-cols-[20px_minmax(0,1fr)_auto_auto_28px] items-center gap-3 rounded-[12px] border border-[#ebe9e2] px-3 py-2 ${selectedEvidenceSet.has(document.id) ? "bg-[var(--brand-soft)]/55" : "bg-white"} ${document.reviewStatus === "archived" ? "opacity-60" : ""}`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={selectedEvidenceSet.has(document.id)}
                                              onChange={() =>
                                                selectEvidenceDocument(document.id, "toggle")
                                              }
                                              className="h-3.5 w-3.5 rounded border-slate-300"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                selectEvidenceDocument(document.id, "replace");
                                                openPreview(document.id);
                                              }}
                                              className="min-w-0 text-left"
                                            >
                                              <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-[12px] font-semibold text-[var(--foreground)]">
                                                  {document.summary?.title || document.fileName}
                                                </p>
                                                <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${reviewStatusTone(document.reviewStatus)}`}>
                                                  {document.reviewStatus}
                                                </span>
                                              </div>
                                              <p className="truncate text-[10px] text-[var(--muted)]">
                                                {document.relativePath}
                                              </p>
                                              <p className="mt-1 text-[11px] leading-5 text-[var(--foreground)]/85">
                                                {truncateText(
                                                  document.summary?.shortSummary || "Summary pending.",
                                                  170,
                                                )}
                                              </p>
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {document.criteriaTags.slice(0, 4).map((criterion) => (
                                                  <button
                                                    key={`${document.id}-${criterion.code}`}
                                                    type="button"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      void cycleCriterionForDocument(document, criterion.code);
                                                    }}
                                                    className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${criterionChipTone(
                                                      criterion.role,
                                                      criterion.source,
                                                    )}`}
                                                  >
                                                    {criterion.legalCode} {criterion.role}
                                                  </button>
                                                ))}
                                              </div>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void persistEvidenceStatus([document.id], "kept")}
                                              className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${document.reviewStatus === "kept" ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "border-[#ebe9e2] bg-white text-[var(--foreground)]"}`}
                                            >
                                              Keep
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => openPreview(document.id)}
                                              className="rounded-full border border-[#ebe9e2] bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
                                            >
                                              Quick peek
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(event) =>
                                                openEvidenceContextMenu(event, document.id, bundle.id)
                                              }
                                              className="text-[16px] text-[var(--muted)]"
                                            >
                                              ⋯
                                            </button>
                                          </div>
                                        ))
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}

                    {!reviewBundleViews.length && !(effectiveReadyView === "by-criterion" && reviewCriterionBuckets.length) ? (
                      <div className="rounded-[16px] border border-dashed border-[#ded9cb] bg-[#faf9f5] px-4 py-8 text-center text-[12px] text-[var(--muted)]">
                        No evidence matches the current view and filters.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </main>

            <aside className="relative space-y-4">
              <button
                type="button"
                aria-label="Resize right panel"
                onMouseDown={(event) => startPanelResize("right", event)}
                className="absolute -left-2 top-0 hidden h-full w-4 cursor-col-resize items-center justify-center xl:flex"
              >
                <span
                  className={`setu-resize-handle flex h-16 w-2 items-center justify-center rounded-full border transition ${
                    resizingPanel?.panel === "right"
                      ? "is-active"
                      : ""
                  }`}
                >
                  <GripVertical className="h-3 w-3" />
                </span>
              </button>
              {pageMode === "dashboard" ? (
                <>
                  <div className="setu-paper-panel rounded-[18px] p-3 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Workspace cost
                    </p>
                    <div className="mt-3 space-y-2 text-[11px] leading-5 text-[var(--foreground)]">
                      <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--paper-primary)] px-3 py-2">
                        <span>Summaries</span>
                        <span className="font-mono">{formatCurrency(library.overview.totalOpenAiCostUsd)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--paper-primary)] px-3 py-2">
                        <span>Bundling</span>
                        <span className="font-mono">{formatCurrency(library.eventBundles?.totalCostUsd ?? 0)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--paper-primary)] px-3 py-2">
                        <span>Classification</span>
                        <span className="font-mono">{formatCurrency(library.eb1aClassification?.totalCostUsd ?? 0)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--paper-primary)] px-3 py-2">
                        <span>Tagging</span>
                        <span className="font-mono">{formatCurrency(library.criteriaTagging?.totalCostUsd ?? 0)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-3 py-2 text-[var(--brand-deep)]">
                        <span className="font-medium">Total</span>
                        <span className="font-mono font-semibold">{formatCurrency(workspaceTotalAiCost)}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="setu-paper-panel rounded-[18px] p-3 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Coverage
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-[24px] font-semibold text-[var(--brand-deep)]">
                        {library.coverage?.strongCount ?? 0}
                      </p>
                      <p className="text-[10px] leading-4 text-[var(--muted)]">
                        of {library.coverage?.criteria.length ?? EB1A_CRITERIA_DEFINITIONS.length} criteria strong
                      </p>
                    </div>
                    <div className="mt-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                          library.coverage?.meetsMinimum
                            ? "bg-[var(--state-success-soft)] text-[var(--state-success)]"
                            : "bg-[var(--state-warning-soft)] text-[var(--state-warning)]"
                        }`}
                      >
                        {library.coverage?.meetsMinimum ? "Meets 3-of-10 minimum" : "Below minimum"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {(library.coverage?.criteria ?? []).map((criterion) => (
                        <button
                          key={criterion.code}
                          type="button"
                          onClick={() => {
                            setCriterionFilter(criterion.code);
                            if (classificationReady) {
                              setReadyView("by-criterion");
                            }
                          }}
                          className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[11px] ${
                            criterionFilter === criterion.code
                              ? "bg-[var(--paper-secondary)] text-[var(--foreground)]"
                              : "hover:bg-[var(--paper-primary)]"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              criterion.state === "strong"
                                ? "bg-[var(--brand)]"
                                : criterion.state === "partial"
                                  ? "bg-[var(--state-warning)]"
                                  : "bg-[var(--border-primary)]"
                            }`}
                          />
                          <span className="font-mono text-[10px] text-[var(--muted)]">
                            {criterion.legalCode}
                          </span>
                          <span className="flex-1 truncate">{criterion.name}</span>
                          <span className="font-mono text-[10px] text-[var(--muted)]">
                            {criterion.keptCount}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="setu-paper-panel rounded-[18px] p-3 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Workspace state
                    </p>
                    <div className="mt-3 space-y-2 text-[11px] leading-5 text-[var(--foreground)]">
                      <p>
                        <span className="font-semibold">Folder:</span>{" "}
                        {activeJob?.folderLabel || "No folder selected"}
                      </p>
                      <p>
                        <span className="font-semibold">Last indexed:</span>{" "}
                        {formatDateTime(library.overview.latestCompletionAt)}
                      </p>
                      <p>
                        <span className="font-semibold">Models:</span>{" "}
                        {library.settings.summaryModel}
                        <br />
                        {library.settings.embeddingModel}
                      </p>
                      <p>
                        <span className="font-semibold">Tagging cost:</span>{" "}
                        {formatCurrency(library.criteriaTagging?.totalCostUsd ?? 0)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>

          {contextMenu.open ? (
            <div
              ref={contextMenuRef}
              className="fixed z-50 max-h-[calc(100vh-24px)] min-w-[240px] overflow-y-auto rounded-[12px] border border-[#e7e3d9] bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
              style={{ left: contextMenuLayout.left, top: contextMenuLayout.top }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  if (contextMenu.documentIds[0]) {
                    openPreview(contextMenu.documentIds[0]);
                  }
                  closeContextMenu();
                }}
                className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)]"
              >
                <span>Open Quick Peek</span>
                <span className="font-mono text-[10px] text-[var(--muted)]">Space</span>
              </button>
              <div className="my-1 h-px bg-[#eee9df]" />
              <button
                type="button"
                onClick={() => {
                  void persistEvidenceStatus(contextMenu.documentIds, "kept");
                  closeContextMenu();
                }}
                className="block w-full rounded-[8px] px-3 py-2 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)]"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => {
                  void persistEvidenceStatus(contextMenu.documentIds, "pending");
                  closeContextMenu();
                }}
                className="block w-full rounded-[8px] px-3 py-2 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)]"
              >
                Mark pending
              </button>
              <button
                type="button"
                onClick={() => {
                  void persistEvidenceStatus(contextMenu.documentIds, "archived");
                  closeContextMenu();
                }}
                className="block w-full rounded-[8px] px-3 py-2 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)]"
              >
                Archive
              </button>
              <div className="my-1 h-px bg-[#eee9df]" />
              <button
                type="button"
                ref={criterionMenuTriggerRef}
                onMouseEnter={() =>
                  setContextMenu((current) => ({ ...current, submenu: "criterion" }))
                }
                className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)]"
              >
                <span>Tag criterion</span>
                <span>›</span>
              </button>
              <button
                type="button"
                ref={bundleMenuTriggerRef}
                onMouseEnter={() =>
                  setContextMenu((current) => ({ ...current, submenu: "bundle" }))
                }
                className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)]"
              >
                <span>Move to bundle</span>
                <span>›</span>
              </button>
              <button
                type="button"
                disabled={!canGroupSelection}
                onClick={() => {
                  setSubBundleDialog({
                    open: true,
                    bundleId: selectionBundleId,
                    documentIds: contextMenu.documentIds,
                  });
                  closeContextMenu();
                }}
                className="block w-full rounded-[8px] px-3 py-2 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)] disabled:opacity-40"
              >
                Group into sub-bundle
              </button>

              {contextMenu.submenu === "criterion" ? (
                <div
                  ref={criterionSubmenuRef}
                  className="absolute z-10 max-h-[calc(100vh-24px)] min-w-[250px] overflow-y-auto rounded-[12px] border border-[#e7e3d9] bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
                  style={{
                    top: contextMenuLayout.criterionTop,
                    left:
                      contextMenuLayout.submenuDirection === "right"
                        ? `calc(100% + ${CONTEXT_SUBMENU_GAP}px)`
                        : "auto",
                    right:
                      contextMenuLayout.submenuDirection === "left"
                        ? `calc(100% + ${CONTEXT_SUBMENU_GAP}px)`
                        : "auto",
                  }}
                >
                  {EB1A_CRITERIA_DEFINITIONS.map((criterion) => (
                    <button
                      key={criterion.code}
                      type="button"
                      onClick={() => {
                        const document = library.documents.find(
                          (entry) => entry.id === contextMenu.documentIds[0],
                        );
                        if (document) {
                          void cycleCriterionForDocument(document, criterion.code, "primary");
                        }
                        closeContextMenu();
                      }}
                      className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)]"
                    >
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {criterion.legalCode}
                      </span>
                      <span>{criterion.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {contextMenu.submenu === "bundle" ? (
                <div
                  ref={bundleSubmenuRef}
                  className="absolute z-10 max-h-[calc(100vh-24px)] min-w-[250px] overflow-y-auto rounded-[12px] border border-[#e7e3d9] bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
                  style={{
                    top: contextMenuLayout.bundleTop,
                    left:
                      contextMenuLayout.submenuDirection === "right"
                        ? `calc(100% + ${CONTEXT_SUBMENU_GAP}px)`
                        : "auto",
                    right:
                      contextMenuLayout.submenuDirection === "left"
                        ? `calc(100% + ${CONTEXT_SUBMENU_GAP}px)`
                        : "auto",
                  }}
                >
                  {reviewBundleViews.map((bundle) => (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => {
                        void moveEvidenceDocuments(contextMenu.documentIds, bundle.id);
                        closeContextMenu();
                      }}
                      className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[12px] text-[var(--foreground)] hover:bg-[var(--brand-soft)]"
                    >
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {bundle.eventType}
                      </span>
                      <span className="truncate">{bundle.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {subBundleDialog.open ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f1328]/28 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-[18px] border border-white/80 bg-white p-5 shadow-[0_22px_50px_rgba(15,23,42,0.16)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  New sub-bundle
                </p>
                <h3 className="mt-2 text-[20px] font-semibold text-[var(--foreground)]">
                  Group evidence inside the event
                </h3>
                <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">
                  Sub-bundles stay one level deep and only organize files inside a single parent
                  event bundle.
                </p>
                <input
                  value={subBundleNameDraft}
                  onChange={(event) => setSubBundleNameDraft(event.target.value)}
                  placeholder="Example: Production systems"
                  className="mt-4 w-full rounded-[14px] border border-[#e7e3d9] bg-[#faf9f5] px-4 py-3 text-[12px] outline-none"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubBundleDialog({ open: false, bundleId: null, documentIds: [] });
                      setSubBundleNameDraft("");
                    }}
                    className="rounded-full border border-[#e7e3d9] px-3 py-2 text-[11px] font-semibold text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void createSubBundleFromSelection()}
                    className="rounded-full bg-[var(--brand)] px-3 py-2 text-[11px] font-semibold text-white"
                  >
                    Save sub-bundle
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isPreviewOpen && selectedDocument ? (
            <div className="fixed inset-0 z-30 bg-[#0f1328]/26 backdrop-blur-[1px]">
              <div className="absolute inset-y-0 right-0 flex w-full max-w-[980px] flex-col border-l border-white/80 bg-white shadow-[0_0_50px_rgba(15,23,42,0.16)]">
                <div className="flex items-center gap-3 border-b border-[#f0eee7] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className="rounded-full border border-[#e7e3d9] px-2 py-1 text-[11px] font-semibold"
                  >
                    Close
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                      {selectedDocument.summary?.title || selectedDocument.fileName}
                    </p>
                    <p className="truncate text-[10px] text-[var(--muted)]">
                      {selectedDocument.relativePath}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void saveDocumentMeta(selectedDocument.id, {
                        isPinned: !selectedDocument.isPinned,
                      })
                    }
                    className="rounded-full border border-[#e7e3d9] px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground)]"
                  >
                    {selectedDocument.isPinned ? "Pinned" : "Pin to brief"}
                  </button>
                  {sourceUrl ? (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[#e7e3d9] px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground)]"
                    >
                      Open original
                    </a>
                  ) : null}
                </div>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="min-h-0 border-r border-[#f0eee7] bg-[#faf9f5] p-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                      <button className="rounded-full border border-[#e7e3d9] bg-white px-2 py-1">
                        Fit
                      </button>
                      <button className="rounded-full border border-[#e7e3d9] bg-white px-2 py-1">
                        100%
                      </button>
                    </div>
                    <div className="h-[calc(100vh-180px)] overflow-hidden rounded-[16px] border border-[#e7e3d9] bg-white">
                      {previewUrl ? (
                        <iframe
                          key={previewUrl}
                          src={previewUrl}
                          className="h-full w-full"
                          title={selectedDocument.fileName}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[12px] text-[var(--muted)]">
                          Preview unavailable.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-h-0 overflow-y-auto p-4">
                    <div className="mb-4 flex gap-2 border-b border-[#f0eee7] pb-3">
                      {(["summary", "criteria", "citations", "notes"] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setPeekTab(tab)}
                          className={`px-2 py-1 text-[11px] font-semibold ${peekTab === tab ? "text-[var(--brand-deep)]" : "text-[var(--muted)]"}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {peekTab === "summary" ? (
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Short summary
                          </p>
                          <p className="mt-2 text-[12px] leading-6 text-[var(--foreground)]">
                            {selectedDocument.summary?.shortSummary || "Summary unavailable."}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Detailed summary
                          </p>
                          <p className="mt-2 text-[12px] leading-6 text-[var(--foreground)]">
                            {selectedDocument.summary?.detailedSummary || "Detailed summary unavailable."}
                          </p>
                        </div>
                        <div className="rounded-[14px] border border-[#ece8dd] bg-[#faf9f5] p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Key facts
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(selectedDocument.summary?.notableFacts ?? []).length ? (
                              (selectedDocument.summary?.notableFacts ?? []).map((fact) => (
                                <span
                                  key={fact}
                                  className="rounded-full bg-white px-2 py-1 text-[10px] text-[var(--foreground)]"
                                >
                                  {fact}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-[var(--muted)]">No facts extracted.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {peekTab === "criteria" ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDocument.criteriaTags.map((criterion) => (
                            <button
                              key={`${selectedDocument.id}-${criterion.code}`}
                              type="button"
                              onClick={() =>
                                void cycleCriterionForDocument(selectedDocument, criterion.code)
                              }
                              className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${criterionChipTone(
                                criterion.role,
                                criterion.source,
                              )}`}
                            >
                              {criterion.legalCode} {criterion.name} · {criterion.role}
                            </button>
                          ))}
                          {EB1A_CRITERIA_DEFINITIONS.filter(
                            (criterion) =>
                              !selectedDocument.criteriaTags.some(
                                (tag) => tag.code === criterion.code,
                              ),
                          )
                            .slice(0, 4)
                            .map((criterion) => (
                              <button
                                key={`add-${criterion.code}`}
                                type="button"
                                onClick={() =>
                                  void cycleCriterionForDocument(
                                    selectedDocument,
                                    criterion.code,
                                    "primary",
                                  )
                                }
                                className="rounded-full border border-dashed border-[#d8d3c6] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
                              >
                                + {criterion.legalCode}
                              </button>
                            ))}
                        </div>
                        <div className="space-y-2">
                          {selectedDocument.criteriaTags.length ? (
                            selectedDocument.criteriaTags.map((criterion) => (
                              <div
                                key={`why-${criterion.code}`}
                                className="rounded-[14px] border border-[#ece8dd] bg-[#faf9f5] p-3"
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2b62b5]">
                                  {criterion.legalCode} {criterion.role} · {confidenceBand(criterion.confidence)}
                                </p>
                                <p className="mt-2 text-[12px] leading-6 text-[var(--foreground)]">
                                  {criterion.source === "manual" ? "[manual override] " : ""}
                                  {criterion.reasoning}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-[12px] text-[var(--muted)]">
                              No file-level criteria were tagged for this document yet.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {peekTab === "citations" ? (
                      <div className="space-y-3">
                        <p className="text-[12px] leading-6 text-[var(--muted)]">
                          This tab shows downstream references and current bundle placement.
                        </p>
                        {selectedEventBundle ? (
                          <div className="rounded-[14px] border border-[#ece8dd] bg-[#faf9f5] p-3 text-[11px] leading-6 text-[var(--foreground)]">
                            <p>
                              <span className="font-semibold">Event bundle:</span>{" "}
                              {selectedEventBundle.name}
                            </p>
                            {selectedBundleDecision ? (
                              <p>
                                <span className="font-semibold">Criterion:</span>{" "}
                                {decisionBucketLabel(selectedBundleDecision)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {peekTab === "notes" ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Reviewer notes
                        </p>
                        <textarea
                          defaultValue={selectedDocument.notes}
                          onBlur={(event) =>
                            void saveDocumentMeta(selectedDocument.id, {
                              notes: event.target.value,
                            })
                          }
                          rows={10}
                          className="mt-3 w-full rounded-[14px] border border-[#e7e3d9] bg-[#faf9f5] px-4 py-3 text-[12px] leading-6 outline-none"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-[#f0eee7] px-4 py-3">
                  {(["kept", "pending", "archived"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void persistEvidenceStatus([selectedDocument.id], status)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${selectedDocument.reviewStatus === status ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "border-[#e7e3d9] text-[var(--foreground)]"}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {settingsOpen ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f1328]/28 p-4 backdrop-blur-sm">
              <div className="flex max-h-[92vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-[20px] border border-white/80 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.16)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#f0eee7] px-5 py-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Prompt library
                    </p>
                    <h3 className="mt-2 text-[22px] font-semibold text-[var(--foreground)]">
                      Keep the core intelligence local and editable
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="rounded-full border border-[#e7e3d9] px-3 py-1.5 text-[11px] font-semibold"
                  >
                    Close
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                    <div className="space-y-4">
                      {[
                        {
                          label: "Document summary prompt",
                          value: settingsDraft.summaryPrompt,
                          reset: DEFAULT_SUMMARY_PROMPT_TEMPLATE,
                          setter: (value: string) =>
                            setSettingsDraft((current) => ({ ...current, summaryPrompt: value })),
                        },
                        {
                          label: "EB1A classification prompt",
                          value: settingsDraft.classificationPrompt,
                          reset: DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
                          setter: (value: string) =>
                            setSettingsDraft((current) => ({
                              ...current,
                              classificationPrompt: value,
                            })),
                        },
                        {
                          label: "Criteria tagging prompt",
                          value: settingsDraft.taggingPrompt,
                          reset: DEFAULT_TAGGING_PROMPT_TEMPLATE,
                          setter: (value: string) =>
                            setSettingsDraft((current) => ({ ...current, taggingPrompt: value })),
                        },
                      ].map((prompt) => (
                        <div
                          key={prompt.label}
                          className="rounded-[16px] border border-[#ece8dd] bg-[#faf9f5] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-semibold text-[var(--foreground)]">
                              {prompt.label}
                            </p>
                            <button
                              type="button"
                              onClick={() => prompt.setter(prompt.reset)}
                              className="rounded-full border border-[#e7e3d9] px-3 py-1.5 text-[10px] font-semibold"
                            >
                              Reset
                            </button>
                          </div>
                          <textarea
                            value={prompt.value}
                            onChange={(event) => prompt.setter(event.target.value)}
                            rows={12}
                            className="mt-3 min-h-[260px] w-full rounded-[14px] border border-[#e7e3d9] bg-white px-4 py-3 font-mono text-[11px] leading-6 outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                      <div className="rounded-[16px] border border-[#ece8dd] bg-[#faf9f5] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Workspace settings
                        </p>
                        <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">
                          These values control the active editable prompt set. History is not saved.
                        </p>
                      </div>

                      <div className="rounded-[16px] border border-[#ece8dd] bg-[#faf9f5] p-4">
                        <p className="text-[11px] font-semibold text-[var(--foreground)]">
                          Candidate name
                        </p>
                        <p className="mt-2 rounded-[14px] border border-[#e7e3d9] bg-white px-4 py-3 text-[12px] text-[var(--foreground)]">
                          {candidateDisplayName}
                        </p>
                        <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                          Managed from `Workspace intake` on the landing page.
                        </p>
                      </div>

                      <label className="block rounded-[16px] border border-[#ece8dd] bg-[#faf9f5] p-4">
                        <span className="mb-2 block text-[11px] font-semibold text-[var(--foreground)]">
                          Output root
                        </span>
                        <input
                          value={settingsDraft.outputRootPath}
                          onChange={(event) =>
                            setSettingsDraft((current) => ({
                              ...current,
                              outputRootPath: event.target.value,
                            }))
                          }
                          className="w-full rounded-[14px] border border-[#e7e3d9] bg-white px-4 py-3 text-[12px] outline-none"
                        />
                      </label>

                      <label className="block rounded-[16px] border border-[#ece8dd] bg-[#faf9f5] p-4">
                        <span className="mb-2 block text-[11px] font-semibold text-[var(--foreground)]">
                          OpenAI API key
                        </span>
                        <input
                          type="password"
                          value={settingsDraft.apiKey}
                          onChange={(event) =>
                            setSettingsDraft((current) => ({
                              ...current,
                              apiKey: event.target.value,
                            }))
                          }
                          placeholder={library.settings.apiKeyMask || "Paste a key"}
                          className="w-full rounded-[14px] border border-[#e7e3d9] bg-white px-4 py-3 text-[12px] outline-none"
                        />
                      </label>

                      <div className="rounded-[16px] border border-[#ece8dd] bg-[#faf9f5] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Active models
                        </p>
                        <div className="mt-3 space-y-3 text-[12px] leading-6 text-[var(--foreground)]">
                          <div>
                            <p className="font-semibold">Summary model</p>
                            <p>{library.settings.summaryModel}</p>
                          </div>
                          <div>
                            <p className="font-semibold">Embedding model</p>
                            <p>{library.settings.embeddingModel}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-[#f0eee7] px-5 py-4">
                  <button
                    type="button"
                    onClick={() =>
                      void persistSettings({
                        successMessage: "Prompt library saved.",
                        closeModal: true,
                      })
                    }
                    disabled={isSavingSettings}
                    className="rounded-full bg-[var(--brand)] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {isSavingSettings ? "Saving..." : "Save settings"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
        <header className="glass-panel rounded-[24px] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#8a6ee5,#5f87f0)] text-white shadow-lg shadow-[#d7d2f6]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                    EB1A Evidence Studio
                  </p>
                  <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-deep)]">
                    Candidate dossier
                  </span>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Local + Qdrant
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Dense evidence review with folder-isolated workspaces, candidate-centered
                  summaries, event bundling, EB1A classification, on-demand previews, and
                  tracked AI costs.
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/84 px-3 py-1.5 text-[10px] leading-5 text-[var(--foreground)]">
                  <UserRound className="h-3.5 w-3.5 text-[var(--brand-deep)]" />
                  <span className="font-semibold">Candidate:</span>
                  <span>{candidateDisplayName}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshLibrary()}
                className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-2 text-[11px] font-semibold text-[var(--foreground)] transition hover:bg-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsDraft(buildSettingsDraft(library.settings));
                  setSettingsOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--foreground)] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#2a2940]"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Workspace settings
              </button>
            </div>
          </div>
        </header>

        {bannerMessage ? (
          <div className="glass-panel rounded-2xl px-4 py-2.5 text-xs leading-5 text-[var(--foreground)]">
            {bannerMessage}
          </div>
        ) : null}

        <section
          className={`grid items-start gap-4 ${
            pageMode === "review"
              ? "xl:grid-cols-[312px_minmax(0,1fr)]"
              : "xl:grid-cols-[360px_minmax(0,1fr)]"
          }`}
        >
          <div className="glass-panel rounded-[24px] p-4">
            <div className="flex items-center gap-2">
              <UserRound className="h-3.5 w-3.5 text-[var(--brand-deep)]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {pageMode === "review" ? "Candidate Workspace" : "Candidate Profile"}
              </p>
            </div>

            <div className="mt-4 rounded-[20px] border border-[var(--brand)]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,244,255,0.92))] px-4 py-4 shadow-[0_18px_40px_rgba(138,110,229,0.08)]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-deep)]">
                Candidate at center
              </p>
              <h2 className="mt-2 text-[18px] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                {candidateDisplayName}
              </h2>
              <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                Every summary, bundle, classification decision, and export package in this
                workspace is centered on this candidate.
              </p>
            </div>

            {pageMode === "review" ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[16px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[var(--brand-deep)]">
                    <Database className="h-3 w-3" />
                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Indexed docs
                    </p>
                  </div>
                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                    {library.overview.completedDocuments}
                  </p>
                </div>
                <div className="rounded-[16px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <ReceiptText className="h-3 w-3" />
                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Total cost
                    </p>
                  </div>
                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                    {formatCurrency(workspaceTotalAiCost)}
                  </p>
                </div>
                <div className="rounded-[16px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-sky-700">
                    <FolderTree className="h-3 w-3" />
                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Bundles
                    </p>
                  </div>
                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                    {library.eventBundles?.status === "completed"
                      ? library.eventBundles.bundles.length
                      : "—"}
                  </p>
                </div>
                <div className="rounded-[16px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[var(--brand-deep)]">
                    <Sparkles className="h-3 w-3" />
                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Classified
                    </p>
                  </div>
                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                    {classificationReady ? classifiedBundleCount : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[var(--brand-deep)]">
                    <Database className="h-3.5 w-3.5" />
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Indexed docs
                    </p>
                  </div>
                  <p className={metricValueClassName()}>{library.overview.completedDocuments}</p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <ReceiptText className="h-3.5 w-3.5" />
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Total cost
                    </p>
                  </div>
                  <p className={metricValueClassName()}>
                    {formatCurrency(workspaceTotalAiCost)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sky-700">
                    <FolderTree className="h-3.5 w-3.5" />
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Event bundles
                    </p>
                  </div>
                  <p className={metricValueClassName()}>
                    {library.eventBundles?.status === "completed"
                      ? library.eventBundles.bundles.length
                      : "—"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[var(--brand-deep)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      EB1A classified
                    </p>
                  </div>
                  <p className={metricValueClassName()}>
                    {classificationReady ? classifiedBundleCount : "—"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-amber-700">
                    <FileStack className="h-3.5 w-3.5" />
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Human review
                    </p>
                  </div>
                  <p className={metricValueClassName()}>
                    {classificationReady ? unclassifiedBundleCount : "—"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Output package
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold leading-5 text-[var(--foreground)]">
                    {library.eb1aClassification?.outputFolderPath ? "Saved" : "Pending"}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3 rounded-[18px] border border-white/80 bg-white/82 px-3 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Candidate name
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {candidateDisplayName}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                Managed from the `Workspace intake` section so indexing always starts with the
                candidate name and folder together.
              </p>
            </div>

            {pageMode === "dashboard" ? (
              <>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Workspace files
                    </p>
                    <p className={metricValueClassName()}>{activeWorkspaceDocuments}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Last indexed
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[var(--foreground)]">
                      {formatDateTime(library.overview.latestCompletionAt)}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Current models
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--foreground)]">
                      {library.settings.summaryModel}
                      <br />
                      {library.settings.embeddingModel}
                    </p>
                  </div>
                </div>

                <div
                  className={`mt-4 rounded-[18px] border px-3 py-3 text-[11px] leading-5 ${workspaceActivity.tone}`}
                >
                  <p className="font-semibold">{workspaceActivity.title}</p>
                  <p className="mt-1 opacity-85">{workspaceActivity.detail}</p>
                </div>
              </>
            ) : null}

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <FileStack className="h-4 w-4 text-[var(--brand-deep)]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Folder Workspaces
                </p>
              </div>
              {activeJob ? (
                <div className="space-y-3">
                  <div className="rounded-[18px] border border-[var(--brand)]/25 bg-[var(--brand-soft)]/55 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                          {activeJob.folderLabel}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-5 text-[var(--muted)]">
                          {activeJob.candidateName ? `${activeJob.candidateName} • ` : ""}
                          {activeJob.processedFiles}/{activeJob.totalFiles} processed
                          {activeJob.failedFiles ? `, ${activeJob.failedFiles} failed` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${statusTone(
                          activeJob.status,
                        )}`}
                      >
                        {activeJob.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#8a6ee5,#5f87f0)]"
                        style={{ width: `${activeJobProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                      Current folder view. Only this workspace backend is shown in the review
                      surface.
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Historical completed workspaces
                    </span>
                    <select
                      value={activeJobId ?? ""}
                      onChange={(event) => {
                        if (event.target.value && event.target.value !== activeJobId) {
                          void handleSelectJob(event.target.value);
                        }
                      }}
                      className="w-full rounded-2xl border border-white/80 bg-white/88 px-3 py-2.5 text-[11px] font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--brand)]"
                    >
                      {workspaceJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.folderLabel} • {formatDateTime(job.completedAt || job.startedAt || job.createdAt)}
                          {job.id === activeJobId ? " • Current" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDeleteSelectedWorkspace()}
                      disabled={!canDeleteSelectedWorkspace}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isDeletingWorkspace ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {isDeletingWorkspace ? "Deleting..." : "Delete selected workspace"}
                    </button>
                    {!canDeleteSelectedWorkspace && activeJob ? (
                      <p className="text-[10px] leading-5 text-[var(--muted)]">
                        Active processing must finish or be canceled before cleanup.
                      </p>
                    ) : null}
                  </div>

                  {pageMode === "dashboard" ? (
                    <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-3">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Workspace review
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-[var(--foreground)]/88">
                        Open a dedicated page for search, semantic lookup, bundle drilldown, and
                        evidence review for this folder only.
                      </p>
                      {reviewWorkspaceHref ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={reviewWorkspaceHref}
                            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#5641b0,#5f87f0)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-95"
                          >
                            <Search className="h-3.5 w-3.5" />
                            Open search & review
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                          Select a workspace first
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-white/80 bg-white/78 px-3 py-4 text-[11px] leading-5 text-[var(--muted)]">
                  No folder workspaces exist yet. Choose a folder to create the first isolated
                  review space.
                </div>
              )}
            </div>
          </div>

          {pageMode === "dashboard" ? (
            <div className="glass-panel rounded-[24px] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-[var(--brand-deep)]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Workspace staging
                    </p>
                  </div>
                  <h1 className="mt-2 max-w-3xl text-xl font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                    Monitor the selected candidate and folder before the full review pipeline takes
                    over.
                  </h1>
                  <p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--muted)]">
                    This section reflects the folder staged above, shows what will be indexed, and
                    makes the current workspace state easy to scan at a glance.
                  </p>
                </div>

                <div className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-deep)]">
                  Latest subject date rule active
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <div className="rounded-[22px] border border-white/80 bg-white/84 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-deep)]">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Candidate at center
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                        The staged workspace will be summarized and reviewed around this name.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-white/80 bg-white px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {candidateNameInput || "No candidate name entered yet"}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                    Every summary, date choice, bundle, and review hint will be centered on this
                    candidate.
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/80 bg-white/84 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-deep)]">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Staged evidence folder
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                        The folder selected in Workspace intake is shown here for confirmation.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                      Selected root
                    </p>
                    <p className="mt-1 truncate text-[12px] font-semibold text-[var(--foreground)]">
                      {pendingStats?.rootLabel ?? "No folder selected"}
                    </p>
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">
                    Nested files are indexed locally into Qdrant with candidate-aware summaries,
                    tags, dates, metadata, and cost tracking.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Files selected
                  </p>
                  <p className={metricValueClassName()}>{pendingStats?.fileCount ?? 0}</p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Folder size
                  </p>
                  <p className={metricValueClassName()}>
                    {pendingStats ? formatBytes(pendingStats.totalBytes) : "0 B"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/82 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Root label
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                    {pendingStats?.rootLabel ?? "No folder selected"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(pendingStats?.fileTypes ?? []).map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600"
                  >
                    {type}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="max-w-2xl text-[11px] leading-5 text-[var(--muted)]">
                  Each folder becomes its own isolated backend workspace. The summary model uses
                  the candidate as the center point, then the app bundles events, classifies them
                  into EB1A categories, and writes a downstream output package. If a file has
                  multiple dates it stores the latest subject-relevant date.
                </p>
                <div className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Start actions stay in Workspace intake above
                </div>
              </div>

              {!candidateNameInput || !pendingStats ? (
                <div className="mt-3 rounded-[16px] border border-dashed border-[var(--border-primary)] bg-white/72 px-3 py-2.5 text-[11px] leading-5 text-[var(--muted)]">
                  {candidateNameInput
                    ? "Choose a folder to unlock indexing."
                    : pendingStats
                      ? "Enter the candidate full name to unlock indexing."
                      : "Enter the candidate full name and choose a folder to unlock indexing."}
                </div>
              ) : null}

              <div className="mt-4 rounded-[18px] border border-white/80 bg-[#f8fbff] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Review pipeline
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--foreground)]">
                      {reviewPipeline.currentStageLabel}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {Math.round(reviewPipeline.overallProgress)}%
                  </span>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#8a6ee5,#5f87f0)] transition-all duration-500"
                    style={{ width: `${reviewPipeline.overallProgress}%` }}
                  />
                </div>

                <div className="mt-3 grid gap-2 xl:grid-cols-5">
                  {reviewPipeline.stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="rounded-[14px] border border-white/80 bg-white/92 px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[9px] font-semibold text-[var(--foreground)]">
                          {index + 1}. {stage.label}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${stageStatusClassName(
                            stage.status,
                          )}`}
                        >
                          {stageStatusLabel(stage.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-[9px] leading-4 text-[var(--muted)]">
                        {stage.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {showDashboardReview ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-emerald-100 bg-emerald-50/75 px-3 py-2 text-[10px] leading-5 text-emerald-800">
                    <p className="font-semibold">
                      This workspace is ready to review directly on the landing page below.
                    </p>
                    {reviewWorkspaceHref ? (
                      <Link
                        href={reviewWorkspaceHref}
                        className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/92 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white"
                      >
                        <Search className="h-3 w-3" />
                        Detailed search page
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-[24px] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4 text-[var(--brand-deep)]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Workspace Search & Review
                    </p>
                  </div>
                  <h1 className="mt-2 max-w-3xl text-xl font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                    Search and review {activeJob?.folderLabel || "the selected workspace"} on a
                    dedicated page.
                  </h1>
                  <p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--muted)]">
                    This page is focused on semantic search, bundle drilldown, criteria review,
                    and manual overrides for one folder workspace at a time.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-[11px] font-semibold text-[var(--foreground)] transition hover:bg-white"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Back to dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => void refreshLibrary()}
                    className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#5641b0,#5f87f0)] px-3 py-2 text-[11px] font-semibold text-white transition hover:opacity-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh review
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border border-white/80 bg-white/84 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Active workspace
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                    {activeJob?.folderLabel || "No workspace selected"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/84 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Review level
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                    {classificationReady
                      ? "Criteria -> events -> files"
                      : bundleReviewReady
                        ? "Events -> files"
                        : "Files only"}
                  </p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/84 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Review pipeline
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                    {reviewPipeline.currentStageLabel}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[18px] border border-white/80 bg-[#f8fbff] px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Review at a glance
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-[var(--foreground)]">
                    Search lives below, but the workspace is already ready for browsing,
                    overrides, and evidence review from the main center column.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Workspace files
                      </p>
                      <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                        {activeWorkspaceDocuments}
                      </p>
                    </div>
                    <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Total AI cost
                      </p>
                      <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                        {formatCurrency(workspaceTotalAiCost)}
                      </p>
                    </div>
                    <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Manual overrides
                      </p>
                      <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                        {manualCategoryOverrideCount + manualEventOverrideCount}
                      </p>
                    </div>
                    <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Output package
                      </p>
                      <p className="mt-1 text-[10px] font-semibold leading-5 text-[var(--foreground)]">
                        {library.eb1aClassification?.outputFolderPath ? "Saved locally" : "Pending"}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-[18px] border px-3 py-3 text-[11px] leading-5 ${workspaceActivity.tone}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{workspaceActivity.title}</p>
                      <p className="mt-1 opacity-85">{workspaceActivity.detail}</p>
                    </div>
                    <span className="rounded-full bg-white/78 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]/70">
                      {formatDateTime(library.overview.latestCompletionAt)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[14px] border border-white/80 bg-white/86 px-3 py-2 text-[10px] leading-5 text-[var(--foreground)]">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Current models
                      </p>
                      <p className="mt-1">
                        {library.settings.summaryModel}
                        <br />
                        {library.settings.embeddingModel}
                      </p>
                    </div>
                    <div className="rounded-[14px] border border-white/80 bg-white/86 px-3 py-2 text-[10px] leading-5 text-[var(--foreground)]">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Human review
                      </p>
                      <p className="mt-1 font-semibold">
                        {classificationReady ? `${unclassifiedBundleCount} bundle(s)` : "Pending"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </section>

        {shouldRenderReviewSurface ? (
          <section
            className={`grid gap-4 ${
              isPreviewOpen && selectedDocument
                ? "xl:grid-cols-[minmax(0,1fr)_500px]"
                : "xl:grid-cols-[minmax(0,1fr)]"
            }`}
          >
            <div className="glass-panel rounded-[24px] p-4">
            <div className="flex flex-col gap-3 border-b border-white/80 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4 text-[var(--brand-deep)]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      {bundleReviewReady
                        ? classificationReady
                          ? "Evidence Criteria Review"
                          : "Event Bundles"
                        : "Evidence Review"}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--foreground)]">
                    {activeJob
                      ? bundleReviewReady
                        ? classificationReady
                          ? `Showing the final criterion-first review for ${activeJob.folderLabel}. The screen is organized as evidence criteria, then event bundles, then files, with Archive Category and Unwanted kept separate from normal EB1A buckets. Files from other uploaded folders are hidden from this view.`
                          : `Showing event bundles for ${activeJob.folderLabel}. Each bundle groups related evidence into a real-world event, and files from other uploaded folders are hidden from this view.`
                        : `Showing document-level review for ${activeJob.folderLabel}. Indexing and bundling run as separate passes, so completed evidence stays clickable while the event map is queued, rebuilding, or still in progress.`
                      : "Choose a processed folder workspace or index a new one to start reviewing isolated backend data."}
                  </p>
                </div>

                <div className="rounded-full bg-white/80 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  {bundleReviewReady
                    ? classificationReady
                      ? `${visibleReviewBuckets.length} visible criteria section(s)`
                      : `${visibleEventBundles.length} visible bundle(s)`
                    : `${visibleDocuments.length} visible evidence file(s)`}
                </div>
              </div>

              {pageMode === "review" ? (
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <form onSubmit={handleSemanticSearch} className="grid gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
                      <input
                        value={semanticQuery}
                        onChange={(event) => setSemanticQuery(event.target.value)}
                        placeholder="Semantic search within the selected folder workspace"
                        className="w-full rounded-2xl border border-white/80 bg-white/88 py-2.5 pr-4 pl-9 text-sm outline-none transition focus:border-[var(--brand)]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isSearching || !activeJobId}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#2a2940] disabled:opacity-60"
                      >
                        {isSearching ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Binary className="h-3.5 w-3.5" />
                        )}
                        Search meaning
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSemanticQuery("");
                          setSemanticResults(null);
                        }}
                        className="rounded-full border border-white/80 bg-white/88 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white"
                      >
                        Reset
                      </button>
                    </div>
                  </form>

                  <div className="grid gap-2">
                    <input
                      value={quickFilter}
                      onChange={(event) => setQuickFilter(event.target.value)}
                      placeholder="Filter only the active folder view by bundle name, document title, path, tag, or organization"
                      className="w-full rounded-2xl border border-white/80 bg-white/88 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]"
                    />
                    <div className="rounded-2xl border border-white/80 bg-white/72 px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">
                      {semanticResults
                        ? "Semantic results are active for this folder workspace only. Match badges reflect Qdrant similarity within the selected upload."
                        : classificationReady
                          ? "The final screen is grouped as criteria, then event bundles, then files. Expand any layer, drag for manual overrides, or use Quick peek on an evidence row to open its side preview."
                          : activeJob && !bundleReviewReady
                            ? "Completed evidence can already be opened below while event bundling catches up. Once bundling finishes, the same workspace flips into event-level review."
                            : activeJob
                              ? "Expand a bundle to see its elemental evidence list. Use Quick peek on an evidence row to open the preview and full summary in the side panel."
                              : "No folder workspace is active yet, so there is nothing to review in the table."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="rounded-2xl border border-white/80 bg-white/72 px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">
                    {classificationReady
                      ? "The landing page review is now active for this workspace. Expand criteria, bundles, and files directly below. Use the detailed review page when you want semantic search or a tighter retrieval workflow."
                      : "The landing page review is active for this workspace. Expand bundles and files directly below. Use the detailed review page when you want semantic search or a tighter retrieval workflow."}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {reviewWorkspaceHref ? (
                      <Link
                        href={reviewWorkspaceHref}
                        className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Detailed search
                      </Link>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 overflow-hidden rounded-[20px] border border-white/80 bg-white/80">
              <div className="max-h-[calc(100vh-18rem)] overflow-auto p-3">
                {bundleReviewReady && visibleEventBundles.length ? (
                  <div className="space-y-3">
                    {library.eb1aClassification?.status === "queued" ||
                    library.eb1aClassification?.status === "processing" ||
                    library.eb1aClassification?.status === "failed" ? (
                      <div
                        className={`rounded-[18px] border px-4 py-4 text-[11px] leading-6 ${
                          library.eb1aClassification?.status === "failed"
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : "border-sky-200 bg-sky-50 text-sky-800"
                        }`}
                      >
                        <p className="font-semibold">
                          {library.eb1aClassification?.status === "queued"
                            ? "EB1A classification is queued."
                            : library.eb1aClassification?.status === "processing"
                              ? "AI is classifying event bundles into EB1A criteria."
                              : "EB1A classification needs attention."}
                        </p>
                        <p className="mt-1">
                          {library.eb1aClassification?.message ||
                            "Event bundles are still reviewable while the EB1A pass catches up."}
                        </p>
                      </div>
                    ) : null}

                    {classificationReady ? (
                      <div className="space-y-3">
                        <div className="rounded-[18px] border border-white/80 bg-[#f8fbff] px-3 py-3">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                Final review flow
                              </p>
                              <p className="mt-2 text-[11px] leading-5 text-[var(--foreground)]">
                                {"Evidence criteria -> event bundles -> files. Expand a criterion, then expand a bundle, then use Quick peek on a file when you want the side preview and full AI summary."}
                              </p>
                              <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                                Drag an event bundle into another category bucket to override its
                                category. Drag a file into another event bundle to override the
                                event assignment. Manual overrides persist for this workspace.
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Criteria bundles
                                  </p>
                                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                                    {classifiedBundleCount}
                                  </p>
                                </div>
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Human review
                                  </p>
                                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                                    {unclassifiedBundleCount}
                                  </p>
                                </div>
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Archive
                                  </p>
                                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                                    {archiveBundleCount}
                                  </p>
                                </div>
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Unwanted
                                  </p>
                                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                                    {unwantedBundleCount}
                                  </p>
                                </div>
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Output package
                                  </p>
                                  <p className="mt-1 text-[10px] font-semibold leading-5 text-[var(--foreground)]">
                                    {library.eb1aClassification?.outputFolderPath
                                      ? "Saved locally"
                                      : "Pending"}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {criterionSummary.map((criterion) => (
                                  <span
                                    key={criterion.code}
                                    className={`rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${decisionBadgeClassName(
                                      criterion.code,
                                      "criterion",
                                    )}`}
                                  >
                                    {criterion.code} {criterion.name} · {criterion.count}
                                  </span>
                                ))}
                                {archiveBundleCount ? (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                                    Archive · {archiveBundleCount}
                                  </span>
                                ) : null}
                                {unwantedBundleCount ? (
                                  <span className="rounded-full bg-[#fff3f3] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]">
                                    Unwanted · {unwantedBundleCount}
                                  </span>
                                ) : null}
                                {unclassifiedBundleCount ? (
                                  <span className="rounded-full bg-[#fff6e8] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                    Human review · {unclassifiedBundleCount}
                                  </span>
                                ) : null}
                                {manualCategoryOverrideCount ? (
                                  <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                    Manual categories · {manualCategoryOverrideCount}
                                  </span>
                                ) : null}
                                {manualEventOverrideCount ? (
                                  <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                    Manual events · {manualEventOverrideCount}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-3">
                              <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                Output package
                              </p>
                              <p className="mt-2 break-all text-[10px] leading-5 text-[var(--foreground)]">
                                {library.eb1aClassification?.outputFolderPath ||
                                  "No output package has been written yet."}
                              </p>
                              <div className="mt-3 space-y-2">
                                {(library.eb1aClassification?.outputArtifacts ?? []).map(
                                  (artifact) => (
                                    <div
                                      key={artifact.relativePath}
                                      className="rounded-2xl bg-[#f5f8ff] px-3 py-2 text-[10px] leading-5 text-[var(--foreground)]"
                                    >
                                      <span className="font-semibold">{artifact.label}:</span>{" "}
                                      {artifact.relativePath}
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-white/80 bg-white/92 px-3 py-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                Reading legend
                              </p>
                              <p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">
                                Category chips and evidence tags stay consistent while the review
                                cards remain neutral and easier to read.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                  "criteria",
                                )}`}
                              >
                                Criteria
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                  "bundle",
                                )}`}
                              >
                                Event bundle
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                  "evidence",
                                )}`}
                              >
                                Evidence file
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {visibleBucketLegend.map((bucket) => (
                              <span
                                key={`legend-${bucket.code}`}
                                className={`rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${decisionBadgeClassName(
                                  bucket.code,
                                  bucket.kind,
                                )}`}
                              >
                                {bucket.kind === "criterion"
                                  ? `${bucket.code} · ${bucket.name}`
                                  : bucket.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {visibleReviewBuckets.map((bucket, bucketIndex) => {
                            const expandedBucket = Boolean(
                              expandedBucketIds[bucket.bucketCode] ??
                                (bucketIndex === 0 && !hasExpandedBucketSelection),
                            );
                            const bucketIsDropTarget =
                              dragState?.type === "bundle" &&
                              activeDropTarget?.kind === "bucket" &&
                              activeDropTarget.id === bucket.bucketCode;

                            return (
                              <div
                                key={bucket.bucketCode}
                                onDragOver={(event) => {
                                  if (dragState?.type !== "bundle") {
                                    return;
                                  }

                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                  setActiveDropTarget({
                                    kind: "bucket",
                                    id: bucket.bucketCode,
                                  });
                                }}
                                onDrop={(event) => {
                                  if (
                                    dragState?.type !== "bundle" ||
                                    !activeJobId ||
                                    dragState.sourceBucketCode === bucket.bucketCode
                                  ) {
                                    return;
                                  }

                                  event.preventDefault();
                                  void applyManualOverride(
                                    {
                                      jobId: activeJobId,
                                      type: "bundle-category",
                                      bundleId: dragState.bundleId,
                                      bucketCode: bucket.bucketCode,
                                    },
                                    `Bundle moved to ${bucket.bucketName}. Output package refreshed.`,
                                  );
                                }}
                                className={`rounded-[18px] border ${reviewBucketCardClassName(
                                  bucket.bucketCode,
                                  bucket.bucketKind,
                                )} ${bucketIsDropTarget ? "ring-2 ring-[var(--brand)]/35" : ""}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedBucketIds((current) => ({
                                      ...current,
                                      [bucket.bucketCode]: !expandedBucket,
                                    }));
                                  }}
                                  className="flex w-full items-start gap-3 px-3 py-3 text-left"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="pt-0.5 text-[var(--muted)]">
                                      {expandedBucket ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </div>
                                    <div
                                      className={`mt-0.5 h-10 w-1.5 rounded-full ${reviewBucketAccentBarClassName(
                                        bucket.bucketCode,
                                        bucket.bucketKind,
                                      )}`}
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span
                                        className={`rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                          "criteria",
                                        )}`}
                                      >
                                        {bucket.bucketKind === "criterion"
                                          ? "Criteria"
                                          : "Review bucket"}
                                      </span>
                                      <span
                                        className={`rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${decisionBadgeClassName(
                                          bucket.bucketCode,
                                          bucket.bucketKind,
                                        )}`}
                                      >
                                        {bucket.bucketKind === "criterion"
                                          ? `${bucket.bucketCode} · ${bucket.bucketName}`
                                          : bucket.bucketName}
                                      </span>
                                      <span className="rounded-full border border-white/80 bg-white/76 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                        {bucket.bundles.length} bundle(s)
                                      </span>
                                      <span className="rounded-full border border-white/80 bg-white/76 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                        {bucket.fileCount} file(s)
                                      </span>
                                    </div>
                                    <p className="mt-2 text-[11px] font-semibold leading-5 text-[var(--foreground)]">
                                      {bucket.bucketKind === "criterion"
                                        ? bucket.bucketName
                                        : bucket.bucketName}
                                    </p>
                                    <p className="mt-1 text-[10px] leading-5 text-[var(--foreground)]/78">
                                      {bucket.bucketKind === "criterion"
                                        ? `Expand to review the event bundles assigned to ${bucket.bucketName}.`
                                        : bucket.bucketKind === "archive"
                                          ? "Expand to review files routed by filename into Archive Category."
                                          : bucket.bucketKind === "unwanted"
                                            ? "Expand to review files marked Unwanted for manual follow-up before petition drafting."
                                            : "Expand to review bundles that still need a human decision."}
                                    </p>
                                    {bucketIsDropTarget ? (
                                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                        Drop bundle here to override its category.
                                      </p>
                                    ) : null}
                                  </div>
                                </button>

                                {expandedBucket ? (
                                  <div className="border-t border-white/80 px-3 py-3">
                                    <div className="space-y-2">
                                      {bucket.bundles.map((bundle) => {
                                        const expanded = Boolean(expandedBundleIds[bundle.id]);
                                        const expandedSummary = Boolean(
                                          expandedBundleSummaryIds[bundle.id],
                                        );
                                        const bundleSummary = expandedSummary
                                          ? bundle.detailedSummary
                                          : truncateText(
                                              bundle.detailedSummary || bundle.shortSummary,
                                              180,
                                            );
                                        const bundleHasMoreSummary =
                                          (bundle.detailedSummary || bundle.shortSummary).length >
                                          180;
                                        const bundleDecision =
                                          criterionDecisionLookup.get(bundle.id) ?? null;
                                        const bundleIsDropTarget =
                                          dragState?.type === "document" &&
                                          activeDropTarget?.kind === "bundle" &&
                                          activeDropTarget.id === bundle.id;
                                        const bundleHasManualCategoryOverride =
                                          hasManualCategoryOverride(library, bundle.id);

                                        return (
                                          <div
                                            key={bundle.id}
                                            onDragOver={(event) => {
                                              if (dragState?.type !== "document") {
                                                return;
                                              }

                                              event.preventDefault();
                                              event.dataTransfer.dropEffect = "move";
                                              setActiveDropTarget({
                                                kind: "bundle",
                                                id: bundle.id,
                                              });
                                            }}
                                            onDrop={(event) => {
                                              if (
                                                dragState?.type !== "document" ||
                                                !activeJobId ||
                                                dragState.sourceBundleId === bundle.id
                                              ) {
                                                return;
                                              }

                                              event.preventDefault();
                                              void applyManualOverride(
                                                {
                                                  jobId: activeJobId,
                                                  type: "document-event",
                                                  documentId: dragState.documentId,
                                                  targetBundleId: bundle.id,
                                                },
                                                `Evidence moved into ${bundle.name}. Output package refreshed.`,
                                              );
                                            }}
                                            className={`rounded-[16px] border ${bundleCardClassName(
                                              bundle.bundleKind,
                                              bundleIsDropTarget,
                                            )}`}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setExpandedBundleIds((current) => ({
                                                  ...current,
                                                  [bundle.id]: !expanded,
                                                }));
                                              }}
                                              className="flex w-full items-start gap-3 px-3 py-3 text-left"
                                            >
                                              <div className="flex items-start gap-3 pt-0.5 text-[var(--muted)]">
                                                {classificationReady ? (
                                                  <span
                                                    draggable
                                                    onDragStart={(event) => {
                                                      event.stopPropagation();
                                                      event.dataTransfer.effectAllowed = "move";
                                                      setDragState({
                                                        type: "bundle",
                                                        bundleId: bundle.id,
                                                        sourceBucketCode: bucket.bucketCode,
                                                      });
                                                    }}
                                                    onDragEnd={() => {
                                                      setDragState(null);
                                                      setActiveDropTarget(null);
                                                    }}
                                                    className="cursor-grab rounded-full p-0.5 text-[var(--muted)] hover:bg-white"
                                                    title="Drag this event bundle into another category bucket"
                                                  >
                                                    <GripVertical className="h-3.5 w-3.5" />
                                                  </span>
                                                ) : null}
                                                <div className="pt-0.5">
                                                  {expanded ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                  ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                  )}
                                                </div>
                                                <div className="mt-0.5 h-11 w-1.5 rounded-full bg-[#6c97da]" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                  <span
                                                    className={`rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                                      "bundle",
                                                    )}`}
                                                  >
                                                    Event bundle
                                                  </span>
                                                  {bundleDecision ? (
                                                    <span
                                                      className={`rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${decisionBadgeClassName(
                                                        bundleDecision.bucketCode,
                                                        bundleDecision.bucketKind,
                                                      )}`}
                                                    >
                                                      {decisionBucketLabel(bundleDecision)}
                                                    </span>
                                                  ) : null}
                                                  {bundleHasManualCategoryOverride ? (
                                                    <span className="rounded-full bg-[#eef4ff] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                      Manual category
                                                    </span>
                                                  ) : null}
                                                  <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                    {bundle.eventType}
                                                  </span>
                                                  <span className="rounded-full border border-white/80 bg-white/76 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                                    {bundle.evidenceDocuments.length} file(s)
                                                  </span>
                                                  <span className="rounded-full bg-[#eefaf2] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                                    {formatPrimaryDate(bundle.latestRelevantDate)}
                                                  </span>
                                                </div>
                                                <div className="mt-2 flex flex-col gap-1 lg:flex-row lg:items-start lg:justify-between">
                                                  <div className="min-w-0 flex-1">
                                                    <p className="text-[13px] font-semibold leading-5 text-[var(--foreground)]">
                                                      {bundle.name}
                                                    </p>
                                                    <p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">
                                                      {bundle.timeframeLabel}
                                                      {bundle.location !== "Location not specified"
                                                        ? ` • ${bundle.location}`
                                                        : ""}
                                                    </p>
                                                  </div>
                                                  {semanticResultIds &&
                                                  bundle.evidenceDocuments.some((document) =>
                                                    semanticResultIds.has(document.id),
                                                  ) ? (
                                                    <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                      Search match
                                                    </span>
                                                  ) : null}
                                                </div>
                                                <p className="mt-2 text-[10px] leading-5 text-[var(--foreground)]/88">
                                                  {bundleSummary}
                                                </p>
                                                {bundleDecision ? (
                                                  <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                                                    {bundleDecision.reviewDisposition ===
                                                      "classified" ||
                                                    bundleDecision.reviewDisposition === "archive"
                                                      ? bundleDecision.rationale
                                                      : bundleDecision.unclassifiedReason ||
                                                        bundleDecision.rationale}
                                                  </p>
                                                ) : null}
                                                {bundleHasMoreSummary ? (
                                                  <button
                                                    type="button"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      setExpandedBundleSummaryIds((current) => ({
                                                        ...current,
                                                        [bundle.id]: !expandedSummary,
                                                      }));
                                                    }}
                                                    className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]"
                                                  >
                                                    {expandedSummary
                                                      ? "Show less"
                                                      : "Read more"}
                                                  </button>
                                                ) : null}
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                  {(bundleDecision?.secondaryCriterionNames ?? []).map(
                                                    (criterion) => (
                                                      <span
                                                        key={`${bundle.id}-secondary-${criterion}`}
                                                        className="rounded-full bg-[#eef4ff] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]"
                                                      >
                                                        Secondary · {criterion}
                                                      </span>
                                                    ),
                                                  )}
                                                  {compactList(bundle.keywords, 6).map((keyword) => (
                                                    <span
                                                      key={`${bundle.id}-${keyword}`}
                                                      className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                                                    >
                                                      {keyword}
                                                    </span>
                                                  ))}
                                                </div>
                                                {bundleIsDropTarget ? (
                                                  <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                    Drop file here to move it into this event.
                                                  </p>
                                                ) : null}
                                              </div>
                                            </button>

                                            {expanded ? (
                                              <div className="border-t border-white/80 px-3 py-3">
                                                <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                                                  <div className="space-y-2">
                                                    {bundle.evidenceDocuments.map((document) => {
                                                      const selected =
                                                        isPreviewOpen &&
                                                        selectedDocument?.id === document.id;
                                                      const score = getDocumentScore(document);

                                                      return (
                                                        <div
                                                          key={document.id}
                                                          className={`w-full rounded-[14px] border px-3 py-2 text-left transition ${evidenceRowClassName(
                                                            selected,
                                                          )}`}
                                                        >
                                                          <div className="flex flex-wrap items-center gap-1.5">
                                                            <span
                                                              className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                                                "evidence",
                                                              )}`}
                                                            >
                                                              Evidence
                                                            </span>
                                                            <span
                                                              draggable
                                                              onDragStart={(event) => {
                                                                event.stopPropagation();
                                                                event.dataTransfer.effectAllowed =
                                                                  "move";
                                                                setDragState({
                                                                  type: "document",
                                                                  documentId: document.id,
                                                                  sourceBundleId: bundle.id,
                                                                });
                                                              }}
                                                              onDragEnd={() => {
                                                                setDragState(null);
                                                                setActiveDropTarget(null);
                                                              }}
                                                              className="cursor-grab rounded-full p-0.5 text-[var(--muted)] hover:bg-white"
                                                              title="Drag this file into another event bundle"
                                                            >
                                                              <GripVertical className="h-3.5 w-3.5" />
                                                            </span>
                                                            <p className="text-[10px] font-semibold leading-5 text-[var(--foreground)]">
                                                              {document.summary?.title ||
                                                                document.fileName}
                                                            </p>
                                                            <span
                                                              className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${documentStatusTone(
                                                                document.processingStatus,
                                                              )}`}
                                                            >
                                                              {document.processingStatus}
                                                            </span>
                                                            {score !== null ? (
                                                              <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                                {Math.round(score * 100)} match
                                                              </span>
                                                            ) : null}
                                                            {hasManualEventOverride(
                                                              library,
                                                              document.id,
                                                            ) ? (
                                                              <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                                Manual event
                                                              </span>
                                                            ) : null}
                                                          </div>
                                                          <p className="mt-1 text-[9px] leading-5 text-[var(--muted)]">
                                                            {document.relativePath}
                                                          </p>
                                                          <p className="mt-1 text-[10px] leading-5 text-[var(--foreground)]/88">
                                                            {truncateText(
                                                              document.summary?.shortSummary ||
                                                                "Summary pending.",
                                                              140,
                                                            )}
                                                          </p>
                                                          <div className="mt-2 flex flex-wrap gap-1">
                                                            <span className="rounded-full bg-white px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                              {document.summary?.documentType ||
                                                                document.extension ||
                                                                "File"}
                                                            </span>
                                                            <span className="rounded-full bg-[#eefaf2] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                                              {formatPrimaryDate(
                                                                document.summary?.primaryDate,
                                                              )}
                                                            </span>
                                                          </div>
                                                          {renderEvidenceActionStrip(
                                                            document,
                                                            bundle.bundleKind,
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>

                                                  <div
                                                    className={`rounded-[14px] border px-3 py-3 ${bundleMetadataCardClassName(
                                                      bundle.bundleKind,
                                                    )}`}
                                                  >
                                                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                                      Bundle metadata
                                                    </p>
                                                    <div className="mt-2 space-y-2 text-[10px] leading-5 text-[var(--foreground)]">
                                                      {bundleDecision ? (
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                          <span className="font-semibold">
                                                            Category:
                                                          </span>
                                                          <span
                                                            className={`rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${decisionBadgeClassName(
                                                              bundleDecision.bucketCode,
                                                              bundleDecision.bucketKind,
                                                            )}`}
                                                          >
                                                            {decisionBucketLabel(bundleDecision)}
                                                          </span>
                                                        </div>
                                                      ) : null}
                                                      <p>
                                                        <span className="font-semibold">
                                                          People:
                                                        </span>{" "}
                                                        {bundle.people.join(", ") ||
                                                          "Not specified"}
                                                      </p>
                                                      <p>
                                                        <span className="font-semibold">
                                                          Organizations:
                                                        </span>{" "}
                                                        {bundle.organizations.join(", ") ||
                                                          "Not specified"}
                                                      </p>
                                                      <p>
                                                        <span className="font-semibold">
                                                          Location:
                                                        </span>{" "}
                                                        {bundle.location}
                                                      </p>
                                                      <p>
                                                        <span className="font-semibold">
                                                          Latest date:
                                                        </span>{" "}
                                                        {formatPrimaryDate(
                                                          bundle.latestRelevantDate,
                                                        )}
                                                      </p>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-[18px] border border-white/80 bg-[#f8fbff] px-3 py-3">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                Event review flow
                              </p>
                              <p className="mt-2 text-[11px] leading-5 text-[var(--foreground)]">
                                {"Event bundles -> files. Expand a bundle, review its evidence list, then use Quick peek on a file to open the side preview and full AI summary."}
                              </p>
                              <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                                Drag a file into another event bundle to override the event assignment at any time. Category overrides unlock in the next pass once EB1A classification completes.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                    "bundle",
                                  )}`}
                                >
                                  Event bundle
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                    "evidence",
                                  )}`}
                                >
                                  Evidence file
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Visible bundles
                                  </p>
                                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                                    {visibleEventBundles.length}
                                  </p>
                                </div>
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Visible files
                                  </p>
                                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                                    {flattenedVisibleDocuments.length}
                                  </p>
                                </div>
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Manual events
                                  </p>
                                  <p className="mt-1 text-base font-semibold tracking-tight text-[var(--foreground)]">
                                    {manualEventOverrideCount}
                                  </p>
                                </div>
                                <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-2">
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Category pass
                                  </p>
                                  <p className="mt-1 text-[10px] font-semibold leading-5 text-[var(--foreground)]">
                                    {library.eb1aClassification?.status === "queued"
                                      ? "Queued"
                                      : library.eb1aClassification?.status === "processing"
                                        ? "Running"
                                        : library.eb1aClassification?.status === "failed"
                                          ? "Needs attention"
                                          : "Pending"}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {manualEventOverrideCount ? (
                                  <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                    Manual event overrides · {manualEventOverrideCount}
                                  </span>
                                ) : null}
                                {isApplyingOverride ? (
                                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-sky-700">
                                    Saving override
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="rounded-[14px] border border-white/80 bg-white/92 px-3 py-3">
                              <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                Next pass
                              </p>
                              <p className="mt-2 text-[10px] leading-5 text-[var(--foreground)]">
                                {library.eb1aClassification?.message ||
                                  "Once the category pass completes, the final review screen groups this same evidence as criteria, then event bundles, then files."}
                              </p>
                              <p className="mt-2 text-[9px] leading-5 text-[var(--muted)]">
                                Manual event moves are already persistent for this workspace and will carry into the final categorized review.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {visibleEventBundles.map((bundle, bundleIndex) => {
                            const expanded = Boolean(
                              expandedBundleIds[bundle.id] ??
                                (bundleIndex === 0 && !hasExpandedBundleSelection),
                            );
                            const expandedSummary = Boolean(
                              expandedBundleSummaryIds[bundle.id],
                            );
                            const bundleSummary = expandedSummary
                              ? bundle.detailedSummary
                              : truncateText(bundle.detailedSummary || bundle.shortSummary, 180);
                            const bundleHasMoreSummary =
                              (bundle.detailedSummary || bundle.shortSummary).length > 180;
                            const bundleIsDropTarget =
                              dragState?.type === "document" &&
                              activeDropTarget?.kind === "bundle" &&
                              activeDropTarget.id === bundle.id;

                            return (
                              <div
                                key={bundle.id}
                                onDragOver={(event) => {
                                  if (dragState?.type !== "document") {
                                    return;
                                  }

                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                  setActiveDropTarget({
                                    kind: "bundle",
                                    id: bundle.id,
                                  });
                                }}
                                onDrop={(event) => {
                                  if (
                                    dragState?.type !== "document" ||
                                    !activeJobId ||
                                    dragState.sourceBundleId === bundle.id
                                  ) {
                                    return;
                                  }

                                  event.preventDefault();
                                  void applyManualOverride(
                                    {
                                      jobId: activeJobId,
                                      type: "document-event",
                                      documentId: dragState.documentId,
                                      targetBundleId: bundle.id,
                                    },
                                    `Evidence moved into ${bundle.name}. Output package refreshed.`,
                                  );
                                }}
                                className={`rounded-[16px] border ${bundleCardClassName(
                                  bundle.bundleKind,
                                  bundleIsDropTarget,
                                )}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedBundleIds((current) => ({
                                      ...current,
                                      [bundle.id]: !expanded,
                                    }));
                                  }}
                                  className="flex w-full items-start gap-3 px-3 py-3 text-left"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="pt-0.5 text-[var(--muted)]">
                                      {expanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </div>
                                    <div className="mt-0.5 h-11 w-1.5 rounded-full bg-[#6c97da]" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span
                                        className={`rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                          "bundle",
                                        )}`}
                                      >
                                        Event bundle
                                      </span>
                                      {bundle.bundleKind !== "standard" ? (
                                        <span
                                          className={`rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${
                                            bundle.bundleKind === "archive"
                                              ? "bg-slate-100 text-slate-700"
                                              : "bg-[#fff3f3] text-[var(--danger)]"
                                          }`}
                                        >
                                          {bundle.bundleKind}
                                        </span>
                                      ) : null}
                                      <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                        {bundle.eventType}
                                      </span>
                                      <span className="rounded-full border border-white/80 bg-white/76 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                        {bundle.evidenceDocuments.length} file(s)
                                      </span>
                                      <span className="rounded-full bg-[#eefaf2] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                        {formatPrimaryDate(bundle.latestRelevantDate)}
                                      </span>
                                    </div>
                                    <div className="mt-2 flex flex-col gap-1 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-semibold leading-5 text-[var(--foreground)]">
                                          {bundle.name}
                                        </p>
                                        <p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">
                                          {bundle.timeframeLabel}
                                          {bundle.location !== "Location not specified"
                                            ? ` • ${bundle.location}`
                                            : ""}
                                        </p>
                                      </div>
                                      {semanticResultIds &&
                                      bundle.evidenceDocuments.some((document) =>
                                        semanticResultIds.has(document.id),
                                      ) ? (
                                        <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                          Search match
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-2 text-[10px] leading-5 text-[var(--foreground)]/88">
                                      {bundleSummary}
                                    </p>
                                    {bundleHasMoreSummary ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setExpandedBundleSummaryIds((current) => ({
                                            ...current,
                                            [bundle.id]: !expandedSummary,
                                          }));
                                        }}
                                        className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]"
                                      >
                                        {expandedSummary ? "Show less" : "Read more"}
                                      </button>
                                    ) : null}
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {compactList(bundle.keywords, 6).map((keyword) => (
                                        <span
                                          key={`${bundle.id}-${keyword}`}
                                          className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                                        >
                                          {keyword}
                                        </span>
                                      ))}
                                    </div>
                                    {bundleIsDropTarget ? (
                                      <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                        Drop file here to move it into this event.
                                      </p>
                                    ) : null}
                                  </div>
                                </button>

                                {expanded ? (
                                  <div className="border-t border-white/80 px-3 py-3">
                                    <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                                      <div className="space-y-2">
                                        {bundle.evidenceDocuments.map((document) => {
                                          const selected =
                                            isPreviewOpen &&
                                            selectedDocument?.id === document.id;
                                          const score = getDocumentScore(document);

                                          return (
                                            <div
                                              key={document.id}
                                              className={`w-full rounded-[14px] border px-3 py-2 text-left transition ${evidenceRowClassName(
                                                selected,
                                              )}`}
                                            >
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                <span
                                                  className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                                    "evidence",
                                                  )}`}
                                                >
                                                  Evidence
                                                </span>
                                                <span
                                                  draggable
                                                  onDragStart={(event) => {
                                                    event.stopPropagation();
                                                    event.dataTransfer.effectAllowed = "move";
                                                    setDragState({
                                                      type: "document",
                                                      documentId: document.id,
                                                      sourceBundleId: bundle.id,
                                                    });
                                                  }}
                                                  onDragEnd={() => {
                                                    setDragState(null);
                                                    setActiveDropTarget(null);
                                                  }}
                                                  className="cursor-grab rounded-full p-0.5 text-[var(--muted)] hover:bg-white"
                                                  title="Drag this file into another event bundle"
                                                >
                                                  <GripVertical className="h-3.5 w-3.5" />
                                                </span>
                                                <p className="text-[10px] font-semibold leading-5 text-[var(--foreground)]">
                                                  {document.summary?.title || document.fileName}
                                                </p>
                                                <span
                                                  className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${documentStatusTone(
                                                    document.processingStatus,
                                                  )}`}
                                                >
                                                  {document.processingStatus}
                                                </span>
                                                {score !== null ? (
                                                  <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                    {Math.round(score * 100)} match
                                                  </span>
                                                ) : null}
                                                {hasManualEventOverride(library, document.id) ? (
                                                  <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                                    Manual event
                                                  </span>
                                                ) : null}
                                              </div>
                                              <p className="mt-1 text-[9px] leading-5 text-[var(--muted)]">
                                                {document.relativePath}
                                              </p>
                                              <p className="mt-1 text-[10px] leading-5 text-[var(--foreground)]/88">
                                                {truncateText(
                                                  document.summary?.shortSummary ||
                                                    "Summary pending.",
                                                  140,
                                                )}
                                              </p>
                                              <div className="mt-2 flex flex-wrap gap-1">
                                                <span className="rounded-full bg-white px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                                  {document.summary?.documentType ||
                                                    document.extension ||
                                                    "File"}
                                                </span>
                                                <span className="rounded-full bg-[#eefaf2] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                                  {formatPrimaryDate(
                                                    document.summary?.primaryDate,
                                                  )}
                                                </span>
                                              </div>
                                              {renderEvidenceActionStrip(
                                                document,
                                                bundle.bundleKind,
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>

                                      <div
                                        className={`rounded-[14px] border px-3 py-3 ${bundleMetadataCardClassName(
                                          bundle.bundleKind,
                                        )}`}
                                      >
                                        <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                          Bundle metadata
                                        </p>
                                        <div className="mt-2 space-y-2 text-[10px] leading-5 text-[var(--foreground)]">
                                          <p>
                                            <span className="font-semibold">People:</span>{" "}
                                            {bundle.people.join(", ") || "Not specified"}
                                          </p>
                                          <p>
                                            <span className="font-semibold">
                                              Organizations:
                                            </span>{" "}
                                            {bundle.organizations.join(", ") || "Not specified"}
                                          </p>
                                          <p>
                                            <span className="font-semibold">Location:</span>{" "}
                                            {bundle.location}
                                          </p>
                                          <p>
                                            <span className="font-semibold">Latest date:</span>{" "}
                                            {formatPrimaryDate(bundle.latestRelevantDate)}
                                          </p>
                                          <p>
                                            <span className="font-semibold">Confidence:</span>{" "}
                                            {bundle.confidence}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeJob && visibleDocuments.length ? (
                  <div className="space-y-3">
                    {library.eventBundles?.status === "processing" ||
                    library.eventBundles?.status === "queued" ||
                    library.eventBundles?.status === "failed" ? (
                      <div
                        className={`rounded-[18px] border px-4 py-4 text-[11px] leading-6 ${
                          library.eventBundles?.status === "failed"
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : "border-sky-200 bg-sky-50 text-sky-800"
                        }`}
                      >
                        <p className="font-semibold">
                          {library.eventBundles?.status === "queued"
                            ? "Event bundling is queued."
                            : library.eventBundles?.status === "processing"
                              ? "AI is grouping this folder into event bundles."
                              : "Event bundling needs attention."}
                        </p>
                        <p className="mt-1">
                          {library.eventBundles?.message ||
                            "Document-level review remains available while the bundle map catches up."}
                        </p>
                      </div>
                    ) : null}

                    <div className="overflow-hidden rounded-[18px] border border-[#efe5d6] bg-[#fffdf8]">
                      <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 border-b border-[#efe5d6] bg-[#faf3e7] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        <p>Evidence</p>
                        <p>Type</p>
                        <p>Date</p>
                        <p>Tags</p>
                      </div>

                      <div className="divide-y divide-[#efe5d6]">
                        {visibleDocuments.map((document) => {
                          const selected =
                            isPreviewOpen && selectedDocument?.id === document.id;
                          const score = getDocumentScore(document);

                          return (
                            <div
                              key={document.id}
                              className={`grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 px-3 py-3 text-left transition ${evidenceTableRowClassName(
                                selected,
                              )}`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                                      "evidence",
                                    )}`}
                                  >
                                    Evidence
                                  </span>
                                  <p className="truncate text-[11px] font-semibold text-[var(--foreground)]">
                                    {document.summary?.title || document.fileName}
                                  </p>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${documentStatusTone(
                                      document.processingStatus,
                                    )}`}
                                  >
                                    {document.processingStatus}
                                  </span>
                                  {score !== null ? (
                                    <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                                      {Math.round(score * 100)} match
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 truncate text-[10px] leading-5 text-[var(--muted)]">
                                  {document.relativePath}
                                </p>
                                <p className="mt-1 text-[10px] leading-5 text-[var(--foreground)]/88">
                                  {truncateText(
                                    document.summary?.shortSummary || "Summary pending.",
                                    180,
                                  )}
                                </p>
                                {renderEvidenceActionStrip(document, null, !bundleReviewReady)}
                                {!bundleReviewReady ? (
                                  <p className="mt-2 text-[9px] leading-5 text-[var(--muted)]">
                                    Archive and remove actions unlock after event bundling finishes.
                                  </p>
                                ) : null}
                              </div>

                              <div className="min-w-0 text-[10px] leading-5 text-[var(--foreground)]">
                                <p className="font-semibold">
                                  {document.summary?.documentType || document.extension || "File"}
                                </p>
                                <p className="mt-1 text-[var(--muted)]">
                                  {formatCurrency(document.usage?.totalCostUsd ?? 0)}
                                </p>
                              </div>

                              <div className="min-w-0 text-[10px] leading-5 text-[var(--foreground)]">
                                <p className="font-semibold">
                                  {formatPrimaryDate(document.summary?.primaryDate)}
                                </p>
                                <p className="mt-1 text-[var(--muted)]">
                                  {document.summary?.primaryDateReason || "Latest subject date rule"}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap gap-1">
                                  {compactList(document.summary?.tags ?? [], 4).map((tag) => (
                                    <span
                                      key={`${document.id}-${tag}`}
                                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {!document.summary?.tags?.length ? (
                                    <span className="text-[10px] leading-5 text-[var(--muted)]">
                                      No tags yet
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                    {activeJob
                      ? library.eventBundles?.status === "failed"
                        ? "Event bundling did not complete for this folder workspace."
                        : bundleReviewReady
                          ? classificationReady
                            ? "No criteria sections in this folder workspace match the current search or filter."
                            : "No event bundles in this folder workspace match the current search or filter."
                          : "No evidence in this folder workspace matches the current search or filter."
                      : "No folder workspace is selected yet."}
                  </div>
                )}
              </div>
            </div>
          </div>

            {isPreviewOpen && selectedDocument ? (
              <aside className="xl:sticky xl:top-4 xl:self-start">
              <div className="glass-panel overflow-hidden rounded-[24px]">
                <div className="flex max-h-[calc(100vh-2rem)] flex-col">
                  <div className="border-b border-white/80 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-[var(--brand-deep)]" />
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                            Evidence Preview
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                          On-demand preview and summary for{" "}
                          {getDocumentCandidate(selectedDocument, workspaceCandidate)} inside{" "}
                          {activeJob?.folderLabel || "the selected folder workspace"}.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sourceUrl ? (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white"
                          >
                            Original
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setIsPreviewOpen(false)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white"
                        >
                          <X className="h-3.5 w-3.5" />
                          Close
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-white/80 bg-[#f7fbff] px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                        {selectedDocument.summary?.documentType || "Evidence file"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        Confidence {selectedDocument.summary?.confidence ?? 0}
                      </span>
                      <span className="rounded-full bg-[#eefaf2] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                        {formatPrimaryDate(selectedDocument.summary?.primaryDate)}
                      </span>
                      <span className="rounded-full bg-[#fff6e8] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                        {formatCurrency(selectedDocument.usage?.totalCostUsd ?? 0)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-base font-semibold leading-snug tracking-tight text-[var(--foreground)]">
                      {selectedDocument.summary?.title || selectedDocument.fileName}
                    </h2>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                      {selectedDocument.relativePath}
                    </p>
                    {selectedEventBundle ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${hierarchyBadgeClassName(
                            "bundle",
                          )}`}
                        >
                          Event bundle
                        </span>
                        <span className="text-[10px] leading-5 text-[var(--brand-deep)]">
                          {selectedEventBundle.name}
                        </span>
                      </div>
                    ) : null}
                    {selectedBundleDecision ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] leading-5 text-[var(--muted)]">
                          Category:
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${decisionBadgeClassName(
                            selectedBundleDecision.bucketCode,
                            selectedBundleDecision.bucketKind,
                          )}`}
                        >
                          {decisionBucketLabel(selectedBundleDecision)}
                        </span>
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs leading-6 text-[var(--foreground)]/90">
                      {selectedDocument.summary?.shortSummary || "Summary pending."}
                    </p>
                    <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                      Preview opens fit to the pane by default. Use the built-in `+`, `−`, `Fit`,
                      and `100%` controls inside the preview when you need a closer look.
                    </p>
                  </div>

                  <div className="border-b border-white/80 bg-white">
                    {previewUrl ? (
                      <iframe
                        key={previewUrl}
                        src={previewUrl}
                        title={selectedDocument.fileName || "Document preview"}
                        className="h-[380px] w-full bg-white xl:h-[440px]"
                      />
                    ) : (
                      <div className="flex h-[380px] items-center justify-center px-6 text-center text-[11px] leading-5 text-[var(--muted)] xl:h-[440px]">
                        Preview unavailable for this document.
                      </div>
                    )}
                  </div>

                  <div className="overflow-auto p-4">
                    <div className="space-y-3">
                      <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Candidate-focused summary
                        </p>
                        <p className="mt-2 text-[11px] leading-6 text-[var(--foreground)]">
                          {selectedDocument.summary?.detailedSummary ||
                            "This document has not been summarized yet."}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Why it matters
                          </p>
                          <p className="mt-2 text-[11px] leading-6 text-[var(--foreground)]">
                            {selectedDocument.summary?.evidenceValue || "Pending review."}
                          </p>
                        </div>
                        <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Recommended use
                          </p>
                          <p className="mt-2 text-[11px] leading-6 text-[var(--foreground)]">
                            {selectedDocument.summary?.recommendedUse || "Pending review."}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Key facts
                        </p>
                        <div className="mt-2 space-y-2">
                          {(selectedDocument.summary?.notableFacts ?? []).length ? (
                            (selectedDocument.summary?.notableFacts ?? []).map((fact) => (
                              <div
                                key={fact}
                                className="rounded-2xl bg-[#f5f8ff] px-3 py-2.5 text-[11px] leading-5 text-[var(--foreground)]"
                              >
                                {fact}
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] leading-5 text-[var(--muted)]">
                              No key facts extracted.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Event context
                          </p>
                          {selectedEventBundle ? (
                            <div className="mt-2 space-y-2 text-[11px] leading-5 text-[var(--foreground)]">
                              <p>
                                <span className="font-semibold">Bundle:</span>{" "}
                                {selectedEventBundle.name}
                              </p>
                              <p>
                                <span className="font-semibold">Type:</span>{" "}
                                {selectedEventBundle.eventType}
                              </p>
                              <p>
                                <span className="font-semibold">Timeline:</span>{" "}
                                {selectedEventBundle.timeframeLabel}
                              </p>
                              <p>
                                <span className="font-semibold">Evidence count:</span>{" "}
                                {selectedEventBundle.evidenceDocuments.length}
                              </p>
                              {selectedBundleDecision ? (
                                <p>
                                  <span className="font-semibold">Category:</span>{" "}
                                  <span
                                    className={`ml-1 inline-flex rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] ${decisionBadgeClassName(
                                      selectedBundleDecision.bucketCode,
                                      selectedBundleDecision.bucketKind,
                                    )}`}
                                  >
                                    {decisionBucketLabel(selectedBundleDecision)}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                              This evidence is not attached to a visible event bundle in the current
                              filtered view.
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-1">
                            {(selectedDocument.summary?.tags ?? []).length ? (
                              (selectedDocument.summary?.tags ?? []).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                                >
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-[var(--muted)]">No tags</span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Metadata
                          </p>
                          <div className="mt-2 space-y-2 text-[11px] leading-5 text-[var(--foreground)]">
                            <p>
                              <span className="font-semibold">People:</span>{" "}
                              {(selectedDocument.summary?.people ?? []).join(", ") || "None noted"}
                            </p>
                            <p>
                              <span className="font-semibold">Organizations:</span>{" "}
                              {(selectedDocument.summary?.organizations ?? []).join(", ") ||
                                "None noted"}
                            </p>
                            <p>
                              <span className="font-semibold">Dates:</span>{" "}
                              {(selectedDocument.summary?.dates ?? []).join(", ") || "None noted"}
                            </p>
                            <p>
                              <span className="font-semibold">Locations:</span>{" "}
                              {(selectedDocument.summary?.locations ?? []).join(", ") ||
                                "None noted"}
                            </p>
                            <p>
                              <span className="font-semibold">Extraction:</span>{" "}
                              {selectedDocument.metadata?.sourceKind ||
                                selectedDocument.sourceKind}
                            </p>
                            <p>
                              <span className="font-semibold">Preview mode:</span>{" "}
                              {selectedDocument.metadata?.previewMode || "Unavailable"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Missing context
                          </p>
                          <div className="mt-2 space-y-2">
                            {(selectedDocument.summary?.missingContext ?? []).length ? (
                              (selectedDocument.summary?.missingContext ?? []).map((note) => (
                                <div
                                  key={note}
                                  className="rounded-2xl bg-[#fff9ef] px-3 py-2.5 text-[11px] leading-5 text-[var(--foreground)]"
                                >
                                  {note}
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] leading-5 text-[var(--muted)]">
                                No major gaps flagged.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Risk flags
                          </p>
                          <div className="mt-2 space-y-2">
                            {(selectedDocument.summary?.riskFlags ?? []).length ? (
                              (selectedDocument.summary?.riskFlags ?? []).map((flag) => (
                                <div
                                  key={flag}
                                  className="rounded-2xl bg-[#fff3f3] px-3 py-2.5 text-[11px] leading-5 text-[var(--foreground)]"
                                >
                                  {flag}
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] leading-5 text-[var(--muted)]">
                                No immediate reliability concerns were flagged.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-white/80 bg-white/84 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Extract preview
                        </p>
                        <p className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-5 text-[var(--foreground)]">
                          {selectedDocument.metadata?.preview || "No extract preview available."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </aside>
            ) : null}
          </section>
        ) : null}
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1725]/35 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-[28px] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Workspace Settings
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                  Keep everything local
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-white/80 bg-white/84 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold text-[var(--foreground)]">
                  Candidate name
                </span>
                <input
                  value={settingsDraft.candidateName}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      candidateName: event.target.value,
                    }))
                  }
                  placeholder="Enter the beneficiary name"
                  className="w-full rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)]"
                />
                <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                  New evidence summaries use this candidate as the center point.
                </p>
              </label>

              <div className="rounded-[22px] border border-white/80 bg-white/72 p-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Prompt Library
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                    Edit the active prompts for summary and EB1A classification. Only the current
                    prompt values are saved.
                  </p>
                </div>

                <div className="mt-4 rounded-[18px] border border-white/80 bg-white/88 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Document summary prompt
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                        Controls per-file summary generation and metadata extraction.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettingsDraft((current) => ({
                          ...current,
                          summaryPrompt: DEFAULT_SUMMARY_PROMPT_TEMPLATE,
                        }))
                      }
                      className="rounded-full border border-white/80 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white"
                    >
                      Reset
                    </button>
                  </div>

                  <textarea
                    value={settingsDraft.summaryPrompt}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        summaryPrompt: event.target.value,
                      }))
                    }
                    rows={8}
                    className="mt-3 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-[11px] leading-6 outline-none transition focus:border-[var(--brand)]"
                  />
                </div>

                <div className="mt-3 rounded-[18px] border border-white/80 bg-white/88 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        EB1A classification prompt
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                        Controls the third pass that maps event bundles into EB1A criteria or
                        human review.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettingsDraft((current) => ({
                          ...current,
                          classificationPrompt: DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
                        }))
                      }
                      className="rounded-full border border-white/80 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white"
                    >
                      Reset
                    </button>
                  </div>

                  <textarea
                    value={settingsDraft.classificationPrompt}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        classificationPrompt: event.target.value,
                      }))
                    }
                    rows={8}
                    className="mt-3 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-[11px] leading-6 outline-none transition focus:border-[var(--brand)]"
                  />
                </div>

                <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">
                  Available placeholders: <span className="font-mono">{"{{candidateName}}"}</span>{" "}
                  and <span className="font-mono">{"{{criteriaCatalog}}"}</span>. The app still
                  enforces structured JSON output and keeps unclassified review available when the
                  model is unsure.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold text-[var(--foreground)]">
                  Target output root
                </span>
                <input
                  value={settingsDraft.outputRootPath}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      outputRootPath: event.target.value,
                    }))
                  }
                  placeholder="/Users/you/Documents/EB1A/Organized"
                  className="w-full rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)]"
                />
                <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                  Each completed classification run writes a timestamped workspace package under
                  this root, including copied evidence, references, index files, and a human-review queue.
                </p>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold text-[var(--foreground)]">
                  OpenAI API key
                </span>
                <input
                  type="password"
                  value={settingsDraft.apiKey}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      apiKey: event.target.value,
                    }))
                  }
                  placeholder={library.settings.apiKeyMask || "Paste a key to configure"}
                  className="w-full rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold text-[var(--foreground)]">
                    Summary model
                  </span>
                  <input
                    value={settingsDraft.summaryModel}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        summaryModel: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold text-[var(--foreground)]">
                    Embedding model
                  </span>
                  <input
                    value={settingsDraft.embeddingModel}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        embeddingModel: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold text-[var(--foreground)]">
                  Embedding dimensions
                </span>
                <input
                  type="number"
                  min={128}
                  max={3072}
                  value={settingsDraft.embeddingDimensions}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      embeddingDimensions: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)]"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] leading-5 text-[var(--muted)]">
                Qdrant collection <span className="font-mono">{library.settings.qdrantCollection}</span>
                <br />
                Storage <span className="font-mono">{library.settings.storagePath}</span>
                <br />
                Output root <span className="font-mono">{library.settings.outputRootPath}</span>
              </div>
              <button
                type="button"
                disabled={isSavingSettings}
                onClick={() =>
                  void persistSettings({
                    successMessage: "Workspace settings saved.",
                    closeModal: true,
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#2a2940] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSettings ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Settings2 className="h-3.5 w-3.5" />
                )}
                Save locally
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
