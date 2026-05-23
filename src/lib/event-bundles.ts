import crypto from "node:crypto";
import { eventBundleCandidateJsonSchema, eventBundleCandidateSchema } from "@/lib/event-bundle-schema";
import { normalizePrimaryDate } from "@/lib/date";
import { isReviewableEvidenceFile } from "@/lib/evidence-filters";
import {
  buildFolderContext,
  getFolderSignalPolicyInstruction,
} from "@/lib/folder-context";
import { clearJobCancellationRequest, getJob, isJobCancellationRequested } from "@/lib/jobs";
import { getOpenAiContext } from "@/lib/openai";
import { calculateTextModelCost } from "@/lib/openai-pricing";
import { fillPromptTemplate } from "@/lib/prompt-library";
import {
  formatBundleDisplayName,
  formatSpecialBundleName,
  getFilenameReviewDisposition,
} from "@/lib/review-routing";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type { EventBundle, StoredDocument, TextModelUsage, WorkspaceEventBundleState } from "@/lib/types";

interface EventBundleStateFile {
  workspaces: Record<string, WorkspaceEventBundleState>;
}

const EVENT_BUNDLES_FILE = "event-bundles.json";
const EVENT_BUNDLE_VERSION = 15;
const AUXILIARY_BUNDLE_MERGE_THRESHOLD = 5;

declare global {
  var __eb1aActiveEventBundleJobs: Set<string> | undefined;
}

const activeBundleJobs = globalThis.__eb1aActiveEventBundleJobs ?? new Set<string>();
globalThis.__eb1aActiveEventBundleJobs = activeBundleJobs;

function readEventBundleStateFile() {
  return readStateFile<EventBundleStateFile>(EVENT_BUNDLES_FILE, {
    workspaces: {},
  });
}

function writeEventBundleStateFile(state: EventBundleStateFile) {
  writeStateFile(EVENT_BUNDLES_FILE, state);
}

function getDocumentsFingerprint(documents: StoredDocument[]) {
  const completedDocuments = documents.filter(
    (document) =>
      document.processingStatus === "completed" && isReviewableEvidenceFile(document),
  );

  return {
    sourceDocumentCount: completedDocuments.length,
    sourceLatestDocumentUpdateAt:
      completedDocuments
        .map((document) => document.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ?? null,
  };
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function buildTextUsage(
  model: string,
  usage:
    | {
        input_tokens?: number | null;
        output_tokens?: number | null;
        total_tokens?: number | null;
        input_tokens_details?: {
          cached_tokens?: number | null;
        } | null;
      }
    | null
    | undefined,
): TextModelUsage | null {
  if (!usage) {
    return null;
  }

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cachedInputTokens = usage.input_tokens_details?.cached_tokens ?? 0;

  return {
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
    costUsd: calculateTextModelCost({
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
    }),
  };
}

function getStoredWorkspaceEventBundleState(jobId: string) {
  return readEventBundleStateFile().workspaces[jobId] ?? null;
}

function saveWorkspaceEventBundleState(
  jobId: string,
  nextState: WorkspaceEventBundleState,
) {
  const state = readEventBundleStateFile();
  state.workspaces[jobId] = nextState;
  writeEventBundleStateFile(state);
}

function buildSyntheticBundleState(
  jobId: string,
  documents: StoredDocument[],
  message: string,
): WorkspaceEventBundleState {
  const fingerprint = getDocumentsFingerprint(documents);
  const { folderSignalPolicy } = getOpenAiContext().settings;

  return {
    version: EVENT_BUNDLE_VERSION,
    jobId,
    status: "idle",
    message,
    bundles: [],
    folderSignalPolicy,
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    totalCostUsd: 0,
    updatedAt: new Date(0).toISOString(),
    error: null,
  };
}

function buildCanceledBundleState(
  jobId: string,
  documents: StoredDocument[],
  message: string,
): WorkspaceEventBundleState {
  const fingerprint = getDocumentsFingerprint(documents);
  const { folderSignalPolicy } = getOpenAiContext().settings;

  return {
    version: EVENT_BUNDLE_VERSION,
    jobId,
    status: "canceled",
    message,
    bundles: [],
    folderSignalPolicy,
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  };
}

function isBundleStateCurrent(
  state: WorkspaceEventBundleState | null,
  documents: StoredDocument[],
) {
  if (!state) {
    return false;
  }

  const fingerprint = getDocumentsFingerprint(documents);

  return (
    state.version === EVENT_BUNDLE_VERSION &&
    state.folderSignalPolicy === getOpenAiContext().settings.folderSignalPolicy &&
    state.sourceDocumentCount === fingerprint.sourceDocumentCount &&
    state.sourceLatestDocumentUpdateAt === fingerprint.sourceLatestDocumentUpdateAt
  );
}

function buildWorkspaceDocumentDigest(documents: StoredDocument[]) {
  return documents
    .filter(
      (document) =>
        document.processingStatus === "completed" &&
        isReviewableEvidenceFile(document) &&
        !getFilenameReviewDisposition(document.fileName),
    )
    .map((document) => {
      const folderContext = buildFolderContext(document.relativePath, document.folderLabel);

      return {
        id: document.id,
        fileName: document.fileName,
        relativePath: document.relativePath,
        rootFolder: folderContext.rootFolder,
        folderPath: folderContext.folderPath,
        folderSegments: folderContext.folderSegments,
        folderHints: folderContext.folderHints,
        leafFolder: folderContext.leafFolder,
        folderEvidenceStrength: folderContext.folderEvidenceStrength,
        documentType: document.summary?.documentType || document.extension || "File",
        title: document.summary?.title || document.fileName,
        shortSummary: document.summary?.shortSummary || "Summary unavailable.",
        detailedSummary:
          document.summary?.detailedSummary || "Detailed summary unavailable.",
        latestRelevantDate: document.summary?.primaryDate || null,
        notableFacts: document.summary?.notableFacts ?? [],
        organizations: document.summary?.organizations ?? [],
        people: document.summary?.people ?? [],
        locations: document.summary?.locations ?? [],
        tags: document.summary?.tags ?? [],
        candidateName: document.candidateName,
      };
    });
}

function clampString(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength).trim();
}

function clampStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => clampString(entry, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeEventBundleCandidate(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    bundles: Array.isArray(value.bundles)
      ? value.bundles
          .filter((bundle): bundle is Record<string, unknown> => Boolean(bundle) && typeof bundle === "object")
          .map((bundle) => ({
            name: clampString(bundle.name, 160, "Untitled event"),
            shortSummary: clampString(bundle.shortSummary, 240, "Summary unavailable."),
            detailedSummary: clampString(
              bundle.detailedSummary,
              1400,
              "Detailed summary unavailable.",
            ),
            eventType: clampString(bundle.eventType, 80, "Evidence event"),
            latestRelevantDate:
              bundle.latestRelevantDate === null
                ? null
                : clampString(bundle.latestRelevantDate, 32) || null,
            timeframeLabel: clampString(bundle.timeframeLabel, 120, "Date not specified"),
            location: clampString(bundle.location, 120, "Location not specified"),
            organizations: clampStringArray(bundle.organizations, 12, 120),
            people: clampStringArray(bundle.people, 12, 120),
            keywords: clampStringArray(bundle.keywords, 12, 48),
            confidence: Math.min(
              100,
              Math.max(
                0,
                Math.round(typeof bundle.confidence === "number" ? bundle.confidence : 0),
              ),
            ),
            leadDocumentId:
              bundle.leadDocumentId === null
                ? null
                : clampString(bundle.leadDocumentId, 80) || null,
            evidenceDocumentIds: clampStringArray(bundle.evidenceDocumentIds, 48, 80),
          }))
      : [],
  };
}

function buildFallbackBundle(document: StoredDocument): EventBundle {
  const latestRelevantDate = normalizePrimaryDate(document.summary?.primaryDate ?? null);

  return {
    id: crypto.randomUUID(),
    jobId: document.jobId,
    bundleKind: "standard",
    name: formatBundleDisplayName(
      document.summary?.title || document.fileName,
      latestRelevantDate,
    ),
    shortSummary: document.summary?.shortSummary || "Summary unavailable.",
    detailedSummary:
      document.summary?.detailedSummary || "Detailed summary unavailable for this evidence.",
    eventType: document.summary?.documentType || "Evidence item",
    latestRelevantDate,
    timeframeLabel: document.summary?.primaryDateReason || "Single supporting evidence item.",
    location: document.summary?.locations?.[0] || "Location not specified",
    organizations: document.summary?.organizations ?? [],
    people: document.summary?.people ?? [],
    keywords: document.summary?.tags ?? [],
    confidence: Math.min(document.summary?.confidence ?? 0, 72),
    leadDocumentId: document.id,
    evidenceDocumentIds: [document.id],
  };
}

function buildSpecialReviewBundle(
  document: StoredDocument,
  disposition: "archive" | "unwanted",
): EventBundle {
  const latestRelevantDate = normalizePrimaryDate(document.summary?.primaryDate ?? null);
  const label = disposition === "archive" ? "Archive Category" : "Unwanted";
  const summaryTail =
    disposition === "archive"
      ? "The filename contains the word archive, so this file was routed into the Archive Category for later reference instead of normal event grouping."
      : "The filename contains delete or remove, so this file was routed into the Unwanted queue for human review instead of normal event grouping.";

  return {
    id: crypto.randomUUID(),
    jobId: document.jobId,
    bundleKind: disposition,
    name: formatSpecialBundleName(document, disposition),
    shortSummary:
      disposition === "archive"
        ? "Filename rule routed this file to Archive Category."
        : "Filename rule routed this file to Unwanted review.",
    detailedSummary: [document.summary?.detailedSummary, summaryTail]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1400),
    eventType: label,
    latestRelevantDate,
    timeframeLabel:
      document.summary?.primaryDateReason || "Filename rule preserved this file outside normal event bundling.",
    location: document.summary?.locations?.[0] || "Location not specified",
    organizations: document.summary?.organizations ?? [],
    people: document.summary?.people ?? [],
    keywords: Array.from(new Set([...(document.summary?.tags ?? []), label])),
    confidence: 100,
    leadDocumentId: document.id,
    evidenceDocumentIds: [document.id],
  };
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function uniqueMergedValues(...valueGroups: string[][]) {
  const seen = new Set<string>();
  const merged: string[] = [];

  valueGroups.flat().forEach((value) => {
    const normalized = normalizeToken(value);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    merged.push(value);
  });

  return merged;
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right.map(normalizeToken));

  return left.reduce((count, value) => {
    return rightSet.has(normalizeToken(value)) ? count + 1 : count;
  }, 0);
}

function isDateClose(left: string | null, right: string | null, maxDays = 120) {
  if (!left || !right) {
    return true;
  }

  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return true;
  }

  return Math.abs(leftTime - rightTime) <= maxDays * 24 * 60 * 60 * 1000;
}

function isAuxiliaryEventType(value: string) {
  const normalized = normalizeToken(value);
  const auxiliaryTokens = [
    "photograph",
    "photo",
    "image",
    "badge",
    "name badge",
    "screenshot",
    "slide",
    "speaker slide",
    "presentation slide",
    "supporting visual",
  ];

  return auxiliaryTokens.some((token) => normalized.includes(token));
}

function scoreBundleMerge(source: EventBundle, target: EventBundle) {
  const organizationOverlap = countOverlap(source.organizations, target.organizations);
  const peopleOverlap = countOverlap(source.people, target.people);
  const keywordOverlap = countOverlap(source.keywords, target.keywords);

  let score = organizationOverlap * 4 + peopleOverlap * 2 + keywordOverlap;

  if (isDateClose(source.latestRelevantDate, target.latestRelevantDate)) {
    score += 2;
  }

  if (
    normalizeToken(source.location) !== "location not specified" &&
    normalizeToken(source.location) === normalizeToken(target.location)
  ) {
    score += 2;
  }

  return score;
}

function mergeAuxiliaryBundles(bundles: EventBundle[]) {
  const sortedBundles = [...bundles].sort(
    (left, right) => right.evidenceDocumentIds.length - left.evidenceDocumentIds.length,
  );
  const consumedSourceIds = new Set<string>();

  for (const sourceBundle of sortedBundles) {
    if (
      consumedSourceIds.has(sourceBundle.id) ||
      sourceBundle.evidenceDocumentIds.length > 2 ||
      !isAuxiliaryEventType(sourceBundle.eventType)
    ) {
      continue;
    }

    let bestTarget: EventBundle | null = null;
    let bestScore = 0;

    for (const targetBundle of sortedBundles) {
      if (
        targetBundle.id === sourceBundle.id ||
        consumedSourceIds.has(targetBundle.id) ||
        targetBundle.evidenceDocumentIds.length < sourceBundle.evidenceDocumentIds.length
      ) {
        continue;
      }

      const score = scoreBundleMerge(sourceBundle, targetBundle);

      if (score > bestScore) {
        bestScore = score;
        bestTarget = targetBundle;
      }
    }

    if (!bestTarget || bestScore < AUXILIARY_BUNDLE_MERGE_THRESHOLD) {
      continue;
    }

    bestTarget.evidenceDocumentIds = uniqueMergedValues(
      bestTarget.evidenceDocumentIds,
      sourceBundle.evidenceDocumentIds,
    );
    bestTarget.organizations = uniqueMergedValues(
      bestTarget.organizations,
      sourceBundle.organizations,
    );
    bestTarget.people = uniqueMergedValues(bestTarget.people, sourceBundle.people);
    bestTarget.keywords = uniqueMergedValues(bestTarget.keywords, sourceBundle.keywords);

    if (
      bestTarget.location === "Location not specified" &&
      sourceBundle.location !== "Location not specified"
    ) {
      bestTarget.location = sourceBundle.location;
    }

    if (
      sourceBundle.latestRelevantDate &&
      (!bestTarget.latestRelevantDate ||
        sourceBundle.latestRelevantDate > bestTarget.latestRelevantDate)
    ) {
      bestTarget.latestRelevantDate = sourceBundle.latestRelevantDate;
    }

    if (!bestTarget.detailedSummary.includes("supporting visual evidence")) {
      bestTarget.detailedSummary = clampString(
        `${bestTarget.detailedSummary} This bundle also includes supporting visual evidence tied to the same event.`,
        1400,
        bestTarget.detailedSummary,
      );
    }

    consumedSourceIds.add(sourceBundle.id);
  }

  return sortedBundles.filter((bundle) => !consumedSourceIds.has(bundle.id));
}

function postProcessBundles(
  jobId: string,
  documents: StoredDocument[],
  rawBundles: Array<{
    name: string;
    shortSummary: string;
    detailedSummary: string;
    eventType: string;
    latestRelevantDate: string | null;
    timeframeLabel: string;
    location: string;
    organizations: string[];
    people: string[];
    keywords: string[];
    confidence: number;
    leadDocumentId: string | null;
    evidenceDocumentIds: string[];
  }>,
) {
  const completedDocuments = documents.filter(
    (document) =>
      document.processingStatus === "completed" && isReviewableEvidenceFile(document),
  );
  const specialDocuments = completedDocuments.filter((document) =>
    Boolean(getFilenameReviewDisposition(document.fileName)),
  );
  const specialBundles = specialDocuments.map((document) =>
    buildSpecialReviewBundle(
      document,
      getFilenameReviewDisposition(document.fileName) as "archive" | "unwanted",
    ),
  );
  const groupableDocuments = completedDocuments.filter(
    (document) => !getFilenameReviewDisposition(document.fileName),
  );
  const documentLookup = new Map(groupableDocuments.map((document) => [document.id, document]));
  const assignedDocumentIds = new Set<string>();

  const bundleCandidates = rawBundles
    .map((bundle) => {
      const uniqueDocumentIds = Array.from(
        new Set(bundle.evidenceDocumentIds.filter((documentId) => documentLookup.has(documentId))),
      ).filter((documentId) => !assignedDocumentIds.has(documentId));

      if (!uniqueDocumentIds.length) {
        return null;
      }

      uniqueDocumentIds.forEach((documentId) => assignedDocumentIds.add(documentId));

      const eventBundle: EventBundle = {
        id: crypto.randomUUID(),
        jobId,
        bundleKind: "standard",
        name: formatBundleDisplayName(
          bundle.name,
          normalizePrimaryDate(bundle.latestRelevantDate),
        ),
        shortSummary: bundle.shortSummary,
        detailedSummary: bundle.detailedSummary,
        eventType: bundle.eventType,
        latestRelevantDate: normalizePrimaryDate(bundle.latestRelevantDate),
        timeframeLabel: bundle.timeframeLabel,
        location: bundle.location,
        organizations: bundle.organizations,
        people: bundle.people,
        keywords: bundle.keywords,
        confidence: bundle.confidence,
        leadDocumentId:
          bundle.leadDocumentId && uniqueDocumentIds.includes(bundle.leadDocumentId)
            ? bundle.leadDocumentId
            : uniqueDocumentIds[0],
        evidenceDocumentIds: uniqueDocumentIds,
      };

      return eventBundle;
    })
    .filter((bundle): bundle is EventBundle => Boolean(bundle));

  const bundles: EventBundle[] = bundleCandidates;

  const unassignedDocuments = groupableDocuments.filter(
    (document) => !assignedDocumentIds.has(document.id),
  );

  const fallbackBundles = unassignedDocuments.map((document) => buildFallbackBundle(document));

  return [...mergeAuxiliaryBundles([...bundles, ...fallbackBundles]), ...specialBundles].sort((left, right) => {
    if (left.latestRelevantDate && right.latestRelevantDate) {
      return right.latestRelevantDate.localeCompare(left.latestRelevantDate);
    }

    if (left.latestRelevantDate) {
      return -1;
    }

    if (right.latestRelevantDate) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

async function generateEventBundles(
  jobId: string,
  documents: StoredDocument[],
) {
  const completedDocuments = documents.filter(
    (document) =>
      document.processingStatus === "completed" && isReviewableEvidenceFile(document),
  );

  if (!completedDocuments.length) {
    return {
      bundles: [],
      usage: null,
      message: "Event bundling is waiting for completed evidence summaries.",
    };
  }

  const groupableDocuments = completedDocuments.filter(
    (document) => !getFilenameReviewDisposition(document.fileName),
  );

  if (!groupableDocuments.length) {
    const specialBundles = postProcessBundles(jobId, completedDocuments, []);

    return {
      bundles: specialBundles,
      usage: null,
      message: `All ${specialBundles.length} completed file(s) were routed by filename rules into Archive Category or Unwanted review.`,
    };
  }

  const { client, settings } = getOpenAiContext();
  const documentDigest = buildWorkspaceDocumentDigest(completedDocuments);

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: fillPromptTemplate(settings.bundlingPrompt, {
              candidateName: settings.candidateName || "the candidate",
            }),
          },
          {
            type: "input_text",
            text: getFolderSignalPolicyInstruction(settings.folderSignalPolicy),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Workspace job ID: ${jobId}`,
              "Original upload-folder names and nested folder labels are preserved in the document digest below. Each file also includes a folder-evidence strength hint so the model knows when it should trust folder structure first and when it should fall back to document content. Do not copy raw paths as final bundle names.",
              "Completed evidence documents:",
              JSON.stringify(documentDigest, null, 2),
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "event_bundle_map",
        strict: true,
        schema: eventBundleCandidateJsonSchema,
      },
    },
  });

  const parsed = eventBundleCandidateSchema.parse(
    sanitizeEventBundleCandidate(JSON.parse(response.output_text)),
  );

  const bundles = postProcessBundles(jobId, completedDocuments, parsed.bundles);
  const archiveCount = bundles.filter((bundle) => bundle.bundleKind === "archive").length;
  const unwantedCount = bundles.filter((bundle) => bundle.bundleKind === "unwanted").length;
  const standardCount = bundles.length - archiveCount - unwantedCount;

  return {
    bundles,
    usage: buildTextUsage(settings.summaryModel, response.usage),
    message: `Built ${standardCount} event bundle(s) from ${completedDocuments.length} evidence file(s), plus ${archiveCount} archive and ${unwantedCount} unwanted filename-rule bundle(s).`,
  };
}

async function runWorkspaceBundlingJob(
  jobId: string,
  documents: StoredDocument[],
) {
  const fingerprint = getDocumentsFingerprint(documents);

  saveWorkspaceEventBundleState(jobId, {
    version: EVENT_BUNDLE_VERSION,
    jobId,
    status: "processing",
    message: "AI is grouping the workspace evidence into real-world events.",
    bundles: [],
    folderSignalPolicy: getOpenAiContext().settings.folderSignalPolicy,
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  });

  try {
    if (isJobCancellationRequested(jobId)) {
      saveWorkspaceEventBundleState(
        jobId,
        buildCanceledBundleState(
          jobId,
          documents,
          "Event bundling was canceled by the user before it could finish.",
        ),
      );
      clearJobCancellationRequest(jobId);
      return;
    }

    const result = await generateEventBundles(jobId, documents);

    if (isJobCancellationRequested(jobId)) {
      saveWorkspaceEventBundleState(
        jobId,
        buildCanceledBundleState(
          jobId,
          documents,
          "Event bundling was canceled by the user during the AI grouping pass.",
        ),
      );
      clearJobCancellationRequest(jobId);
      return;
    }

    saveWorkspaceEventBundleState(jobId, {
      version: EVENT_BUNDLE_VERSION,
      jobId,
      status: "completed",
      message: result.message,
      bundles: result.bundles,
      folderSignalPolicy: getOpenAiContext().settings.folderSignalPolicy,
      sourceDocumentCount: fingerprint.sourceDocumentCount,
      sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
      totalCostUsd: roundUsd(result.usage?.costUsd ?? 0),
      updatedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    saveWorkspaceEventBundleState(jobId, {
      version: EVENT_BUNDLE_VERSION,
      jobId,
      status: "failed",
      message: "Event bundling could not be completed for this workspace.",
      bundles: [],
      folderSignalPolicy: getOpenAiContext().settings.folderSignalPolicy,
      sourceDocumentCount: fingerprint.sourceDocumentCount,
      sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
      totalCostUsd: 0,
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown event bundling error.",
    });
  } finally {
    activeBundleJobs.delete(jobId);
  }
}

export function startWorkspaceBundlingJob(
  jobId: string,
  documents: StoredDocument[],
) {
  if (activeBundleJobs.has(jobId)) {
    return;
  }

  if (getJob(jobId)?.status === "canceled" || isJobCancellationRequested(jobId)) {
    saveWorkspaceEventBundleState(
      jobId,
      buildCanceledBundleState(
        jobId,
        documents,
        "Event bundling was canceled before it started.",
      ),
    );
    clearJobCancellationRequest(jobId);
    return;
  }

  activeBundleJobs.add(jobId);
  const fingerprint = getDocumentsFingerprint(documents);

  saveWorkspaceEventBundleState(jobId, {
    version: EVENT_BUNDLE_VERSION,
    jobId,
    status: "queued",
    message: "Event bundling is queued for this workspace.",
    bundles: [],
    folderSignalPolicy: getOpenAiContext().settings.folderSignalPolicy,
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  });

  setTimeout(() => {
    void runWorkspaceBundlingJob(jobId, documents);
  }, 0);
}

export function ensureWorkspaceEventBundles(
  jobId: string,
  documents: StoredDocument[],
) {
  const storedState = getStoredWorkspaceEventBundleState(jobId);
  const job = getJob(jobId);

  if (job?.status === "canceled") {
    return (
      storedState ??
      buildCanceledBundleState(
        jobId,
        documents,
        "Event bundling was canceled for this workspace.",
      )
    );
  }

  if (
    job?.status === "queued" ||
    job?.status === "processing" ||
    job?.status === "canceling"
  ) {
    return (
      storedState ??
      buildSyntheticBundleState(
        jobId,
        documents,
        job.status === "canceling"
          ? "Event bundling is waiting for the cancellation request to finish."
          : "Event bundling will start after document indexing completes.",
      )
    );
  }

  if (
    !documents.some(
      (document) =>
        document.processingStatus === "completed" && isReviewableEvidenceFile(document),
    )
  ) {
    return (
      storedState ??
      buildSyntheticBundleState(
        jobId,
        documents,
        "Event bundling will start after at least one document has been summarized.",
      )
    );
  }

  if (
    storedState?.status === "failed" ||
    (!storedState || storedState.status !== "canceled") &&
      !isBundleStateCurrent(storedState, documents)
  ) {
    startWorkspaceBundlingJob(jobId, documents);

    return (
      getStoredWorkspaceEventBundleState(jobId) ??
      buildSyntheticBundleState(
        jobId,
        documents,
        "Event bundling has been queued for this workspace.",
      )
    );
  }

  return storedState;
}
