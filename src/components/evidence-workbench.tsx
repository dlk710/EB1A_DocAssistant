"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useDeferredValue,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, FormEvent } from "react";
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
  ShieldCheck,
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
  WorkspaceEb1aClassificationState,
  WorkspaceEventBundleState,
} from "@/lib/types";
import { isReviewableEvidenceFile } from "@/lib/evidence-filters";
import {
  DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
  DEFAULT_SUMMARY_PROMPT_TEMPLATE,
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
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "processing") {
    return "bg-sky-50 text-sky-700";
  }

  return "bg-slate-100 text-slate-600";
}

function buildSettingsDraft(settings: SettingsSnapshot): SettingsDraft {
  return {
    candidateName: settings.candidateName,
    summaryPrompt: settings.summaryPrompt,
    classificationPrompt: settings.classificationPrompt,
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
    return `${base} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400`;
  }

  if (tone === "preview") {
    return active
      ? `${base} border-[var(--brand)]/30 bg-[var(--brand-soft)] text-[var(--brand-deep)]`
      : `${base} border-white/80 bg-white text-[var(--foreground)] hover:bg-[#f5f8ff]`;
  }

  if (tone === "keep") {
    return active
      ? `${base} border-emerald-200 bg-emerald-50 text-emerald-700`
      : `${base} border-white/80 bg-white text-[var(--foreground)] hover:bg-emerald-50`;
  }

  if (tone === "archive") {
    return active
      ? `${base} border-slate-300 bg-slate-100 text-slate-700`
      : `${base} border-white/80 bg-white text-[var(--foreground)] hover:bg-slate-100`;
  }

  return active
    ? `${base} border-rose-200 bg-rose-50 text-rose-700`
    : `${base} border-white/80 bg-white text-[var(--foreground)] hover:bg-rose-50`;
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
    return "border-[var(--brand)]/25 bg-[var(--brand-soft)]/55";
  }

  return "border-[#eceff6] bg-white/96 hover:bg-slate-50/70";
}

function evidenceTableRowClassName(selected: boolean) {
  return selected ? "bg-[var(--brand-soft)]/50" : "bg-white/96 hover:bg-slate-50/70";
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
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "processing" || status === "queued") {
    return "bg-sky-50 text-sky-700";
  }

  if (status === "failed") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-slate-100 text-slate-600";
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
          id: "review",
          label: "Ready to review",
          status: "pending",
          detail: "The full review surface unlocks after indexing, event bundling, and EB1A classification complete.",
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

  const reviewStage: ReviewPipelineStage =
    indexingFailed
      ? {
          id: "review",
          label: "Ready to review",
          status: "failed",
          detail: "Review is blocked because indexing did not finish.",
          progress: null,
        }
      : indexingComplete && bundlingStatus === "completed" && classificationStatus === "completed"
        ? {
            id: "review",
            label: "Ready to review",
            status: "completed",
            detail: "Bundle review, EB1A category review, and output-package review are all unlocked for this folder workspace.",
            progress: 100,
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
                ? bundlingStatus === "completed"
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
    } else if (bundlingStatus === "completed" && classificationStatus === "completed") {
      overallProgress = 100;
    } else if (bundlingStatus === "completed" && classificationStatus === "failed") {
      overallProgress = 94;
    } else if (bundlingStatus === "failed") {
      overallProgress = 84;
    } else {
      overallProgress = 72;
    }
  }

  const activeStage =
    [indexingStage, bundlingStage, classificationStage, reviewStage].find((stage) =>
      stage.status === "processing" || stage.status === "queued" || stage.status === "failed",
    ) ??
    reviewStage;

  return {
    overallProgress,
    currentStageLabel: `${activeStage.label} • ${stageStatusLabel(activeStage.status)}`,
    stages: [indexingStage, bundlingStage, classificationStage, reviewStage],
  };
}

function buildWorkspaceActivity(input: {
  activeJob: JobRecord | null;
  eventBundles: WorkspaceEventBundleState | null;
  eb1aClassification: WorkspaceEb1aClassificationState | null;
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
        input.eb1aClassification?.status === "completed"
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
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<{
    kind: "bucket" | "bundle";
    id: string;
  } | null>(null);
  const [expandedBucketIds, setExpandedBucketIds] = useState<Record<string, boolean>>({});
  const [expandedBundleIds, setExpandedBundleIds] = useState<Record<string, boolean>>({});
  const [expandedBundleSummaryIds, setExpandedBundleSummaryIds] = useState<Record<string, boolean>>({});
  const folderInputRef = useRef<HTMLInputElement | null>(null);

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
  const workspaceJobs = library.jobs;
  const selectedDocument =
    selectedDocumentFromBundles ??
    selectedVisibleDocument ??
    documentsForSelection[0] ??
    null;
  const workspaceCandidate =
    settingsDraft.candidateName.trim() || library.settings.candidateName.trim();
  const candidateDisplayName = workspaceCandidate || "Candidate not set";
  const reviewWorkspaceHref = activeJobId ? `/review/${activeJobId}` : null;
  const activeWorkspaceDocuments = library.overview.totalDocuments;
  const workspaceTotalAiCost =
    library.overview.totalOpenAiCostUsd +
    (library.eventBundles?.totalCostUsd ?? 0) +
    (library.eb1aClassification?.totalCostUsd ?? 0);
  const selectedEventBundle =
    visibleEventBundles.find((bundle) => bundle.evidenceDocuments.some((document) => document.id === selectedDocument?.id)) ??
    null;
  const classificationReady = library.eb1aClassification?.status === "completed";
  const criterionDecisionLookup = buildCriterionDecisionLookup(library.eb1aClassification);
  const criterionSummary = buildCriterionSummary(library.eb1aClassification);
  const visibleReviewBuckets = buildVisibleReviewBuckets(
    visibleEventBundles,
    library.eb1aClassification,
  );
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
    pendingStats,
    isUploading,
    totalJobs: library.jobs.length,
    hasCandidateName: Boolean(settingsDraft.candidateName.trim()),
  });
  const reviewPipeline = buildReviewPipeline({
    activeJob,
    eventBundles: library.eventBundles,
    eb1aClassification: library.eb1aClassification,
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
        library.eb1aClassification?.status === "processing"),
  );
  const canCancelSelection =
    pendingFiles.length > 0 && !isUploading && !hasAbortableProcessing && !isCancelingProcess;
  const hasExpandedBucketSelection = Object.values(expandedBucketIds).some(Boolean);
  const hasExpandedBundleSelection = Object.values(expandedBundleIds).some(Boolean);

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

    if (!hasActiveIndexing && !hasActiveBundling && !hasActiveClassification) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshLibrary();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [
    library.eb1aClassification?.status,
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

            <label className="mt-3 block">
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
                className="w-full rounded-2xl border border-white/80 bg-white/88 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]"
              />
            </label>

            <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
              Every new summary, date choice, tag set, and embedding is framed around this
              candidate.
            </p>

            <button
              type="button"
              disabled={isSavingSettings}
              onClick={() =>
                void persistSettings({
                  successMessage: "Candidate profile saved locally.",
                })
              }
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--foreground)] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#2a2940] disabled:opacity-60"
            >
              {isSavingSettings ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              Save candidate
            </button>

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
                        <Link
                          href={reviewWorkspaceHref}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#5641b0,#5f87f0)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-95"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Open search & review
                        </Link>
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
                      Evidence Intake
                    </p>
                  </div>
                  <h1 className="mt-2 max-w-3xl text-xl font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                    Review the complete evidence history for{" "}
                    {workspaceCandidate || "your candidate"} in a readable worksheet.
                  </h1>
                  <p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--muted)]">
                    Upload a folder, keep every original local, and switch between isolated folder
                    workspaces without mixing backend data across uploads.
                  </p>
                </div>

                <div className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-deep)]">
                  Latest subject date rule active
                </div>
              </div>

              <input
                ref={folderInputRef}
                type="file"
                multiple
                directory=""
                webkitdirectory=""
                onChange={handleFolderPicked}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="mt-4 flex w-full flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--brand)]/25 bg-white/80 px-4 py-7 text-center transition hover:border-[var(--brand)]/50 hover:bg-white"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-3xl bg-[var(--brand-soft)] text-[var(--brand-deep)]">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Choose a folder of evidence files
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                  Nested files are indexed locally into Qdrant with candidate-aware summaries,
                  tags, dates, metadata, and cost tracking.
                </p>
              </button>

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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleUpload()}
                    disabled={
                      !pendingFiles.length ||
                      isUploading ||
                      hasAbortableProcessing ||
                      isCancelingProcess
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#5641b0,#5f87f0)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isUploading ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {isUploading ? "Indexing..." : "Index folder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancelProcess()}
                    disabled={!canCancelSelection && !hasAbortableProcessing}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/80 bg-white/92 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {(isCancelingProcess || activeJob?.status === "canceling") && hasAbortableProcessing ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    {canCancelSelection
                      ? "Cancel"
                      : isCancelingProcess || activeJob?.status === "canceling"
                        ? "Canceling..."
                        : "Cancel"}
                  </button>
                </div>
              </div>

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

                <div className="mt-3 grid gap-2 lg:grid-cols-4">
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
