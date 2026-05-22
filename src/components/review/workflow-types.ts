import type { ReviewDecisionItem } from "@/components/review/DecisionRow";
import type { EvidenceReviewStatus } from "@/lib/types";

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
  jobId: string;
  bundleName: string;
  workspaceLabel: string;
  rationale: string;
  denseReviewHref: string;
  criterionHint: string | null;
  criterionCode: string | null;
  documentCount: number;
  documentIds: string[];
  documentTitles: string[];
  bundleDocuments: ReviewBundleDocumentContext[];
  bucketCode: string | null;
}

export interface ReviewBundleDocumentContext {
  id: string;
  title: string;
  fileName: string;
  shortSummary: string;
  previewHref: string;
  sourceHref: string;
  confidence: number;
  currentCriterionName: string | null;
}

export interface ReviewBundleFitGroup {
  key: string;
  jobId: string;
  workspaceLabel: string;
  bundleId: string | null;
  bundleName: string;
  itemCount: number;
  items: ReviewDecisionItem[];
}

export interface ReviewRoutingMatrixItem {
  id: string;
  jobId: string;
  title: string;
  fileName: string;
  relativePath: string;
  workspaceLabel: string;
  topFolder: string;
  subfolderPath: string;
  proposedEventName: string;
  proposedBundleName: string;
  proposedCriterionName: string;
  decisionBasis: string;
  confidence: number;
  needsHumanReview: boolean;
  reviewNotes: string;
  currentReviewStatus: EvidenceReviewStatus;
  currentBundleName: string | null;
  currentCriterionName: string | null;
  previewHref: string;
  sourceHref: string;
  denseReviewHref: string;
}
