import { normalizeCriterionTags } from "@/lib/criterion-tags";
import {
  findBlueFlagHits,
  findRedFlagHits,
  type BlueFlagHit,
  type RedFlagHit,
} from "@/lib/flag-rules";
import { findSuccessTagPriorHits } from "@/lib/success-patterns";
import type { ClientDocument, StoredDocument } from "@/lib/types";

export type EvidenceDecisivenessTier =
  | "decisive"
  | "corroborating"
  | "contextual"
  | "liability";

export interface EvidenceDecisivenessAssessment {
  tier: EvidenceDecisivenessTier;
  loadBearingScore: number;
  independent: boolean;
  objectiveEvidence: "objective" | "subjective" | "mixed";
  rfeRisk: "low" | "medium" | "high";
  redFlags: RedFlagHit[];
  blueFlags: BlueFlagHit[];
  rationale: string;
}

type EvidenceDocument = Pick<
  StoredDocument | ClientDocument,
  | "id"
  | "jobId"
  | "updatedAt"
  | "criteriaTags"
  | "reviewStatus"
  | "disposition"
  | "summary"
  | "fileName"
  | "relativePath"
  | "metadata"
>;

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function maxSeverity(hits: RedFlagHit[]) {
  if (hits.some((hit) => hit.severity === "high")) {
    return "high" as const;
  }

  if (hits.some((hit) => hit.severity === "medium")) {
    return "medium" as const;
  }

  return hits.length ? ("low" as const) : ("low" as const);
}

function tierFor(score: number, redFlags: RedFlagHit[]) {
  if (redFlags.some((hit) => hit.severity === "high") || score < 0.25) {
    return "liability" satisfies EvidenceDecisivenessTier;
  }

  if (score >= 0.78) {
    return "decisive" satisfies EvidenceDecisivenessTier;
  }

  if (score >= 0.52) {
    return "corroborating" satisfies EvidenceDecisivenessTier;
  }

  return "contextual" satisfies EvidenceDecisivenessTier;
}

export function assessEvidenceDecisiveness(
  document: EvidenceDocument,
): EvidenceDecisivenessAssessment {
  const tags = normalizeCriterionTags(document);
  const enabledTags = tags.filter((tag) => tag.state === "enabled");
  const suggestedTags = tags.filter((tag) => tag.state === "suggested");
  const redFlags = findRedFlagHits(document);
  const blueFlags = findBlueFlagHits(document);
  const successPatternHits = findSuccessTagPriorHits(document);
  const objectiveEvidence = document.summary?.objectiveEvidence ?? "mixed";
  const independent =
    objectiveEvidence === "objective" ||
    blueFlags.length > 0 ||
    document.summary?.publicationType === "peer_reviewed_journal" ||
    document.summary?.publicationType === "mainstream_media";
  const confidence =
    Math.max(
      document.summary?.confidence ?? 0,
      ...tags.map((tag) => (tag.aiConfidence ?? tag.confidence) * 100),
    ) / 100;
  const tagScore = enabledTags.length > 0 ? 0.32 : suggestedTags.length > 0 ? 0.14 : 0;
  const roleScore = enabledTags.some((tag) => tag.role === "primary") ? 0.18 : 0;
  const objectiveScore =
    objectiveEvidence === "objective" ? 0.18 : objectiveEvidence === "mixed" ? 0.08 : -0.12;
  const blueScore = blueFlags.reduce(
    (score, hit) => score + (hit.strength === "high" ? 0.14 : 0.09),
    0,
  );
  const successPatternScore = successPatternHits.length > 0 ? 0.08 : 0;
  const redPenalty = redFlags.reduce(
    (score, hit) =>
      score + (hit.severity === "high" ? 0.42 : hit.severity === "medium" ? 0.24 : 0.1),
    0,
  );
  const loadBearingScore = clampScore(
    confidence * 0.36 +
      tagScore +
      roleScore +
      objectiveScore +
      blueScore +
      successPatternScore -
      redPenalty,
  );
  const tier = tierFor(loadBearingScore, redFlags);
  const rfeRisk =
    redFlags.some((hit) => hit.severity === "high") || tier === "liability"
      ? "high"
      : redFlags.length > 0 || objectiveEvidence === "subjective"
        ? "medium"
        : maxSeverity(redFlags);

  return {
    tier,
    loadBearingScore,
    independent,
    objectiveEvidence,
    rfeRisk,
    redFlags,
    blueFlags,
    rationale:
      redFlags.length > 0
        ? redFlags.map((hit) => hit.rationale).join(" ")
        : blueFlags.length > 0
          ? `${blueFlags[0].rationale} Attach indexing or impact proof before relying on the venue.`
          : successPatternHits.length > 0
            ? `Matches public EB-1A source pattern for criterion ${successPatternHits[0].criterionCode}: ${successPatternHits[0].rationale}`
          : independent
            ? "Objective or independent evidence signal supports petition use."
            : "Evidence appears contextual or subjective and should be corroborated.",
  };
}
