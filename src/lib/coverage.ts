import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import {
  deriveDocumentDisposition,
  normalizeCriterionTags,
} from "@/lib/criterion-tags";
import type { ClientDocument, StoredDocument, WorkspaceCoverage } from "@/lib/types";

function isCountableDocument(document: ClientDocument | StoredDocument) {
  return deriveDocumentDisposition(document) === "tagged";
}

export function buildWorkspaceCoverage(
  documents: Array<ClientDocument | StoredDocument>,
): WorkspaceCoverage {
  const criteria = EB1A_CRITERIA_DEFINITIONS.map((criterion) => {
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
    const state =
      primaryCount >= 1 || supportingCount >= 2
        ? "strong"
        : supportingCount >= 1
          ? "partial"
          : "empty";

    return {
      code: criterion.code,
      legalCode: criterion.legalCode,
      name: criterion.name,
      state,
      keptCount: matchingDocuments.length,
      primaryCount,
      supportingCount,
    } as const;
  });

  const strongCount = criteria.filter((criterion) => criterion.state === "strong").length;

  return {
    strongCount,
    meetsMinimum: strongCount >= 3,
    criteria,
  };
}

export function buildClientCoverage(
  documents: Array<ClientDocument | StoredDocument>,
): WorkspaceCoverage {
  return buildWorkspaceCoverage(documents);
}
