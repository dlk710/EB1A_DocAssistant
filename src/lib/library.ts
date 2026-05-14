import { buildWorkspaceCoverage } from "@/lib/coverage";
import { ensureWorkspaceCriteriaTagging } from "@/lib/criteria-tagging";
import { ensureWorkspaceEb1aClassification } from "@/lib/eb1a-classification";
import { ensureWorkspaceEventBundles } from "@/lib/event-bundles";
import { listJobs } from "@/lib/jobs";
import {
  applyWorkspaceManualOverrides,
  getWorkspaceManualOverrideState,
} from "@/lib/manual-overrides";
import { ensureQdrantCollection, getJobDocuments } from "@/lib/qdrant";
import { getWorkspaceReviewState } from "@/lib/review-state";
import { getPublicSettings, getRuntimeSettings } from "@/lib/settings";
import type {
  ClientDocument,
  JobRecord,
  LibraryOverview,
  LibrarySnapshot,
  StoredDocument,
} from "@/lib/types";

export function sanitizeDocument(document: StoredDocument): ClientDocument {
  const { absolutePath, checksum, ...rest } = document;

  void absolutePath;
  void checksum;

  return rest;
}

function buildOverviewFromDocuments(documents: StoredDocument[]): LibraryOverview {
  const totalOpenAiCostUsd = Math.round(
    documents.reduce((sum, document) => sum + (document.usage?.totalCostUsd ?? 0), 0) *
      1_000_000,
  ) / 1_000_000;

  return {
    totalDocuments: documents.length,
    completedDocuments: documents.filter((document) => document.processingStatus === "completed")
      .length,
    failedDocuments: documents.filter((document) => document.processingStatus === "failed").length,
    processingDocuments: documents.filter(
      (document) =>
        document.processingStatus === "queued" || document.processingStatus === "processing",
    ).length,
    latestCompletionAt:
      documents
        .filter((document) => document.processingStatus === "completed")
        .map((document) => document.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ?? null,
    totalOpenAiCostUsd,
  };
}

function resolveActiveJob(jobs: JobRecord[], requestedJobId?: string | null) {
  if (!jobs.length) {
    return null;
  }

  if (requestedJobId) {
    return jobs.find((job) => job.id === requestedJobId) ?? jobs[0];
  }

  return jobs[0];
}

export async function buildLibrarySnapshot(input?: {
  jobId?: string | null;
}): Promise<LibrarySnapshot> {
  const settings = getRuntimeSettings();
  await ensureQdrantCollection(settings.embeddingDimensions);
  const jobs = listJobs(40);
  const activeJob = resolveActiveJob(jobs, input?.jobId);
  const documents = activeJob ? await getJobDocuments(activeJob.id) : [];
  const rawEventBundles = activeJob
    ? ensureWorkspaceEventBundles(activeJob.id, documents)
    : null;
  const rawEb1aClassification = activeJob
    ? ensureWorkspaceEb1aClassification(
        activeJob.id,
        activeJob.candidateName,
        rawEventBundles,
        documents,
      )
    : null;
  const manualOverrides = activeJob
    ? getWorkspaceManualOverrideState(activeJob.id, settings.outputRootPath)
    : null;
  const effectiveStates =
    activeJob && manualOverrides
      ? applyWorkspaceManualOverrides({
          jobId: activeJob.id,
          eventBundles: rawEventBundles,
          classification: rawEb1aClassification,
          documents,
          overrideState: manualOverrides,
        })
      : {
          eventBundles: rawEventBundles,
          classification: rawEb1aClassification,
          overrideState: manualOverrides,
        };
  const criteriaTagging =
    activeJob && effectiveStates.eventBundles && effectiveStates.classification
      ? ensureWorkspaceCriteriaTagging(
          activeJob.id,
          activeJob.candidateName,
          effectiveStates.eventBundles,
          effectiveStates.classification,
          documents,
        )
      : null;
  const reviewState = activeJob ? getWorkspaceReviewState(activeJob.id) : null;

  return {
    activeJobId: activeJob?.id ?? null,
    activeJob,
    overview: buildOverviewFromDocuments(documents),
    jobs,
    documents: documents.map(sanitizeDocument),
    eventBundles: effectiveStates.eventBundles,
    eb1aClassification: effectiveStates.classification,
    criteriaTagging,
    coverage: buildWorkspaceCoverage(documents),
    manualOverrides: effectiveStates.overrideState,
    reviewState,
    settings: getPublicSettings(),
  };
}
