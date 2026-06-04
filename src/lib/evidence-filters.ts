import type { EvidenceGridDocument } from "@/lib/evidence-query";
import type { ClientDocument, StoredDocument } from "@/lib/types";

export type ObjectiveEvidenceFilter = "" | "objective" | "subjective" | "mixed";

type ReviewableEvidenceFile = Pick<
  StoredDocument | ClientDocument,
  "fileName" | "extension" | "mimeType" | "disposition" | "reviewStatus"
>;

const SYSTEM_FILE_NAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  "__macosx",
]);

const NON_PROBATIVE_EXTENSIONS = new Set(["tmp", "temp", "ini", "db"]);

export function isReviewableEvidenceFile(document: ReviewableEvidenceFile) {
  const fileName = document.fileName.trim().toLowerCase();
  const extension = document.extension.toLowerCase().replace(/^\./, "");

  if (!fileName || SYSTEM_FILE_NAMES.has(fileName)) {
    return false;
  }

  if (fileName.startsWith("._") || fileName.includes("__macosx")) {
    return false;
  }

  if (NON_PROBATIVE_EXTENSIONS.has(extension)) {
    return false;
  }

  if (document.disposition === "archived" || document.reviewStatus === "archived") {
    return false;
  }

  return true;
}

export function matchesObjectiveEvidenceFilter(
  document: Pick<EvidenceGridDocument, "decisiveness">,
  filter: ObjectiveEvidenceFilter,
) {
  return !filter || document.decisiveness.objectiveEvidence === filter;
}
