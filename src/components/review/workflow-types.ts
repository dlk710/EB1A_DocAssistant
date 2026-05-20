import type { ReviewDecisionItem } from "@/components/review/DecisionRow";

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
  bucketCode: string | null;
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
