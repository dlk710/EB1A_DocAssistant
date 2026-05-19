import { buildClientCoverage, buildWorkspaceCoverage } from "@/lib/coverage";
import { ensureClientsHydrated, getClient, listClients } from "@/lib/clients";
import { ensureWorkspaceCriteriaTagging } from "@/lib/criteria-tagging";
import { ensureWorkspaceEb1aClassification } from "@/lib/eb1a-classification";
import { ensureWorkspaceEventBundles } from "@/lib/event-bundles";
import {
  applyWorkspaceManualOverrides,
  getWorkspaceManualOverrideState,
} from "@/lib/manual-overrides";
import { ensureQdrantCollection, getDocumentsForJobs, getJobDocuments } from "@/lib/qdrant";
import { getWorkspaceReviewState } from "@/lib/review-state";
import { getPublicSettings, getRuntimeSettings } from "@/lib/settings";
import { readStateFile } from "@/lib/state-store";
import type {
  ClientDocument,
  ClientWorkspace,
  WorkspaceCriteriaTaggingState,
  WorkspaceEb1aClassificationState,
  WorkspaceEventBundleState,
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

function readWorkspaceEventBundleState(jobId: string) {
  const file = readStateFile<{ workspaces: Record<string, WorkspaceEventBundleState> }>(
    "event-bundles.json",
    { workspaces: {} },
  );

  return file.workspaces[jobId] ?? null;
}

function readWorkspaceClassificationState(jobId: string) {
  const file = readStateFile<{ workspaces: Record<string, WorkspaceEb1aClassificationState> }>(
    "eb1a-classification.json",
    { workspaces: {} },
  );

  return file.workspaces[jobId] ?? null;
}

function readWorkspaceTaggingState(jobId: string) {
  const file = readStateFile<{ workspaces: Record<string, WorkspaceCriteriaTaggingState> }>(
    "criteria-tagging.json",
    { workspaces: {} },
  );

  return file.workspaces[jobId] ?? null;
}

export async function buildLibrarySnapshot(input?: {
  jobId?: string | null;
  clientId?: string | null;
}): Promise<LibrarySnapshot> {
  const settings = getRuntimeSettings();
  await ensureQdrantCollection(settings.embeddingDimensions);
  const allJobs = ensureClientsHydrated();
  const jobs = input?.clientId
    ? allJobs.filter((job) => job.clientId === input.clientId)
    : allJobs.slice(0, 40);
  const activeJob = resolveActiveJob(jobs, input?.jobId);
  const activeClientId = input?.clientId ?? activeJob?.clientId ?? null;
  const activeClient = activeClientId ? getClient(activeClientId) : null;
  const clientJobIds = jobs.map((job) => job.id);
  const clientDocumentsRaw = clientJobIds.length ? await getDocumentsForJobs(clientJobIds) : [];
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
  const clientWorkspaces: ClientWorkspace[] = jobs.map((job) => {
    const clientJobDocuments = clientDocumentsRaw.filter((document) => document.jobId === job.id);
    const bundleState = readWorkspaceEventBundleState(job.id);
    const classificationState = readWorkspaceClassificationState(job.id);
    const taggingState = readWorkspaceTaggingState(job.id);
    const latestUpdatedAt =
      clientJobDocuments
        .map((document) => document.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ??
      job.completedAt ??
      job.startedAt ??
      job.createdAt;

    const ready =
      (job.status === "completed" || job.status === "completed_with_errors") &&
      bundleState?.status === "completed" &&
      classificationState?.status === "completed" &&
      taggingState?.status === "completed";

    return {
      id: job.id,
      clientId: job.clientId,
      candidateName: job.candidateName,
      folderLabel: job.folderLabel,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      updatedAt: latestUpdatedAt,
      ready,
      failedFiles: job.failedFiles,
    };
  });

  return {
    activeClientId,
    activeClient,
    clients: listClients(),
    activeJobId: activeJob?.id ?? null,
    activeJob,
    overview: buildOverviewFromDocuments(documents),
    clientOverview: buildOverviewFromDocuments(clientDocumentsRaw),
    jobs,
    clientWorkspaces,
    documents: documents.map(sanitizeDocument),
    clientDocuments: clientDocumentsRaw.map(sanitizeDocument),
    eventBundles: effectiveStates.eventBundles,
    eb1aClassification: effectiveStates.classification,
    criteriaTagging,
    coverage: buildWorkspaceCoverage(documents),
    clientCoverage: buildClientCoverage(clientDocumentsRaw),
    manualOverrides: effectiveStates.overrideState,
    reviewState,
    settings: getPublicSettings(),
  };
}
