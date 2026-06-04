import crypto from "node:crypto";
import { tagDocumentCriteria } from "@/lib/ai";
import { boundedConcurrency, runWithConcurrency } from "@/lib/concurrency";
import { normalizeCriterionTags } from "@/lib/criterion-tags";
import {
  decideTagDisposition,
  normalizeDocumentType,
} from "@/lib/criterion-routing";
import { buildFolderContextText } from "@/lib/folder-context";
import { findSuccessTagPriorForCriterion } from "@/lib/success-patterns";
import {
  clearJobCancellationRequest,
  getJob,
  isJobCancellationRequested,
} from "@/lib/jobs";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import { getRuntimeSettings } from "@/lib/settings";
import { setDocumentPayload } from "@/lib/qdrant";
import type {
  CriterionTagOrigin,
  CriterionTagState,
  StoredDocument,
  WorkspaceCriteriaTaggingState,
  WorkspaceEb1aClassificationState,
  WorkspaceEventBundleState,
} from "@/lib/types";

interface CriteriaTaggingStateFile {
  workspaces: Record<string, WorkspaceCriteriaTaggingState>;
}

const CRITERIA_TAGGING_FILE = "criteria-tagging.json";
const CRITERIA_TAGGING_VERSION = 6;
const CRITERIA_TAGGING_CONCURRENCY = boundedConcurrency(
  process.env.EB1A_TAGGING_CONCURRENCY,
  4,
  8,
);

declare global {
  var __eb1aActiveTaggingJobs: Set<string> | undefined;
}

const activeTaggingJobs = globalThis.__eb1aActiveTaggingJobs ?? new Set<string>();
globalThis.__eb1aActiveTaggingJobs = activeTaggingJobs;

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function buildSuggestedTags(document: StoredDocument, tags: StoredDocument["criteriaTags"]) {
  const now = new Date().toISOString();
  const existingStableTags = normalizeCriterionTags(document).filter(
    (tag) => tag.origin === "attorney" || tag.state === "enabled" || tag.state === "disabled",
  );
  const documentType = normalizeDocumentType(document.summary?.documentType);
  const suggestedTags = tags.map((tag) => {
    const successPrior = findSuccessTagPriorForCriterion(document, tag.code);
    const decision = decideTagDisposition({
      bundleId: document.id,
      proposedCriterionCode: tag.code,
      modelConfidence: typeof tag.confidence === "number" ? tag.confidence : 0,
      documentType,
      sourcePriorCriterionCode: successPrior?.criterionCode ?? null,
      sourcePriorReason: successPrior?.rationale ?? null,
      sourcePriorMinimumConfidence: successPrior?.minimumConfidence ?? null,
    });
    const autoEnabled = decision.disposition === "auto_enable";
    const origin: CriterionTagOrigin = autoEnabled ? "ai_auto" : "ai";
    const state: CriterionTagState = autoEnabled ? "enabled" : "suggested";

    return {
      ...tag,
      id: tag.id ?? `${document.id}:${tag.code}`,
      documentId: document.id,
      workspaceId: document.jobId,
      criterionCode: tag.code,
      origin,
      state,
      aiConfidence: tag.confidence,
      autoTagReason: decision.reason,
      createdAt: tag.createdAt ?? tag.taggedAt ?? now,
      updatedAt: now,
    };
  });

  return normalizeCriterionTags({
    ...document,
    criteriaTags: [...existingStableTags, ...suggestedTags],
    reviewStatus: "pending",
    disposition: "untouched",
  });
}

function readCriteriaTaggingStateFile() {
  return readStateFile<CriteriaTaggingStateFile>(CRITERIA_TAGGING_FILE, {
    workspaces: {},
  });
}

function writeCriteriaTaggingStateFile(state: CriteriaTaggingStateFile) {
  writeStateFile(CRITERIA_TAGGING_FILE, state);
}

function promptFingerprint(
  template: string,
  candidateName: string,
  folderSignalPolicy: string,
) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ template, candidateName, folderSignalPolicy }))
    .digest("hex");
}

export function getStoredCriteriaTaggingState(jobId: string) {
  const stored = readCriteriaTaggingStateFile().workspaces[jobId];

  if (!stored) {
    return null;
  }

  return {
    ...stored,
    version: stored.version ?? 1,
    sourceBundleUpdatedAt: stored.sourceBundleUpdatedAt ?? null,
    sourceClassificationUpdatedAt: stored.sourceClassificationUpdatedAt ?? null,
  } satisfies WorkspaceCriteriaTaggingState;
}

export function saveWorkspaceCriteriaTaggingState(
  jobId: string,
  state: WorkspaceCriteriaTaggingState,
) {
  const file = readCriteriaTaggingStateFile();
  file.workspaces[jobId] = state;
  writeCriteriaTaggingStateFile(file);
}

function getDocumentsFingerprint(documents: StoredDocument[]) {
  const reviewableDocuments = documents.filter(
    (document) => document.processingStatus === "completed" && document.summary,
  );

  return {
    sourceDocumentCount: reviewableDocuments.length,
    sourceLatestDocumentUpdateAt:
      reviewableDocuments
        .map((document) => document.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ?? null,
  };
}

function buildSyntheticTaggingState(
  jobId: string,
  documents: StoredDocument[],
  eventBundles: WorkspaceEventBundleState | null,
  classification: WorkspaceEb1aClassificationState | null,
  message: string,
): WorkspaceCriteriaTaggingState {
  const settings = getRuntimeSettings();
  const fingerprint = getDocumentsFingerprint(documents);

  return {
    version: CRITERIA_TAGGING_VERSION,
    jobId,
    status: "idle",
    message,
    taggedDocuments: 0,
    failedDocumentIds: [],
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    sourceBundleVersion: eventBundles?.version ?? 0,
    sourceClassificationVersion: classification?.version ?? 0,
    sourceBundleUpdatedAt: eventBundles?.updatedAt ?? null,
    sourceClassificationUpdatedAt: classification?.updatedAt ?? null,
    promptFingerprint: promptFingerprint(
      settings.taggingPrompt,
      getJob(jobId)?.candidateName ?? "",
      settings.folderSignalPolicy,
    ),
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  };
}

function buildCanceledTaggingState(
  jobId: string,
  documents: StoredDocument[],
  eventBundles: WorkspaceEventBundleState,
  classification: WorkspaceEb1aClassificationState,
  message: string,
) {
  const settings = getRuntimeSettings();
  const fingerprint = getDocumentsFingerprint(documents);

  return {
    version: CRITERIA_TAGGING_VERSION,
    jobId,
    status: "canceled",
    message,
    taggedDocuments: 0,
    failedDocumentIds: [],
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    sourceBundleVersion: eventBundles.version,
    sourceClassificationVersion: classification.version,
    sourceBundleUpdatedAt: eventBundles.updatedAt,
    sourceClassificationUpdatedAt: classification.updatedAt,
    promptFingerprint: promptFingerprint(
      settings.taggingPrompt,
      getJob(jobId)?.candidateName ?? "",
      settings.folderSignalPolicy,
    ),
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  } satisfies WorkspaceCriteriaTaggingState;
}

function isTaggingStateCurrent(
  state: WorkspaceCriteriaTaggingState,
  documents: StoredDocument[],
  eventBundles: WorkspaceEventBundleState,
  classification: WorkspaceEb1aClassificationState,
  nextPromptFingerprint: string,
) {
  const fingerprint = getDocumentsFingerprint(documents);

  return (
    state.version === CRITERIA_TAGGING_VERSION &&
    state.sourceDocumentCount === fingerprint.sourceDocumentCount &&
    state.sourceLatestDocumentUpdateAt === fingerprint.sourceLatestDocumentUpdateAt &&
    state.sourceBundleVersion === eventBundles.version &&
    state.sourceClassificationVersion === classification.version &&
    state.sourceBundleUpdatedAt === eventBundles.updatedAt &&
    state.sourceClassificationUpdatedAt === classification.updatedAt &&
    state.promptFingerprint === nextPromptFingerprint
  );
}

async function runWorkspaceCriteriaTaggingJob(
  jobId: string,
  candidateName: string,
  eventBundles: WorkspaceEventBundleState,
  classification: WorkspaceEb1aClassificationState,
  documents: StoredDocument[],
) {
  const settings = getRuntimeSettings();
  const nextPromptFingerprint = promptFingerprint(
    settings.taggingPrompt,
    candidateName,
    settings.folderSignalPolicy,
  );
  const reviewableDocuments = documents.filter(
    (document) => document.processingStatus === "completed" && document.summary,
  );
  const bundleLookup = new Map<string, WorkspaceEventBundleState["bundles"][number]>();

  eventBundles.bundles.forEach((bundle) => {
    bundle.evidenceDocumentIds.forEach((documentId) => {
      bundleLookup.set(documentId, bundle);
    });
  });

  const decisionLookup = new Map(
    classification.decisions.map((decision) => [decision.bundleId, decision]),
  );

  saveWorkspaceCriteriaTaggingState(jobId, {
    version: CRITERIA_TAGGING_VERSION,
    jobId,
    status: "processing",
    message: "AI is tagging evidence files with criteria hints and keep/archive review states.",
    taggedDocuments: 0,
    failedDocumentIds: [],
    sourceDocumentCount: reviewableDocuments.length,
    sourceLatestDocumentUpdateAt:
      reviewableDocuments
        .map((document) => document.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ?? null,
    sourceBundleVersion: eventBundles.version,
    sourceClassificationVersion: classification.version,
    sourceBundleUpdatedAt: eventBundles.updatedAt,
    sourceClassificationUpdatedAt: classification.updatedAt,
    promptFingerprint: nextPromptFingerprint,
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  });

  try {
    if (isJobCancellationRequested(jobId)) {
      saveWorkspaceCriteriaTaggingState(
        jobId,
        buildCanceledTaggingState(
          jobId,
          documents,
          eventBundles,
          classification,
          "Evidence tagging was canceled before it started.",
        ),
      );
      clearJobCancellationRequest(jobId);
      return;
    }

    let completedCount = 0;
    let totalCostUsd = 0;
    const failedDocumentIds: string[] = [];
    let canceledDuringTagging = false;

    await runWithConcurrency(reviewableDocuments, CRITERIA_TAGGING_CONCURRENCY, async (document) => {
      if (canceledDuringTagging || isJobCancellationRequested(jobId)) {
        canceledDuringTagging = true;
        return;
      }

      const bundle = bundleLookup.get(document.id);
      const decision = bundle ? decisionLookup.get(bundle.id) : null;
      const bundleContext = bundle
        ? [
            bundle.name,
            bundle.eventType,
            bundle.shortSummary,
            bundle.detailedSummary,
            buildFolderContextText(
              document.relativePath,
              document.folderLabel,
            ),
          ]
            .filter(Boolean)
            .join(" ")
        : "No event bundle context is available for this document.";
      const classificationContext = decision
        ? `${decision.bucketName}. ${decision.rationale}`
        : "No completed bundle classification is available for this document.";

      try {
        const result = await tagDocumentCriteria({
          document,
          bundleContext,
          classificationContext,
        });
        totalCostUsd += result.usage.totalCostUsd ?? 0;
        completedCount += 1;
        const nextCriteriaTags = buildSuggestedTags(document, result.criteriaTags);

        await setDocumentPayload(document.id, {
          criteriaTags: nextCriteriaTags,
          disposition: "untouched",
          reviewStatus: "pending",
          reviewStatusSource: "ai",
          reviewStatusReason: result.reviewStatusReason,
        });
      } catch {
        failedDocumentIds.push(document.id);
        await setDocumentPayload(document.id, {
          criteriaTags: [],
          disposition: "untouched",
          reviewStatus: "pending",
          reviewStatusSource: "ai",
          reviewStatusReason: "Criteria tagging could not be completed automatically for this file.",
        });
      }

      if (isJobCancellationRequested(jobId)) {
        canceledDuringTagging = true;
      }

      saveWorkspaceCriteriaTaggingState(jobId, {
        version: CRITERIA_TAGGING_VERSION,
        jobId,
        status: "processing",
        message: `Tagged ${completedCount} of ${reviewableDocuments.length} completed evidence file(s).`,
        taggedDocuments: completedCount,
        failedDocumentIds,
        sourceDocumentCount: reviewableDocuments.length,
        sourceLatestDocumentUpdateAt:
          reviewableDocuments
            .map((entry) => entry.updatedAt)
            .sort((left, right) => right.localeCompare(left))[0] ?? null,
        sourceBundleVersion: eventBundles.version,
        sourceClassificationVersion: classification.version,
        sourceBundleUpdatedAt: eventBundles.updatedAt,
        sourceClassificationUpdatedAt: classification.updatedAt,
        promptFingerprint: nextPromptFingerprint,
        totalCostUsd: roundUsd(totalCostUsd),
        updatedAt: new Date().toISOString(),
        error: null,
      });
    });

    if (canceledDuringTagging || isJobCancellationRequested(jobId)) {
      saveWorkspaceCriteriaTaggingState(
        jobId,
        buildCanceledTaggingState(
          jobId,
          documents,
          eventBundles,
          classification,
          "Evidence tagging was canceled during the AI tagging pass.",
        ),
      );
      clearJobCancellationRequest(jobId);
      return;
    }

    saveWorkspaceCriteriaTaggingState(jobId, {
      version: CRITERIA_TAGGING_VERSION,
      jobId,
      status: "completed",
      message:
        failedDocumentIds.length > 0
          ? `Tagged ${completedCount} file(s) with ${failedDocumentIds.length} needing manual follow-up.`
          : `Tagged ${completedCount} completed evidence file(s) for review.`,
      taggedDocuments: completedCount,
      failedDocumentIds,
      sourceDocumentCount: reviewableDocuments.length,
      sourceLatestDocumentUpdateAt:
        reviewableDocuments
          .map((entry) => entry.updatedAt)
          .sort((left, right) => right.localeCompare(left))[0] ?? null,
      sourceBundleVersion: eventBundles.version,
      sourceClassificationVersion: classification.version,
      sourceBundleUpdatedAt: eventBundles.updatedAt,
      sourceClassificationUpdatedAt: classification.updatedAt,
      promptFingerprint: nextPromptFingerprint,
      totalCostUsd: roundUsd(totalCostUsd),
      updatedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    saveWorkspaceCriteriaTaggingState(jobId, {
      version: CRITERIA_TAGGING_VERSION,
      jobId,
      status: "failed",
      message: "Evidence tagging could not be completed for this workspace.",
      taggedDocuments: 0,
      failedDocumentIds: [],
      sourceDocumentCount: reviewableDocuments.length,
      sourceLatestDocumentUpdateAt:
        reviewableDocuments
          .map((entry) => entry.updatedAt)
          .sort((left, right) => right.localeCompare(left))[0] ?? null,
      sourceBundleVersion: eventBundles.version,
      sourceClassificationVersion: classification.version,
      sourceBundleUpdatedAt: eventBundles.updatedAt,
      sourceClassificationUpdatedAt: classification.updatedAt,
      promptFingerprint: nextPromptFingerprint,
      totalCostUsd: 0,
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown tagging error.",
    });
  } finally {
    activeTaggingJobs.delete(jobId);
  }
}

export function startWorkspaceCriteriaTaggingJob(
  jobId: string,
  candidateName: string,
  eventBundles: WorkspaceEventBundleState,
  classification: WorkspaceEb1aClassificationState,
  documents: StoredDocument[],
) {
  if (activeTaggingJobs.has(jobId)) {
    return;
  }

  if (getJob(jobId)?.status === "canceled" || isJobCancellationRequested(jobId)) {
    saveWorkspaceCriteriaTaggingState(
      jobId,
      buildCanceledTaggingState(
        jobId,
        documents,
        eventBundles,
        classification,
        "Evidence tagging was canceled before it started.",
      ),
    );
    clearJobCancellationRequest(jobId);
    return;
  }

  activeTaggingJobs.add(jobId);
  const settings = getRuntimeSettings();
  const reviewableDocuments = documents.filter(
    (document) => document.processingStatus === "completed" && document.summary,
  );

  saveWorkspaceCriteriaTaggingState(jobId, {
    version: CRITERIA_TAGGING_VERSION,
    jobId,
    status: "queued",
    message: "Evidence tagging is queued for this workspace.",
    taggedDocuments: 0,
    failedDocumentIds: [],
    sourceDocumentCount: reviewableDocuments.length,
    sourceLatestDocumentUpdateAt:
      reviewableDocuments
        .map((document) => document.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ?? null,
    sourceBundleVersion: eventBundles.version,
    sourceClassificationVersion: classification.version,
    sourceBundleUpdatedAt: eventBundles.updatedAt,
    sourceClassificationUpdatedAt: classification.updatedAt,
    promptFingerprint: promptFingerprint(
      settings.taggingPrompt,
      candidateName,
      settings.folderSignalPolicy,
    ),
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  });

  setTimeout(() => {
    void runWorkspaceCriteriaTaggingJob(
      jobId,
      candidateName,
      eventBundles,
      classification,
      documents,
    );
  }, 0);
}

export function ensureWorkspaceCriteriaTagging(
  jobId: string,
  candidateName: string,
  eventBundles: WorkspaceEventBundleState | null,
  classification: WorkspaceEb1aClassificationState | null,
  documents: StoredDocument[],
) {
  const settings = getRuntimeSettings();
  const nextPromptFingerprint = promptFingerprint(
    settings.taggingPrompt,
    candidateName,
    settings.folderSignalPolicy,
  );
  const storedState = getStoredCriteriaTaggingState(jobId);
  const job = getJob(jobId);

  if (job?.status === "canceled") {
    return eventBundles && classification
      ? storedState ??
          buildCanceledTaggingState(
            jobId,
            documents,
            eventBundles,
            classification,
            "Evidence tagging was canceled for this workspace.",
          )
      : storedState;
  }

  if (!eventBundles || eventBundles.status !== "completed") {
    return (
      storedState ??
      buildSyntheticTaggingState(
        jobId,
        documents,
        eventBundles,
        classification,
        "Evidence tagging will start after event bundling completes.",
      )
    );
  }

  if (!classification || classification.status !== "completed") {
    return (
      storedState ??
      buildSyntheticTaggingState(
        jobId,
        documents,
        eventBundles,
        classification,
        "Evidence tagging will start after EB1A classification completes.",
      )
    );
  }

  if (
    storedState?.status === "failed" ||
    (!storedState ||
      (storedState.status !== "canceled" &&
        !isTaggingStateCurrent(
          storedState,
          documents,
          eventBundles,
          classification,
          nextPromptFingerprint,
        )))
  ) {
    startWorkspaceCriteriaTaggingJob(jobId, candidateName, eventBundles, classification, documents);

    return (
      getStoredCriteriaTaggingState(jobId) ??
      buildSyntheticTaggingState(
        jobId,
        documents,
        eventBundles,
        classification,
        "Evidence tagging has been queued for this workspace.",
      )
    );
  }

  return storedState;
}
