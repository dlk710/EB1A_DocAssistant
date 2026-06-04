import type { EvidenceCriterionTag } from "@/lib/types";

export const ALWAYS_HUMAN_CRITERIA = ["03", "07", "11"] as const;
export const AUTO_ENABLE_CONFIDENCE = 0.85;
export const QUEUE_FLOOR_CONFIDENCE = 0.4;

export type DocumentType =
  | "award_record"
  | "compensation_record"
  | "conference_paper"
  | "conference_program"
  | "email_correspondence"
  | "identity_document"
  | "image_evidence"
  | "job_profile"
  | "judging_credential"
  | "media_coverage"
  | "membership_record"
  | "original_contribution_record"
  | "presentation_slides"
  | "reference_letter"
  | "research_publication"
  | "training_certificate"
  | "other";

export type TagDisposition = "auto_enable" | "needs_review";
export type ReviewLoadStatus =
  | "auto_cleared"
  | "first_cut_archived"
  | "needs_review"
  | "resolved";

export interface TagDispositionDecision {
  bundleId: string;
  proposedCriterionCode: string;
  modelConfidence: number;
  documentType: DocumentType;
  priorCriterionCode: string | null;
  sourcePriorCriterionCode: string | null;
  disposition: TagDisposition;
  reason: string;
}

const DOCUMENT_TYPE_PRIORS: Record<DocumentType, string | null> = {
  award_record: "01",
  compensation_record: "09",
  conference_paper: "06",
  conference_program: null,
  email_correspondence: null,
  identity_document: null,
  image_evidence: null,
  job_profile: "08",
  judging_credential: "04",
  media_coverage: "03",
  membership_record: "02",
  original_contribution_record: "05",
  presentation_slides: "06",
  reference_letter: null,
  research_publication: "06",
  training_certificate: null,
  other: null,
};

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function formatConfidence(value: number) {
  return `${Math.round(clampConfidence(value) * 100)}%`;
}

export function isAlwaysHumanCriterion(code: string | null | undefined) {
  return ALWAYS_HUMAN_CRITERIA.includes((code ?? "") as (typeof ALWAYS_HUMAN_CRITERIA)[number]);
}

export function normalizeDocumentType(rawValue: string | null | undefined): DocumentType {
  const value = normalizeText(rawValue);

  if (!value) {
    return "other";
  }

  if (
    /(peer review|peer reviewer|reviewer|judg|credential.*judge|judge credential|certificate of appreciation.*judg|award participation badge)/.test(
      value,
    )
  ) {
    return "judging_credential";
  }

  if (/(reference letter|letter of reference|recommendation letter|endorsement letter)/.test(value)) {
    return "reference_letter";
  }

  if (
    /(conference paper|conference publication|book chapter|manuscript|scholarly article|research paper|white paper|publication certificate|certificate of publication|research publication)/.test(
      value,
    )
  ) {
    return value.includes("conference paper") ? "conference_paper" : "research_publication";
  }

  if (/(presentation slide|conference presentation|slide deck|presentation deck)/.test(value)) {
    return "presentation_slides";
  }

  if (/(conference program|program schedule|speaker introduction|panel speaker introduction)/.test(value)) {
    return "conference_program";
  }

  if (
    /(job profile|role description|leadership profile|critical role|professional role description|project leadership description|role and impact summary|role and compensation)/.test(
      value,
    )
  ) {
    return "job_profile";
  }

  if (
    /(salary|compensation|w 2|w2|tax document|tax form|wage and tax statement|pay statement|pay and recognition|earnings|income)/.test(
      value,
    )
  ) {
    return "compensation_record";
  }

  if (
    /(project contribution|technical contribution|contribution statement|case study|compendium extract|self reported contribution|impact metric|contribution summary|project summary spreadsheet)/.test(
      value,
    )
  ) {
    return "original_contribution_record";
  }

  if (/(membership|member certificate|fellowship membership)/.test(value)) {
    return "membership_record";
  }

  if (/(press|media|news bulletin|news article|published material|article about)/.test(value)) {
    return "media_coverage";
  }

  if (
    /(award|winner|recognition|honor|certificate of appreciation|recognition participation acknowledgment|badge image|recognition image)/.test(
      value,
    )
  ) {
    return "award_record";
  }

  if (/(email|invitation|confirmation|correspondence|gmail|outlook|forward)/.test(value)) {
    return "email_correspondence";
  }

  if (/(passport|identity document|id card|driver license)/.test(value)) {
    return "identity_document";
  }

  if (/(photograph|photo|screenshot|image|badge)/.test(value)) {
    return "image_evidence";
  }

  if (/(certificate|certification|completion)/.test(value)) {
    return "training_certificate";
  }

  return "other";
}

function getPriorCriterionCode(documentType: DocumentType) {
  return DOCUMENT_TYPE_PRIORS[documentType] ?? null;
}

export function decideTagDisposition(input: {
  bundleId: string;
  proposedCriterionCode: string;
  modelConfidence: number;
  documentType: DocumentType;
  sourcePriorCriterionCode?: string | null;
  sourcePriorReason?: string | null;
  sourcePriorMinimumConfidence?: number | null;
}): TagDispositionDecision {
  const modelConfidence = clampConfidence(input.modelConfidence);
  const priorCriterionCode = getPriorCriterionCode(input.documentType);
  const sourcePriorCriterionCode = input.sourcePriorCriterionCode ?? null;
  const sourcePriorMinimumConfidence = clampConfidence(
    input.sourcePriorMinimumConfidence ?? AUTO_ENABLE_CONFIDENCE,
  );

  if (isAlwaysHumanCriterion(input.proposedCriterionCode)) {
    return {
      ...input,
      modelConfidence,
      priorCriterionCode,
      sourcePriorCriterionCode,
      disposition: "needs_review",
      reason: "high-risk criterion; always routed to human review.",
    };
  }

  if (input.documentType === "reference_letter") {
    return {
      ...input,
      modelConfidence,
      priorCriterionCode,
      sourcePriorCriterionCode,
      disposition: "needs_review",
      reason: "spans criteria (05/08); content decides.",
    };
  }

  if (
    modelConfidence >= AUTO_ENABLE_CONFIDENCE &&
    priorCriterionCode === input.proposedCriterionCode
  ) {
    return {
      ...input,
      modelConfidence,
      priorCriterionCode,
      sourcePriorCriterionCode,
      disposition: "auto_enable",
      reason: `high confidence (${formatConfidence(modelConfidence)}) and document-type prior agree.`,
    };
  }

  if (
    modelConfidence >= sourcePriorMinimumConfidence &&
    sourcePriorCriterionCode === input.proposedCriterionCode
  ) {
    return {
      ...input,
      modelConfidence,
      priorCriterionCode,
      sourcePriorCriterionCode,
      disposition: "auto_enable",
      reason: `high confidence (${formatConfidence(modelConfidence)}) and success-source prior agree: ${input.sourcePriorReason ?? "criterion-specific source pattern matched"}.`,
    };
  }

  if (modelConfidence < QUEUE_FLOOR_CONFIDENCE) {
    return {
      ...input,
      modelConfidence,
      priorCriterionCode,
      sourcePriorCriterionCode,
      disposition: "needs_review",
      reason: `confidence ${formatConfidence(modelConfidence)} is below the review floor.`,
    };
  }

  if (priorCriterionCode && priorCriterionCode !== input.proposedCriterionCode) {
    return {
      ...input,
      modelConfidence,
      priorCriterionCode,
      sourcePriorCriterionCode,
      disposition: "needs_review",
      reason: `document-type prior points to criterion ${priorCriterionCode}, so this needs human review.`,
    };
  }

  if (
    sourcePriorCriterionCode &&
    sourcePriorCriterionCode !== input.proposedCriterionCode
  ) {
    return {
      ...input,
      modelConfidence,
      priorCriterionCode,
      sourcePriorCriterionCode,
      disposition: "needs_review",
      reason: `success-source prior points to criterion ${sourcePriorCriterionCode}, so this needs human review.`,
    };
  }

  if (!priorCriterionCode && !sourcePriorCriterionCode) {
    return {
      ...input,
      modelConfidence,
      priorCriterionCode,
      sourcePriorCriterionCode,
      disposition: "needs_review",
      reason: "document type and success-source patterns do not provide a safe auto-enable prior.",
    };
  }

  return {
    ...input,
    modelConfidence,
    priorCriterionCode,
    sourcePriorCriterionCode,
    disposition: "needs_review",
    reason: `confidence ${formatConfidence(modelConfidence)} did not clear the auto-enable threshold.`,
  };
}

export function classifyDocumentReviewLoad(
  tags: Array<Pick<EvidenceCriterionTag, "code" | "origin" | "state">>,
): ReviewLoadStatus {
  if (!tags.length) {
    return "needs_review";
  }

  const hasSuggestedTag = tags.some((tag) => tag.state === "suggested");

  if (hasSuggestedTag) {
    return "needs_review";
  }

  const hasAlwaysHumanTag = tags.some((tag) => isAlwaysHumanCriterion(tag.code));

  const allAiTagsAutoEnabled = tags
    .filter((tag) => tag.origin !== "attorney")
    .every((tag) => tag.origin === "ai_auto" && tag.state === "enabled");

  const hasAiTag = tags.some((tag) => tag.origin !== "attorney");

  if (!hasAlwaysHumanTag && hasAiTag && allAiTagsAutoEnabled) {
    return "auto_cleared";
  }

  return "resolved";
}

export function summarizeReviewLoad(
  items: Array<ReviewLoadStatus | { reviewLoadStatus: ReviewLoadStatus }>,
) {
  const statuses = items.map((item) =>
    typeof item === "string" ? item : item.reviewLoadStatus,
  );

  return {
    total: statuses.length,
    autoTagged: statuses.filter((status) => status === "auto_cleared").length,
    firstCutArchived: statuses.filter((status) => status === "first_cut_archived").length,
    needsReview: statuses.filter((status) => status === "needs_review").length,
  };
}
