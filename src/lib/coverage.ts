import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import type { ClientDocument, StoredDocument, WorkspaceCoverage } from "@/lib/types";

function isKeptDocument(document: ClientDocument | StoredDocument) {
  return document.reviewStatus === "kept";
}

export function buildWorkspaceCoverage(
  documents: Array<ClientDocument | StoredDocument>,
): WorkspaceCoverage {
  const criteria = EB1A_CRITERIA_DEFINITIONS.map((criterion) => {
    const matchingDocuments = documents.filter(
      (document) =>
        isKeptDocument(document) &&
        document.criteriaTags.some((tag) => tag.code === criterion.code),
    );
    const primaryCount = matchingDocuments.filter((document) =>
      document.criteriaTags.some((tag) => tag.code === criterion.code && tag.role === "primary"),
    ).length;
    const supportingCount = matchingDocuments.filter((document) =>
      document.criteriaTags.some(
        (tag) => tag.code === criterion.code && tag.role === "supporting",
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
