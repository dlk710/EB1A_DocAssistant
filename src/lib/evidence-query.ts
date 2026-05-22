import { listClientJobs } from "@/lib/clients";
import {
  deriveDocumentDisposition,
  getHighestAiConfidence,
  hasSuggestedCriterionTag,
  normalizeCriterionTags,
  normalizeStoredDocument,
} from "@/lib/criterion-tags";
import { ensureWorkspaceEb1aClassification } from "@/lib/eb1a-classification";
import { ensureWorkspaceEventBundles } from "@/lib/event-bundles";
import {
  applyWorkspaceManualOverrides,
  getWorkspaceManualOverrideState,
} from "@/lib/manual-overrides";
import { getDocumentsForJobs } from "@/lib/qdrant";
import { getRuntimeSettings } from "@/lib/settings";
import type {
  ClientDocument,
  DocumentDisposition,
  EvidenceCriterionTag,
  StoredDocument,
} from "@/lib/types";

export interface EvidenceGridDocument extends ClientDocument {
  bundleId: string | null;
  bundleName: string | null;
  confidenceScore: number;
  contentPreview: string;
  needsHumanReview: boolean;
}

export interface EvidenceGridBundleOption {
  id: string;
  name: string;
  jobId: string;
}

export interface EvidenceGridQuery {
  workspaceId?: string | null;
  bundleId?: string | null;
  criterionCode?: string | null;
  state?: string | null;
  disposition?: DocumentDisposition | null;
  search?: string | null;
  aiUnsure?: boolean;
}

function buildSearchHaystack(document: EvidenceGridDocument) {
  return [
    document.fileName,
    document.relativePath,
    document.summary?.title,
    document.summary?.shortSummary,
    document.summary?.detailedSummary,
    document.metadata?.preview,
    document.bundleName,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function buildBundleLookup(documents: StoredDocument[]) {
  const settings = getRuntimeSettings();
  const bundleLookup = new Map<string, { id: string; name: string }>();
  const bundleOptions = new Map<string, EvidenceGridBundleOption>();

  const documentsByJob = new Map<string, StoredDocument[]>();
  documents.forEach((document) => {
    const group = documentsByJob.get(document.jobId) ?? [];
    group.push(document);
    documentsByJob.set(document.jobId, group);
  });

  for (const [jobId, jobDocuments] of documentsByJob.entries()) {
    const rawEventBundles = ensureWorkspaceEventBundles(jobId, jobDocuments);

    if (!rawEventBundles) {
      continue;
    }

    const classification = ensureWorkspaceEb1aClassification(
      jobId,
      jobDocuments[0]?.candidateName ?? "",
      rawEventBundles,
      jobDocuments,
    );
    const overrideState = getWorkspaceManualOverrideState(jobId, settings.outputRootPath);
    const effectiveStates = applyWorkspaceManualOverrides({
      jobId,
      documents: jobDocuments,
      eventBundles: rawEventBundles,
      classification,
      overrideState,
    });

    effectiveStates.eventBundles?.bundles
      .filter((bundle) => bundle.bundleKind === "standard")
      .forEach((bundle) => {
        bundleOptions.set(bundle.id, {
          id: bundle.id,
          name: bundle.name,
          jobId,
        });
        bundle.evidenceDocumentIds.forEach((documentId) => {
          bundleLookup.set(documentId, {
            id: bundle.id,
            name: bundle.name,
          });
        });
      });
  }

  return {
    bundleLookup,
    bundleOptions: [...bundleOptions.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  };
}

export async function queryClientEvidence(
  clientId: string,
  query: EvidenceGridQuery = {},
) {
  const jobs = listClientJobs(clientId);
  const documents =
    jobs.length > 0 ? await getDocumentsForJobs(jobs.map((job) => job.id)) : [];
  const normalized = documents.map((document) => normalizeStoredDocument(document).document);
  const bundleState = buildBundleLookup(normalized);
  const mapped: EvidenceGridDocument[] = normalized.map((document) => {
    const bundle = bundleState.bundleLookup.get(document.id);
    const disposition = deriveDocumentDisposition(document);
    const tags = normalizeCriterionTags(document);
    const needsHumanReview =
      disposition === "untouched" ||
      tags.some((tag) => tag.state === "suggested") ||
      (disposition === "tagged" && tags.every((tag) => tag.state !== "enabled"));

    return {
      ...document,
      disposition,
      criteriaTags: tags,
      bundleId: bundle?.id ?? null,
      bundleName: bundle?.name ?? null,
      confidenceScore: getHighestAiConfidence(document),
      contentPreview:
        document.metadata?.preview ||
        document.summary?.detailedSummary ||
        document.summary?.shortSummary ||
        "Preview unavailable.",
      needsHumanReview,
    };
  });

  const filtered = mapped.filter((document) => {
    if (query.workspaceId && document.jobId !== query.workspaceId) {
      return false;
    }

    if (query.bundleId && document.bundleId !== query.bundleId) {
      return false;
    }

    if (query.criterionCode) {
      const wantedCode = query.criterionCode;
      if (!document.criteriaTags.some((tag) => tag.code === wantedCode)) {
        return false;
      }
    }

    if (query.state) {
      if (!document.criteriaTags.some((tag) => tag.state === query.state)) {
        return false;
      }
    }

    if (query.disposition && deriveDocumentDisposition(document) !== query.disposition) {
      return false;
    }

    if (query.aiUnsure) {
      const hasUncertainSuggestion =
        hasSuggestedCriterionTag(document) ||
        document.criteriaTags.some((tag) => (tag.aiConfidence ?? tag.confidence) < 0.4);

      if (!hasUncertainSuggestion) {
        return false;
      }
    }

    if (query.search) {
      const needle = query.search.trim().toLowerCase();
      if (needle && !buildSearchHaystack(document).includes(needle)) {
        return false;
      }
    }

    return true;
  });

  return {
    documents: filtered,
    bundles: bundleState.bundleOptions,
    workspaces: jobs.map((job) => ({
      id: job.id,
      name: job.folderLabel,
    })),
  };
}

export function groupEvidenceTagsByState(tags: EvidenceCriterionTag[]) {
  const normalized = normalizeCriterionTags({
    id: "preview",
    jobId: "preview",
    updatedAt: new Date(0).toISOString(),
    reviewStatus: "pending",
    disposition: "untouched",
    criteriaTags: tags,
  });

  return {
    enabled: normalized.filter((tag) => tag.state === "enabled"),
    suggested: normalized.filter((tag) => tag.state === "suggested"),
    disabled: normalized.filter((tag) => tag.state === "disabled"),
  };
}
