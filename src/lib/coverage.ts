import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import {
  deriveDocumentDisposition,
  normalizeCriterionTags,
} from "@/lib/criterion-tags";
import { assessEvidenceDecisiveness } from "@/lib/evidence-decisiveness";
import type {
  ClientDocument,
  StoredDocument,
  WorkspaceCoverage,
  WorkspaceCriterionRecommendation,
} from "@/lib/types";

function isCountableDocument(document: ClientDocument | StoredDocument) {
  return deriveDocumentDisposition(document) === "tagged";
}

function scoreCriterionStrategy(input: {
  keptCount: number;
  primaryCount: number;
  supportingCount: number;
  decisiveIndependentCount: number;
  liabilityCount: number;
  redFlagCount: number;
}) {
  return (
    input.primaryCount * 2.5 +
    input.supportingCount * 1.25 +
    input.decisiveIndependentCount * 3 +
    input.keptCount * 0.35 -
    input.liabilityCount * 2.25 -
    input.redFlagCount * 0.75
  );
}

function strategyRationale(input: {
  name: string;
  keptCount: number;
  decisiveIndependentCount: number;
  liabilityCount: number;
  redFlagCount: number;
  role: WorkspaceCriterionRecommendation["role"];
}) {
  if (input.role === "drop") {
    if (input.liabilityCount > 0 || input.redFlagCount > 0) {
      return `${input.name} has risk-heavy evidence; keep it available, but do not lead with it unless the attorney overrides.`;
    }

    return `${input.name} does not yet have enough load-bearing evidence to justify petition focus.`;
  }

  if (input.decisiveIndependentCount > 0) {
    return `${input.name} has ${input.decisiveIndependentCount} decisive, independent exhibit(s) and can carry strategy discussion.`;
  }

  return `${input.name} has ${input.keptCount} enabled exhibit(s), but Strategy should confirm whether the proof is strong enough.`;
}

export function buildWorkspaceCoverage(
  documents: Array<ClientDocument | StoredDocument>,
): WorkspaceCoverage {
  const criteriaWithDocs = EB1A_CRITERIA_DEFINITIONS.map((criterion) => {
    const matchingDocuments = documents.filter(
      (document) =>
        isCountableDocument(document) &&
        normalizeCriterionTags({
          id: document.id,
          jobId: document.jobId,
          updatedAt: document.updatedAt,
          reviewStatus: document.reviewStatus,
          disposition: document.disposition,
          criteriaTags: document.criteriaTags,
        }).some((tag) => tag.code === criterion.code && tag.state === "enabled"),
    );
    const primaryCount = matchingDocuments.filter((document) =>
      normalizeCriterionTags({
        id: document.id,
        jobId: document.jobId,
        updatedAt: document.updatedAt,
        reviewStatus: document.reviewStatus,
        disposition: document.disposition,
        criteriaTags: document.criteriaTags,
      }).some(
        (tag) => tag.code === criterion.code && tag.role === "primary" && tag.state === "enabled",
      ),
    ).length;
    const supportingCount = matchingDocuments.filter((document) =>
      normalizeCriterionTags({
        id: document.id,
        jobId: document.jobId,
        updatedAt: document.updatedAt,
        reviewStatus: document.reviewStatus,
        disposition: document.disposition,
        criteriaTags: document.criteriaTags,
      }).some(
        (tag) =>
          tag.code === criterion.code &&
          tag.role === "supporting" &&
          tag.state === "enabled",
      ),
    ).length;
    const state: WorkspaceCoverage["criteria"][number]["state"] =
      primaryCount >= 1 || supportingCount >= 2
        ? "strong"
        : supportingCount >= 1
          ? "partial"
          : "empty";
    const decisiveness = matchingDocuments.map((document) =>
      assessEvidenceDecisiveness({
        ...document,
        criteriaTags: normalizeCriterionTags({
          id: document.id,
          jobId: document.jobId,
          updatedAt: document.updatedAt,
          reviewStatus: document.reviewStatus,
          disposition: document.disposition,
          criteriaTags: document.criteriaTags,
        }),
      }),
    );
    const decisiveIndependentCount = decisiveness.filter(
      (entry) => entry.tier === "decisive" && entry.independent,
    ).length;
    const liabilityCount = decisiveness.filter((entry) => entry.tier === "liability").length;
    const redFlagCount = decisiveness.reduce(
      (sum, entry) => sum + entry.redFlags.length,
      0,
    );
    const strategyScore = scoreCriterionStrategy({
      keptCount: matchingDocuments.length,
      primaryCount,
      supportingCount,
      decisiveIndependentCount,
      liabilityCount,
      redFlagCount,
    });

    return {
      criterion,
      matchingDocuments,
      coverage: {
        code: criterion.code,
        legalCode: criterion.legalCode,
        name: criterion.name,
        state,
        keptCount: matchingDocuments.length,
        primaryCount,
        supportingCount,
        decisiveIndependentCount,
        liabilityCount,
        redFlagCount,
        strategyScore,
      },
    };
  });
  const ranked = criteriaWithDocs
    .filter((entry) => entry.coverage.keptCount > 0)
    .sort((left, right) => right.coverage.strategyScore - left.coverage.strategyScore);
  const buildAroundCodes = new Set(ranked.slice(0, 5).map((entry) => entry.coverage.code));
  const recommendations = ranked.map((entry, index): WorkspaceCriterionRecommendation => {
    const role: WorkspaceCriterionRecommendation["role"] =
      buildAroundCodes.has(entry.coverage.code)
        ? index < 3
          ? "primary"
          : "supporting"
        : "drop";
    const anchorDocIds = entry.matchingDocuments
      .map((document) => ({
        id: document.id,
        score: assessEvidenceDecisiveness({
          ...document,
          criteriaTags: normalizeCriterionTags({
            id: document.id,
            jobId: document.jobId,
            updatedAt: document.updatedAt,
            reviewStatus: document.reviewStatus,
            disposition: document.disposition,
            criteriaTags: document.criteriaTags,
          }),
        }).loadBearingScore,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 6)
      .map((entry) => entry.id);
    const rationale = strategyRationale({
      name: entry.coverage.name,
      keptCount: entry.coverage.keptCount,
      decisiveIndependentCount: entry.coverage.decisiveIndependentCount,
      liabilityCount: entry.coverage.liabilityCount,
      redFlagCount: entry.coverage.redFlagCount,
      role,
    });

    return {
      criterionCode: entry.coverage.code,
      legalCode: entry.coverage.legalCode,
      name: entry.coverage.name,
      role,
      score: Number(entry.coverage.strategyScore.toFixed(2)),
      decisiveIndependentCount: entry.coverage.decisiveIndependentCount,
      liabilityCount: entry.coverage.liabilityCount,
      redFlagCount: entry.coverage.redFlagCount,
      anchorDocIds,
      rationale,
    };
  });
  const rationaleByCode = new Map(
    recommendations.map((recommendation) => [
      recommendation.criterionCode,
      recommendation.rationale,
    ]),
  );
  const criteria = criteriaWithDocs.map((entry) => ({
    ...entry.coverage,
    strategyScore: Number(entry.coverage.strategyScore.toFixed(2)),
    strategyRationale: rationaleByCode.get(entry.coverage.code),
  }));

  const strongCount = criteria.filter((criterion) => criterion.state === "strong").length;

  return {
    strongCount,
    meetsMinimum: strongCount >= 3,
    criteria,
    recommendations: {
      buildAround: recommendations.filter((recommendation) => recommendation.role !== "drop"),
      drop: recommendations.filter((recommendation) => recommendation.role === "drop"),
    },
  };
}

export function buildClientCoverage(
  documents: Array<ClientDocument | StoredDocument>,
): WorkspaceCoverage {
  return buildWorkspaceCoverage(documents);
}
