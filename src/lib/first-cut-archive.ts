import { getHighestAiConfidence, normalizeCriterionTags } from "@/lib/criterion-tags";
import { isReviewableEvidenceFile } from "@/lib/evidence-filters";
import type { EvidenceDecisivenessAssessment } from "@/lib/evidence-decisiveness";
import type { ClientDocument, StoredDocument } from "@/lib/types";

export interface FirstCutArchiveSuggestion {
  shouldArchive: boolean;
  score: number;
  reason: string;
}

type FirstCutDocument = Pick<
  ClientDocument | StoredDocument,
  | "fileName"
  | "extension"
  | "mimeType"
  | "disposition"
  | "reviewStatus"
  | "sourceKind"
  | "summary"
  | "metadata"
  | "criteriaTags"
>;

const CONTEXTUAL_DOCUMENT_HINTS = [
  "cv",
  "resume",
  "passport",
  "identity document",
  "driver license",
  "id card",
  "headshot",
  "profile photo",
];

function textIncludesAny(value: string, hints: string[]) {
  const lower = value.toLowerCase();
  return hints.some((hint) => lower.includes(hint));
}

function documentText(document: FirstCutDocument) {
  return [
    document.fileName,
    document.sourceKind,
    document.summary?.title,
    document.summary?.documentType,
    document.summary?.shortSummary,
    document.metadata?.preview,
  ]
    .filter(Boolean)
    .join("\n");
}

export function suggestFirstCutArchive(input: {
  document: FirstCutDocument;
  decisiveness: EvidenceDecisivenessAssessment;
  archiveConfidenceFloor: number;
}): FirstCutArchiveSuggestion {
  const disposition = input.document.disposition ?? "untouched";

  if (disposition !== "untouched" || input.document.reviewStatus !== "pending") {
    return {
      shouldArchive: false,
      score: 0,
      reason: "Attorney or prior workflow disposition already exists.",
    };
  }

  if (!isReviewableEvidenceFile(input.document)) {
    return {
      shouldArchive: true,
      score: 0.02,
      reason: "System/non-probative file; route away from attorney review.",
    };
  }

  const tags = normalizeCriterionTags({
    id: "first-cut",
    jobId: "first-cut",
    updatedAt: new Date(0).toISOString(),
    reviewStatus: input.document.reviewStatus,
    disposition,
    criteriaTags: input.document.criteriaTags,
  });
  const enabledTags = tags.filter((tag) => tag.state === "enabled");
  const suggestedTags = tags.filter((tag) => tag.state === "suggested");
  const highestConfidence = getHighestAiConfidence(input.document);
  const combinedText = documentText(input.document);

  if (
    !enabledTags.length &&
    textIncludesAny(combinedText, CONTEXTUAL_DOCUMENT_HINTS) &&
    highestConfidence <= 0.55
  ) {
    return {
      shouldArchive: true,
      score: 0.16,
      reason: "Contextual identity/resume-style file with no strong criterion signal.",
    };
  }

  if (
    !enabledTags.length &&
    !suggestedTags.length &&
    highestConfidence <= input.archiveConfidenceFloor
  ) {
    return {
      shouldArchive: true,
      score: 0.18,
      reason: "No criterion signal above the archive confidence floor.",
    };
  }

  if (
    !enabledTags.length &&
    input.decisiveness.tier === "liability" &&
    input.decisiveness.redFlags.length > 0
  ) {
    return {
      shouldArchive: true,
      score: 0.12,
      reason: `Red-flag-only evidence: ${input.decisiveness.redFlags[0]?.rationale ?? "weakens the petition record"}.`,
    };
  }

  if (
    !enabledTags.length &&
    input.decisiveness.tier === "contextual" &&
    input.decisiveness.loadBearingScore <= 0.2 &&
    highestConfidence <= 0.45
  ) {
    return {
      shouldArchive: true,
      score: 0.22,
      reason: "Contextual-only evidence with low load-bearing value.",
    };
  }

  return {
    shouldArchive: false,
    score: highestConfidence,
    reason: "Keep in attorney-visible routing.",
  };
}
