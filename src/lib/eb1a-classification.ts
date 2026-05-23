import crypto from "node:crypto";
import {
  EB1A_CRITERIA_DEFINITIONS,
  SPECIAL_REVIEW_BUCKET_DEFINITIONS,
} from "@/lib/constants";
import {
  eb1aClassificationCandidateJsonSchema,
  eb1aClassificationCandidateSchema,
} from "@/lib/eb1a-classification-schema";
import { isReviewableEvidenceFile } from "@/lib/evidence-filters";
import {
  buildFolderContext,
  getFolderSignalPolicyInstruction,
  normalizeFolderSegment,
} from "@/lib/folder-context";
import { getOpenAiContext } from "@/lib/openai";
import { calculateTextModelCost } from "@/lib/openai-pricing";
import { createOutputPackage } from "@/lib/output-package";
import { fillPromptTemplate } from "@/lib/prompt-library";
import {
  formatSpecialExhibitTitle,
  getReviewBucketForDisposition,
} from "@/lib/review-routing";
import { clearJobCancellationRequest, getJob, isJobCancellationRequested } from "@/lib/jobs";
import { getRuntimeSettings } from "@/lib/settings";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type {
  Eb1aCriterionBucket,
  Eb1aCriterionDecision,
  EventBundle,
  StoredDocument,
  TextModelUsage,
  WorkspaceEb1aClassificationState,
  WorkspaceEventBundleState,
} from "@/lib/types";

interface Eb1aClassificationStateFile {
  workspaces: Record<string, WorkspaceEb1aClassificationState>;
}

const EB1A_CLASSIFICATION_FILE = "eb1a-classification.json";
const EB1A_CLASSIFICATION_VERSION = 4;

declare global {
  var __eb1aActiveCriterionJobs: Set<string> | undefined;
}

const activeCriterionJobs = globalThis.__eb1aActiveCriterionJobs ?? new Set<string>();
globalThis.__eb1aActiveCriterionJobs = activeCriterionJobs;

const criterionLookup = new Map<string, (typeof EB1A_CRITERIA_DEFINITIONS)[number]>(
  EB1A_CRITERIA_DEFINITIONS.map((criterion) => [criterion.code, criterion]),
);

function readClassificationStateFile() {
  return readStateFile<Eb1aClassificationStateFile>(EB1A_CLASSIFICATION_FILE, {
    workspaces: {},
  });
}

function writeClassificationStateFile(state: Eb1aClassificationStateFile) {
  writeStateFile(EB1A_CLASSIFICATION_FILE, state);
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function promptFingerprint(
  value: string,
  candidateName: string,
  outputRootPath: string,
  folderSignalPolicy: string,
) {
  return crypto
    .createHash("sha256")
    .update(
      [value.trim(), candidateName.trim(), outputRootPath.trim(), folderSignalPolicy.trim()].join(
        "\n",
      ),
    )
    .digest("hex");
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

function sanitizeClassificationCandidate(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    decisions: Array.isArray(value.decisions)
      ? value.decisions
          .filter(
            (decision): decision is Record<string, unknown> =>
              Boolean(decision) && typeof decision === "object",
          )
          .map((decision) => ({
            bundleId: clampString(decision.bundleId, 80),
            primaryCriterionCode:
              decision.primaryCriterionCode === null
                ? null
                : clampString(decision.primaryCriterionCode, 2) || null,
            secondaryCriterionCodes: clampStringArray(
              decision.secondaryCriterionCodes,
              3,
              2,
            ),
            confidence: Math.min(
              100,
              Math.max(
                0,
                Math.round(typeof decision.confidence === "number" ? decision.confidence : 0),
              ),
            ),
            rationale: clampString(
              decision.rationale,
              520,
              "No rationale was returned for this bundle.",
            ),
            unclassifiedReason:
              decision.unclassifiedReason === null
                ? null
                : clampString(decision.unclassifiedReason, 320) || null,
            suggestedExhibitTitle: clampString(
              decision.suggestedExhibitTitle,
              180,
              "Untitled exhibit bundle",
            ),
          }))
      : [],
  };
}

function buildBundleDigest(
  bundles: EventBundle[],
  documents: StoredDocument[],
) {
  const documentLookup = new Map(documents.map((document) => [document.id, document]));

  return bundles.map((bundle) => ({
    ...(() => {
      const evidenceDocuments = bundle.evidenceDocumentIds
        .map((documentId) => documentLookup.get(documentId))
        .filter((document): document is StoredDocument => Boolean(document));
      const folderHints = Array.from(
        new Map(
          evidenceDocuments.flatMap((document) => {
            const context = buildFolderContext(document.relativePath, document.folderLabel);
            return context.folderHints.map((hint) => [normalizeFolderSegment(hint), hint] as const);
          }),
        ).values(),
      ).slice(0, 8);

      return {
        folderHints,
        folderEvidenceStrength:
          folderHints.length > 0 && evidenceDocuments.some((document) => {
            const context = buildFolderContext(document.relativePath, document.folderLabel);
            return context.folderEvidenceStrength === "strong";
          })
            ? "strong"
            : "weak",
        evidenceDocuments: evidenceDocuments.map((document) => {
          const context = buildFolderContext(document.relativePath, document.folderLabel);

          return {
            id: document.id,
            title: document.summary?.title || document.fileName,
            documentType: document.summary?.documentType || document.extension,
            primaryDate: document.summary?.primaryDate ?? null,
            relativePath: document.relativePath,
            rootFolder: context.rootFolder,
            folderPath: context.folderPath,
            folderSegments: context.folderSegments,
            folderHints: context.folderHints,
            folderEvidenceStrength: context.folderEvidenceStrength,
            tags: document.summary?.tags ?? [],
            organizations: document.summary?.organizations ?? [],
          };
        }),
      };
    })(),
    id: bundle.id,
    name: bundle.name,
    shortSummary: bundle.shortSummary,
    detailedSummary: bundle.detailedSummary,
    eventType: bundle.eventType,
    latestRelevantDate: bundle.latestRelevantDate,
    timeframeLabel: bundle.timeframeLabel,
    location: bundle.location,
    organizations: bundle.organizations,
    people: bundle.people,
    keywords: bundle.keywords,
    evidenceCount: bundle.evidenceDocumentIds.length,
  }));
}

function buildBuckets(decisions: Eb1aCriterionDecision[]) {
  const bucketMap = new Map<string, Eb1aCriterionBucket>(
    EB1A_CRITERIA_DEFINITIONS.map((criterion) => [
      criterion.code,
      {
        bucketKind: "criterion",
        criterionCode: criterion.code,
        criterionName: criterion.name,
        folderName: criterion.folderName,
        bundleIds: [],
      },
    ]),
  );

  SPECIAL_REVIEW_BUCKET_DEFINITIONS.forEach((bucket) => {
    bucketMap.set(bucket.code, {
      bucketKind: bucket.bucketKind,
      criterionCode: bucket.code,
      criterionName: bucket.name,
      folderName: bucket.folderName,
      bundleIds: [],
    });
  });

  for (const decision of decisions) {
    const bucket = bucketMap.get(decision.bucketCode);

    if (!bucket) {
      continue;
    }

    bucket.bundleIds.push(decision.bundleId);
  }

  return Array.from(bucketMap.values());
}

function postProcessDecisions(
  bundles: EventBundle[],
  parsed: Array<{
    bundleId: string;
    primaryCriterionCode: string | null;
    secondaryCriterionCodes: string[];
    confidence: number;
    rationale: string;
    unclassifiedReason: string | null;
    suggestedExhibitTitle: string;
  }>,
) {
  const parsedLookup = new Map(parsed.map((decision) => [decision.bundleId, decision]));

  return bundles.map((bundle) => {
    const candidate = parsedLookup.get(bundle.id);
    const primaryCriterion = candidate?.primaryCriterionCode
      ? criterionLookup.get(candidate.primaryCriterionCode)
      : null;
    const secondaryCriteria = (candidate?.secondaryCriterionCodes ?? [])
      .map((code) => criterionLookup.get(code))
      .filter((criterion): criterion is NonNullable<typeof criterion> => Boolean(criterion))
      .filter((criterion) => criterion.code !== primaryCriterion?.code);

    const reviewDisposition =
      primaryCriterion && (candidate?.confidence ?? 0) >= 35 ? "classified" : "unclassified";
    const suggestedExhibitTitle = clampString(
      candidate?.suggestedExhibitTitle,
      180,
      bundle.name,
    );
    const reviewBucket = getReviewBucketForDisposition(
      reviewDisposition,
      primaryCriterion?.code ?? null,
    );

    return {
      bundleId: bundle.id,
      bucketCode: reviewBucket.bucketCode,
      bucketName: reviewBucket.bucketName,
      bucketKind: reviewBucket.bucketKind,
      primaryCriterionCode: reviewDisposition === "classified" ? primaryCriterion?.code ?? null : null,
      primaryCriterionName: reviewDisposition === "classified" ? primaryCriterion?.name ?? null : null,
      secondaryCriterionCodes:
        reviewDisposition === "classified"
          ? secondaryCriteria.map((criterion) => criterion.code)
          : [],
      secondaryCriterionNames:
        reviewDisposition === "classified"
          ? secondaryCriteria.map((criterion) => criterion.name)
          : [],
      confidence: candidate?.confidence ?? Math.min(bundle.confidence, 40),
      rationale:
        candidate?.rationale ||
        "This bundle needs human review before a confident EB1A category assignment can be made.",
      reviewDisposition,
      unclassifiedReason:
        reviewDisposition === "unclassified"
          ? candidate?.unclassifiedReason ||
            "The available bundle evidence is not strong or specific enough for confident automatic classification."
          : null,
      suggestedExhibitTitle,
    } satisfies Eb1aCriterionDecision;
  });
}

function buildRuleDrivenDecisions(
  bundles: EventBundle[],
  documents: StoredDocument[],
) {
  const documentLookup = new Map(documents.map((document) => [document.id, document]));

  return bundles.map((bundle) => {
    const leadDocument =
      (bundle.leadDocumentId ? documentLookup.get(bundle.leadDocumentId) : null) ??
      bundle.evidenceDocumentIds
        .map((documentId) => documentLookup.get(documentId))
        .find((document): document is StoredDocument => Boolean(document)) ??
      null;
    const reviewDisposition = bundle.bundleKind as "archive" | "unwanted";
    const reviewBucket = getReviewBucketForDisposition(reviewDisposition);
    const rationale =
      reviewDisposition === "archive"
        ? "This bundle was routed into Archive Category because at least one source filename contains the word archive."
        : "This bundle was routed into Unwanted because at least one source filename contains delete or remove.";

    return {
      bundleId: bundle.id,
      bucketCode: reviewBucket.bucketCode,
      bucketName: reviewBucket.bucketName,
      bucketKind: reviewBucket.bucketKind,
      primaryCriterionCode: null,
      primaryCriterionName: null,
      secondaryCriterionCodes: [],
      secondaryCriterionNames: [],
      confidence: 100,
      rationale,
      reviewDisposition,
      unclassifiedReason:
        reviewDisposition === "unwanted"
          ? "This bundle was intentionally held for human review because its filename suggests the file may be removed."
          : null,
      suggestedExhibitTitle: leadDocument
        ? formatSpecialExhibitTitle(leadDocument, reviewDisposition)
        : bundle.name,
    } satisfies Eb1aCriterionDecision;
  });
}

function buildSyntheticClassificationState(
  jobId: string,
  eventBundles: WorkspaceEventBundleState | null,
  nextPromptFingerprint: string,
  outputRootPath: string,
  message: string,
): WorkspaceEb1aClassificationState {
  return {
    version: EB1A_CLASSIFICATION_VERSION,
    jobId,
    status: "idle",
    message,
    decisions: [],
    buckets: buildBuckets([]),
    unclassifiedBundleIds: [],
    sourceBundleCount: eventBundles?.bundles.length ?? 0,
    sourceBundleUpdatedAt: eventBundles?.updatedAt ?? null,
    sourceBundleVersion: eventBundles?.version ?? 0,
    promptFingerprint: nextPromptFingerprint,
    outputRootPath,
    outputFolderPath: null,
    outputArtifacts: [],
    totalCostUsd: 0,
    updatedAt: new Date(0).toISOString(),
    error: null,
  };
}

function buildCanceledClassificationState(
  jobId: string,
  eventBundles: WorkspaceEventBundleState | null,
  nextPromptFingerprint: string,
  outputRootPath: string,
  message: string,
): WorkspaceEb1aClassificationState {
  return {
    version: EB1A_CLASSIFICATION_VERSION,
    jobId,
    status: "canceled",
    message,
    decisions: [],
    buckets: buildBuckets([]),
    unclassifiedBundleIds: [],
    sourceBundleCount: eventBundles?.bundles.length ?? 0,
    sourceBundleUpdatedAt: eventBundles?.updatedAt ?? null,
    sourceBundleVersion: eventBundles?.version ?? 0,
    promptFingerprint: nextPromptFingerprint,
    outputRootPath,
    outputFolderPath: null,
    outputArtifacts: [],
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  };
}

function getStoredClassificationState(jobId: string) {
  return readClassificationStateFile().workspaces[jobId] ?? null;
}

function saveWorkspaceClassificationState(
  jobId: string,
  nextState: WorkspaceEb1aClassificationState,
) {
  const state = readClassificationStateFile();
  state.workspaces[jobId] = nextState;
  writeClassificationStateFile(state);
}

function isClassificationStateCurrent(
  state: WorkspaceEb1aClassificationState | null,
  eventBundles: WorkspaceEventBundleState,
  nextPromptFingerprint: string,
  outputRootPath: string,
) {
  if (!state) {
    return false;
  }

  return (
    state.version === EB1A_CLASSIFICATION_VERSION &&
    state.sourceBundleCount === eventBundles.bundles.length &&
    state.sourceBundleUpdatedAt === eventBundles.updatedAt &&
    state.sourceBundleVersion === eventBundles.version &&
    state.promptFingerprint === nextPromptFingerprint &&
    state.outputRootPath === outputRootPath
  );
}

async function generateEb1aClassification(
  jobId: string,
  candidateName: string,
  bundles: EventBundle[],
  documents: StoredDocument[],
) {
  const aiBundles = bundles.filter((bundle) => bundle.bundleKind === "standard");
  const routedBundles = bundles.filter((bundle) => bundle.bundleKind !== "standard");
  const routedDecisions = buildRuleDrivenDecisions(routedBundles, documents);

  if (!aiBundles.length) {
    return {
      decisions: routedDecisions,
      usage: null,
    };
  }

  const { client, settings } = getOpenAiContext();
  const candidateLabel = candidateName.trim() || "the candidate";
  const criteriaCatalog = EB1A_CRITERIA_DEFINITIONS.map(
    (criterion) => `${criterion.code}: ${criterion.name}`,
  ).join("; ");

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              fillPromptTemplate(settings.classificationPrompt, {
                candidateName: candidateLabel,
                criteriaCatalog,
              }),
              getFolderSignalPolicyInstruction(settings.folderSignalPolicy),
              `Candidate context: ${candidateLabel}.`,
              "Original upload-folder names and dossier folder labels are preserved in the bundle metadata, along with a strong-or-weak folder evidence hint. Use that signal to decide whether to trust folder structure first or fall back to the bundle evidence.",
              "Ignore any filename-routing concepts such as archive or delete because those bundles are already handled before this AI pass.",
              "Return strict JSON only.",
              "Each bundle must appear at most once in the output decisions array.",
              "If you are not confident, leave primaryCriterionCode null and use unclassifiedReason.",
              "Do not invent facts beyond the supplied event bundle summaries and evidence metadata.",
            ].join(" "),
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
              "Event bundles to classify:",
              JSON.stringify(buildBundleDigest(aiBundles, documents), null, 2),
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "eb1a_event_classification",
        strict: true,
        schema: eb1aClassificationCandidateJsonSchema,
      },
    },
  });

  const parsed = eb1aClassificationCandidateSchema.parse(
    sanitizeClassificationCandidate(JSON.parse(response.output_text)),
  );

  return {
    decisions: [...postProcessDecisions(aiBundles, parsed.decisions), ...routedDecisions],
    usage: buildTextUsage(settings.summaryModel, response.usage),
  };
}

async function runWorkspaceClassificationJob(
  jobId: string,
  candidateName: string,
  eventBundles: WorkspaceEventBundleState,
  documents: StoredDocument[],
) {
  const { classificationPrompt, outputRootPath } = getRuntimeSettings();
  const nextPromptFingerprint = promptFingerprint(
    classificationPrompt,
    candidateName,
    outputRootPath,
    getRuntimeSettings().folderSignalPolicy,
  );

  saveWorkspaceClassificationState(jobId, {
    version: EB1A_CLASSIFICATION_VERSION,
    jobId,
    status: "processing",
    message: "AI is mapping event bundles to EB1A criteria and preparing the output package.",
    decisions: [],
    buckets: buildBuckets([]),
    unclassifiedBundleIds: [],
    sourceBundleCount: eventBundles.bundles.length,
    sourceBundleUpdatedAt: eventBundles.updatedAt,
    sourceBundleVersion: eventBundles.version,
    promptFingerprint: nextPromptFingerprint,
    outputRootPath,
    outputFolderPath: null,
    outputArtifacts: [],
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  });

  try {
    if (isJobCancellationRequested(jobId)) {
      saveWorkspaceClassificationState(
        jobId,
        buildCanceledClassificationState(
          jobId,
          eventBundles,
          nextPromptFingerprint,
          outputRootPath,
          "EB1A classification was canceled before it started.",
        ),
      );
      clearJobCancellationRequest(jobId);
      return;
    }

    const reviewableDocuments = documents.filter((document) =>
      isReviewableEvidenceFile(document),
    );
    const result = await generateEb1aClassification(
      jobId,
      candidateName,
      eventBundles.bundles,
      reviewableDocuments,
    );

    if (isJobCancellationRequested(jobId)) {
      saveWorkspaceClassificationState(
        jobId,
        buildCanceledClassificationState(
          jobId,
          eventBundles,
          nextPromptFingerprint,
          outputRootPath,
          "EB1A classification was canceled during the AI criteria pass.",
        ),
      );
      clearJobCancellationRequest(jobId);
      return;
    }

    const buckets = buildBuckets(result.decisions);
    const unclassifiedBundleIds = result.decisions
      .filter((decision) => decision.reviewDisposition === "unclassified")
      .map((decision) => decision.bundleId);
    const outputPackage = await createOutputPackage({
      jobId,
      folderLabel: reviewableDocuments[0]?.folderLabel || jobId,
      candidateName,
      outputRootPath,
      bundles: eventBundles.bundles,
      decisions: result.decisions,
      documents: reviewableDocuments,
    });

    saveWorkspaceClassificationState(jobId, {
      version: EB1A_CLASSIFICATION_VERSION,
      jobId,
      status: "completed",
      message: `Classified ${result.decisions.length} event bundle(s) and saved the output package for downstream review.`,
      decisions: result.decisions,
      buckets,
      unclassifiedBundleIds,
      sourceBundleCount: eventBundles.bundles.length,
      sourceBundleUpdatedAt: eventBundles.updatedAt,
      sourceBundleVersion: eventBundles.version,
      promptFingerprint: nextPromptFingerprint,
      outputRootPath,
      outputFolderPath: outputPackage.outputFolderPath,
      outputArtifacts: outputPackage.outputArtifacts,
      totalCostUsd: roundUsd(result.usage?.costUsd ?? 0),
      updatedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    saveWorkspaceClassificationState(jobId, {
      version: EB1A_CLASSIFICATION_VERSION,
      jobId,
      status: "failed",
      message: "EB1A classification could not be completed for this workspace.",
      decisions: [],
      buckets: buildBuckets([]),
      unclassifiedBundleIds: [],
      sourceBundleCount: eventBundles.bundles.length,
      sourceBundleUpdatedAt: eventBundles.updatedAt,
      sourceBundleVersion: eventBundles.version,
      promptFingerprint: nextPromptFingerprint,
      outputRootPath,
      outputFolderPath: null,
      outputArtifacts: [],
      totalCostUsd: 0,
      updatedAt: new Date().toISOString(),
      error:
        error instanceof Error ? error.message : "Unknown EB1A classification error.",
    });
  } finally {
    activeCriterionJobs.delete(jobId);
  }
}

export function startWorkspaceEb1aClassificationJob(
  jobId: string,
  candidateName: string,
  eventBundles: WorkspaceEventBundleState,
  documents: StoredDocument[],
) {
  if (activeCriterionJobs.has(jobId)) {
    return;
  }

  if (getJob(jobId)?.status === "canceled" || isJobCancellationRequested(jobId)) {
    const { classificationPrompt, outputRootPath } = getRuntimeSettings();
    const nextPromptFingerprint = promptFingerprint(
      classificationPrompt,
      candidateName,
      outputRootPath,
      getRuntimeSettings().folderSignalPolicy,
    );

    saveWorkspaceClassificationState(
      jobId,
      buildCanceledClassificationState(
        jobId,
        eventBundles,
        nextPromptFingerprint,
        outputRootPath,
        "EB1A classification was canceled before it started.",
      ),
    );
    clearJobCancellationRequest(jobId);
    return;
  }

  activeCriterionJobs.add(jobId);
  const { classificationPrompt, outputRootPath } = getRuntimeSettings();
  const nextPromptFingerprint = promptFingerprint(
    classificationPrompt,
    candidateName,
    outputRootPath,
    getRuntimeSettings().folderSignalPolicy,
  );

  saveWorkspaceClassificationState(jobId, {
    version: EB1A_CLASSIFICATION_VERSION,
    jobId,
    status: "queued",
    message: "EB1A classification is queued for this workspace.",
    decisions: [],
    buckets: buildBuckets([]),
    unclassifiedBundleIds: [],
    sourceBundleCount: eventBundles.bundles.length,
    sourceBundleUpdatedAt: eventBundles.updatedAt,
    sourceBundleVersion: eventBundles.version,
    promptFingerprint: nextPromptFingerprint,
    outputRootPath,
    outputFolderPath: null,
    outputArtifacts: [],
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  });

  setTimeout(() => {
    void runWorkspaceClassificationJob(jobId, candidateName, eventBundles, documents);
  }, 0);
}

export function ensureWorkspaceEb1aClassification(
  jobId: string,
  candidateName: string,
  eventBundles: WorkspaceEventBundleState | null,
  documents: StoredDocument[],
) {
  const { classificationPrompt, outputRootPath } = getRuntimeSettings();
  const nextPromptFingerprint = promptFingerprint(
    classificationPrompt,
    candidateName,
    outputRootPath,
    getRuntimeSettings().folderSignalPolicy,
  );
  const storedState = getStoredClassificationState(jobId);
  const job = getJob(jobId);

  if (job?.status === "canceled") {
    return (
      storedState ??
      buildCanceledClassificationState(
        jobId,
        eventBundles,
        nextPromptFingerprint,
        outputRootPath,
        "EB1A classification was canceled for this workspace.",
      )
    );
  }

  if (!eventBundles || eventBundles.status !== "completed" || !eventBundles.bundles.length) {
    return (
      storedState ??
      buildSyntheticClassificationState(
        jobId,
        eventBundles,
        nextPromptFingerprint,
        outputRootPath,
        "EB1A classification will start after event bundling completes.",
      )
    );
  }

  if (
    storedState?.status === "failed" ||
    ((!storedState || storedState.status !== "canceled") &&
      !isClassificationStateCurrent(
        storedState,
        eventBundles,
        nextPromptFingerprint,
        outputRootPath,
      ))
  ) {
    startWorkspaceEb1aClassificationJob(jobId, candidateName, eventBundles, documents);

    return (
      getStoredClassificationState(jobId) ??
      buildSyntheticClassificationState(
        jobId,
        eventBundles,
        nextPromptFingerprint,
        outputRootPath,
        "EB1A classification has been queued for this workspace.",
      )
    );
  }

  return storedState;
}
