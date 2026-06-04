import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import { ALWAYS_HUMAN_CRITERIA } from "@/lib/criterion-routing";
import {
  deriveDocumentDisposition,
  normalizeCriterionTags,
} from "@/lib/criterion-tags";
import type { ReviewLoadStatus } from "@/lib/criterion-routing";
import type {
  ClientDocument,
  DocumentDisposition,
  EvidenceCriterionTag,
} from "@/lib/types";

type PreliminaryDocument = ClientDocument & {
  bundleName?: string | null;
  confidenceScore?: number;
  needsHumanReview?: boolean;
  reviewLoadStatus?: ReviewLoadStatus;
};

export interface PreliminaryCriterionSignal {
  code: string;
  legalCode: string;
  name: string;
  strength: "strong" | "promising" | "watch";
  suggestedRole: "primary" | "supporting" | "defer";
  score: number;
  enabledCount: number;
  suggestedCount: number;
  primaryCount: number;
  supportingCount: number;
  autoCount: number;
  attorneyCount: number;
  highRisk: boolean;
  averageConfidence: number;
  rationale: string;
  nextStep: string;
  anchorDocIds: string[];
}

export interface PreliminaryStrategyGuidance {
  totalDocuments: number;
  autoTaggedDocuments: number;
  exceptionDocuments: number;
  candidateCriteria: PreliminaryCriterionSignal[];
  primary: PreliminaryCriterionSignal[];
  supporting: PreliminaryCriterionSignal[];
  defer: PreliminaryCriterionSignal[];
  draftStart: PreliminaryCriterionSignal[];
  evidencePlan: PreliminaryEvidencePlan;
  attorneyFocus: string[];
}

export type PreliminaryEvidenceRecommendation =
  | "anchor"
  | "supporting"
  | "context"
  | "exclude_initial_packet";

export interface PreliminaryEvidenceWeight {
  documentId: string;
  fileName: string;
  relativePath: string;
  bundleName: string | null;
  documentType: string;
  recommendation: PreliminaryEvidenceRecommendation;
  score: number;
  reason: string;
  criterionCodes: string[];
  highestConfidence: number;
}

export interface PreliminaryEvidencePlan {
  anchor: PreliminaryEvidenceWeight[];
  supporting: PreliminaryEvidenceWeight[];
  context: PreliminaryEvidenceWeight[];
  exclusions: PreliminaryEvidenceWeight[];
}

const VISUAL_EXTENSIONS = new Set([
  "gif",
  "heic",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp",
]);
const LOW_VALUE_NAME_HINTS = [
  "screenshot",
  "screen shot",
  "image",
  "photo",
  "thumbnail",
  "logo",
  "headshot",
  "banner",
];

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + normalizeConfidence(value), 0) / values.length;
}

function normalizeConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  if (value > 1) {
    return Math.max(0, Math.min(1, value / 100));
  }

  return Math.max(0, Math.min(1, value));
}

function scoreCriterion(input: {
  enabledCount: number;
  suggestedCount: number;
  primaryCount: number;
  supportingCount: number;
  autoCount: number;
  attorneyCount: number;
  averageConfidence: number;
  highRisk: boolean;
}) {
  const roleScore = input.primaryCount * 3 + input.supportingCount * 1.75;
  const suggestionScore = input.suggestedCount * 0.75;
  const confidenceScore = input.averageConfidence >= 0.85 ? 1.25 : input.averageConfidence >= 0.7 ? 0.75 : 0;
  const humanBonus = input.attorneyCount > 0 ? 1.5 : 0;
  const highRiskPenalty = input.highRisk ? 0.75 : 0;

  return roleScore + suggestionScore + confidenceScore + humanBonus - highRiskPenalty;
}

function strengthFor(input: {
  enabledCount: number;
  suggestedCount: number;
  primaryCount: number;
  score: number;
  averageConfidence: number;
  highRisk: boolean;
}): PreliminaryCriterionSignal["strength"] {
  if (
    !input.highRisk &&
    (input.primaryCount > 0 || input.enabledCount >= 2) &&
    input.score >= 3.5 &&
    input.averageConfidence >= 0.7
  ) {
    return "strong";
  }

  if (input.enabledCount + input.suggestedCount >= 2 || input.score >= 2) {
    return "promising";
  }

  return "watch";
}

function roleFor(
  strength: PreliminaryCriterionSignal["strength"],
  index: number,
): PreliminaryCriterionSignal["suggestedRole"] {
  if (strength === "strong" && index < 3) {
    return "primary";
  }

  if (strength !== "watch" && index < 6) {
    return "supporting";
  }

  return "defer";
}

function rationaleFor(input: {
  name: string;
  enabledCount: number;
  suggestedCount: number;
  primaryCount: number;
  autoCount: number;
  attorneyCount: number;
  highRisk: boolean;
  averageConfidence: number;
}) {
  if (input.highRisk) {
    return `${input.name} has useful signals, but this criterion stays attorney-reviewed because it is RFE-prone.`;
  }

  if (input.attorneyCount > 0) {
    return `${input.name} already has attorney-confirmed evidence and can anchor strategy discussion.`;
  }

  if (input.autoCount > 0) {
    return `${input.name} has high-confidence, type-corroborated AI tags that are good enough for preliminary strategy.`;
  }

  if (input.primaryCount > 0) {
    return `${input.name} has primary-role evidence signals, but some tags still need review.`;
  }

  return `${input.name} has ${input.enabledCount + input.suggestedCount} provisional evidence signal(s) with average confidence ${Math.round(input.averageConfidence * 100)}%.`;
}

function nextStepFor(input: {
  strength: PreliminaryCriterionSignal["strength"];
  suggestedRole: PreliminaryCriterionSignal["suggestedRole"];
  highRisk: boolean;
  enabledCount: number;
}) {
  if (input.highRisk) {
    return "Confirm the legal fit before drafting this as a claimed criterion.";
  }

  if (input.suggestedRole === "primary") {
    return "Use Strategy to test this as a primary claim and identify the anchor exhibits.";
  }

  if (input.suggestedRole === "supporting") {
    return "Keep this in the strategy mix as corroborating petition material.";
  }

  if (input.enabledCount > 0 || input.strength !== "watch") {
    return "Hold for supporting context unless Strategy promotes it.";
  }

  return "Leave this for exception review or later supplementation.";
}

function highestConfidence(tags: EvidenceCriterionTag[], document: PreliminaryDocument) {
  return Math.max(
    normalizeConfidence(document.confidenceScore),
    normalizeConfidence(document.summary?.confidence),
    ...tags.map((tag) => normalizeConfidence(tag.aiConfidence ?? tag.confidence)),
  );
}

function normalizeExtension(extension: string) {
  return extension.toLowerCase().replace(/^\./, "");
}

function isVisualEvidence(document: PreliminaryDocument) {
  const extension = normalizeExtension(document.extension);
  const documentType = document.summary?.documentType.toLowerCase() ?? "";
  const fileName = document.fileName.toLowerCase();
  const path = document.relativePath.toLowerCase();

  return (
    VISUAL_EXTENSIONS.has(extension) ||
    document.mimeType.toLowerCase().startsWith("image/") ||
    documentType.includes("image") ||
    documentType.includes("photo") ||
    LOW_VALUE_NAME_HINTS.some((hint) => fileName.includes(hint) || path.includes(hint))
  );
}

function hasAlwaysHumanCriterion(tags: EvidenceCriterionTag[]) {
  return tags.some((tag) =>
    ALWAYS_HUMAN_CRITERIA.includes(tag.code as (typeof ALWAYS_HUMAN_CRITERIA)[number]),
  );
}

function classifyEvidenceWeight(document: PreliminaryDocument): PreliminaryEvidenceWeight {
  const tags = normalizeCriterionTags(document).filter((tag) => tag.state !== "disabled");
  const enabledTags = tags.filter((tag) => tag.state === "enabled");
  const suggestedTags = tags.filter((tag) => tag.state === "suggested");
  const attorneyEnabled = enabledTags.some((tag) => tag.origin === "attorney");
  const autoEnabled = enabledTags.some((tag) => tag.origin === "ai_auto");
  const primaryEnabled = enabledTags.some((tag) => tag.role === "primary");
  const supportingEnabled = enabledTags.some((tag) => tag.role === "supporting");
  const highRisk = hasAlwaysHumanCriterion(tags);
  const visual = isVisualEvidence(document);
  const confidence = highestConfidence(tags, document);
  const disposition: DocumentDisposition = deriveDocumentDisposition(document);
  const criterionCodes = [...new Set(tags.map((tag) => tag.code))];
  const base = {
    documentId: document.id,
    fileName: document.fileName,
    relativePath: document.relativePath,
    bundleName: document.bundleName ?? null,
    documentType: document.summary?.documentType ?? document.sourceKind,
    criterionCodes,
    highestConfidence: confidence,
  };

  if (disposition === "archived" || document.fileName === ".DS_Store") {
    return {
      ...base,
      recommendation: "exclude_initial_packet",
      score: 0.05,
      reason: "Archived or system-level file; keep out of the initial petition packet.",
    };
  }

  if (disposition === "reference") {
    return {
      ...base,
      recommendation: "exclude_initial_packet",
      score: 0.18,
      reason: "Marked as reference material rather than petition evidence.",
    };
  }

  if (!tags.length) {
    return {
      ...base,
      recommendation: "exclude_initial_packet",
      score: 0.2,
      reason: "No active criterion support yet; exclude unless attorney finds a legal use.",
    };
  }

  if (visual && !attorneyEnabled && !autoEnabled) {
    return {
      ...base,
      recommendation: "exclude_initial_packet",
      score: 0.25 + confidence * 0.15,
      reason:
        "Visual/image-style evidence is lower probative value unless paired with a substantive source.",
    };
  }

  if (highRisk && !attorneyEnabled) {
    return {
      ...base,
      recommendation: "context",
      score: 0.45 + confidence * 0.2,
      reason: "Potentially useful but tied to an RFE-prone criterion; attorney confirmation first.",
    };
  }

  if (visual) {
    return {
      ...base,
      recommendation: "context",
      score: 0.42 + confidence * 0.2,
      reason:
        "Use as corroborating context only; prefer documents with independent text, dates, and source details as anchors.",
    };
  }

  if ((attorneyEnabled || autoEnabled) && primaryEnabled && confidence >= 0.7) {
    return {
      ...base,
      recommendation: "anchor",
      score: 0.78 + confidence * 0.22 + (attorneyEnabled ? 0.1 : 0),
      reason: attorneyEnabled
        ? "Attorney-confirmed primary evidence; strong anchor candidate for Strategy."
        : "High-confidence AI-enabled primary evidence; use as a preliminary anchor candidate.",
    };
  }

  if (enabledTags.length > 0) {
    return {
      ...base,
      recommendation: "supporting",
      score: 0.58 + confidence * 0.25 + (supportingEnabled ? 0.05 : 0),
      reason: "Enabled criterion evidence that can support the petition theory.",
    };
  }

  if (suggestedTags.length > 0 && confidence >= 0.65) {
    return {
      ...base,
      recommendation: "context",
      score: 0.4 + confidence * 0.2,
      reason: "Promising AI suggestion; keep visible for Strategy but do not anchor until reviewed.",
    };
  }

  return {
    ...base,
    recommendation: "exclude_initial_packet",
    score: 0.25 + confidence * 0.1,
    reason: "Weak or ambiguous evidence signal; hold outside the initial packet for now.",
  };
}

function buildEvidencePlan(documents: PreliminaryDocument[]): PreliminaryEvidencePlan {
  const weighted = documents.map((document) => classifyEvidenceWeight(document));
  const byScoreDesc = (left: PreliminaryEvidenceWeight, right: PreliminaryEvidenceWeight) =>
    right.score - left.score;

  return {
    anchor: weighted
      .filter((entry) => entry.recommendation === "anchor")
      .sort(byScoreDesc),
    supporting: weighted
      .filter((entry) => entry.recommendation === "supporting")
      .sort(byScoreDesc),
    context: weighted
      .filter((entry) => entry.recommendation === "context")
      .sort(byScoreDesc),
    exclusions: weighted
      .filter((entry) => entry.recommendation === "exclude_initial_packet")
      .sort((left, right) => left.score - right.score),
  };
}

export function buildPreliminaryStrategyGuidance(
  documents: PreliminaryDocument[],
): PreliminaryStrategyGuidance {
  const signals = EB1A_CRITERIA_DEFINITIONS.map((criterion) => {
    const matchingDocuments = documents.filter((document) =>
      normalizeCriterionTags(document).some(
        (tag) =>
          tag.code === criterion.code &&
          tag.state !== "disabled" &&
          (tag.state === "enabled" || tag.state === "suggested"),
      ),
    );
    const matchingTags = matchingDocuments.flatMap((document) =>
      normalizeCriterionTags(document).filter(
        (tag) =>
          tag.code === criterion.code &&
          tag.state !== "disabled" &&
          (tag.state === "enabled" || tag.state === "suggested"),
      ),
    );
    const enabledTags = matchingTags.filter((tag) => tag.state === "enabled");
    const suggestedTags = matchingTags.filter((tag) => tag.state === "suggested");
    const primaryCount = matchingTags.filter((tag) => tag.role === "primary").length;
    const supportingCount = matchingTags.filter((tag) => tag.role === "supporting").length;
    const autoCount = matchingTags.filter((tag) => tag.origin === "ai_auto").length;
    const attorneyCount = matchingTags.filter((tag) => tag.origin === "attorney").length;
    const highRisk = ALWAYS_HUMAN_CRITERIA.includes(
      criterion.code as (typeof ALWAYS_HUMAN_CRITERIA)[number],
    );
    const averageConfidence = average(
      matchingTags.map((tag) => tag.aiConfidence ?? tag.confidence),
    );
    const score = scoreCriterion({
      enabledCount: enabledTags.length,
      suggestedCount: suggestedTags.length,
      primaryCount,
      supportingCount,
      autoCount,
      attorneyCount,
      averageConfidence,
      highRisk,
    });
    const strength = strengthFor({
      enabledCount: enabledTags.length,
      suggestedCount: suggestedTags.length,
      primaryCount,
      score,
      averageConfidence,
      highRisk,
    });

    return {
      code: criterion.code,
      legalCode: criterion.legalCode,
      name: criterion.name,
      strength,
      suggestedRole: "defer",
      score,
      enabledCount: enabledTags.length,
      suggestedCount: suggestedTags.length,
      primaryCount,
      supportingCount,
      autoCount,
      attorneyCount,
      highRisk,
      averageConfidence,
      rationale: rationaleFor({
        name: criterion.name,
        enabledCount: enabledTags.length,
        suggestedCount: suggestedTags.length,
        primaryCount,
        autoCount,
        attorneyCount,
        highRisk,
        averageConfidence,
      }),
      nextStep: "",
      anchorDocIds: matchingDocuments.slice(0, 6).map((document) => document.id),
    } satisfies PreliminaryCriterionSignal;
  })
    .filter((signal) => signal.enabledCount + signal.suggestedCount > 0)
    .sort((left, right) => right.score - left.score);

  const candidateCriteria = signals.map((signal, index) => {
    const suggestedRole = roleFor(signal.strength, index);

    return {
      ...signal,
      suggestedRole,
      nextStep: nextStepFor({
        strength: signal.strength,
        suggestedRole,
        highRisk: signal.highRisk,
        enabledCount: signal.enabledCount,
      }),
    };
  });
  const primary = candidateCriteria.filter((signal) => signal.suggestedRole === "primary");
  const supporting = candidateCriteria.filter((signal) => signal.suggestedRole === "supporting");
  const defer = candidateCriteria.filter((signal) => signal.suggestedRole === "defer");
  const highRiskCandidates = candidateCriteria.filter((signal) => signal.highRisk);
  const exceptionDocuments = documents.filter(
    (document) => document.needsHumanReview ?? document.reviewLoadStatus === "needs_review",
  ).length;
  const evidencePlan = buildEvidencePlan(documents);
  const attorneyFocus = [
    highRiskCandidates.length
      ? `Confirm ${highRiskCandidates.map((signal) => signal.name).join(", ")} before relying on them as claimed criteria.`
      : null,
    exceptionDocuments > 0
      ? `${exceptionDocuments} document(s) remain in exception review; use them to refine, not block, the first strategy pass.`
      : "No exception-review blockers remain for the preliminary strategy pass.",
    primary.length < 3
      ? "Strategy should test whether a supporting criterion can become the third claimed criterion."
      : null,
    evidencePlan.exclusions.length > 0
      ? `${evidencePlan.exclusions.length} document(s) are currently excluded from the initial packet with reasons preserved for override.`
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    totalDocuments: documents.length,
    autoTaggedDocuments: documents.filter(
      (document) => document.reviewLoadStatus === "auto_cleared",
    ).length,
    exceptionDocuments,
    candidateCriteria,
    primary,
    supporting,
    defer,
    draftStart: [...primary, ...supporting].slice(0, 5),
    evidencePlan,
    attorneyFocus,
  };
}
