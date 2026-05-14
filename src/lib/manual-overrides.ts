import {
  EB1A_CRITERIA_DEFINITIONS,
  SPECIAL_REVIEW_BUCKET_DEFINITIONS,
} from "@/lib/constants";
import { createOutputPackage } from "@/lib/output-package";
import {
  formatSpecialBundleName,
  formatSpecialExhibitTitle,
  getReviewBucketForCode,
  getReviewBucketForDisposition,
} from "@/lib/review-routing";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type {
  Eb1aCriterionBucket,
  Eb1aCriterionDecision,
  EventBundle,
  StoredDocument,
  DocumentDispositionOverride,
  WorkspaceEb1aClassificationState,
  WorkspaceEventBundleState,
  WorkspaceManualOverrideState,
} from "@/lib/types";

interface ManualOverrideStateFile {
  workspaces: Record<string, WorkspaceManualOverrideState>;
}

interface ApplyManualOverridesInput {
  jobId: string;
  eventBundles: WorkspaceEventBundleState | null;
  classification: WorkspaceEb1aClassificationState | null;
  documents: StoredDocument[];
  overrideState: WorkspaceManualOverrideState;
}

const MANUAL_OVERRIDE_FILE = "manual-overrides.json";
const MANUAL_OVERRIDE_VERSION = 1;

function readManualOverrideStateFile() {
  return readStateFile<ManualOverrideStateFile>(MANUAL_OVERRIDE_FILE, {
    workspaces: {},
  });
}

function writeManualOverrideStateFile(state: ManualOverrideStateFile) {
  writeStateFile(MANUAL_OVERRIDE_FILE, state);
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

  decisions.forEach((decision) => {
    const bucket = bucketMap.get(decision.bucketCode);

    if (bucket) {
      bucket.bundleIds.push(decision.bundleId);
    }
  });

  return Array.from(bucketMap.values());
}

function cloneBundle(bundle: EventBundle): EventBundle {
  return {
    ...bundle,
    organizations: [...bundle.organizations],
    people: [...bundle.people],
    keywords: [...bundle.keywords],
    evidenceDocumentIds: [...bundle.evidenceDocumentIds],
  };
}

function countOverrides(state: WorkspaceManualOverrideState) {
  return (
    Object.keys(state.categoryOverrides).length +
    Object.keys(state.documentEventOverrides).length +
    Object.keys(state.documentDispositionOverrides).length
  );
}

export function createEmptyManualOverrideState(
  jobId: string,
  outputRootPath: string,
): WorkspaceManualOverrideState {
  return {
    version: MANUAL_OVERRIDE_VERSION,
    jobId,
    updatedAt: new Date(0).toISOString(),
    categoryOverrides: {},
    documentEventOverrides: {},
    documentDispositionOverrides: {},
    outputRootPath,
    outputFolderPath: null,
    outputArtifacts: [],
  };
}

export function getWorkspaceManualOverrideState(
  jobId: string,
  outputRootPath: string,
) {
  const stored = readManualOverrideStateFile().workspaces[jobId];

  if (!stored) {
    return createEmptyManualOverrideState(jobId, outputRootPath);
  }

  return {
    version: stored.version ?? MANUAL_OVERRIDE_VERSION,
    jobId,
    updatedAt: stored.updatedAt || new Date(0).toISOString(),
    categoryOverrides:
      stored.categoryOverrides && typeof stored.categoryOverrides === "object"
        ? stored.categoryOverrides
        : {},
    documentEventOverrides:
      stored.documentEventOverrides && typeof stored.documentEventOverrides === "object"
        ? stored.documentEventOverrides
        : {},
    documentDispositionOverrides:
      stored.documentDispositionOverrides &&
      typeof stored.documentDispositionOverrides === "object"
        ? stored.documentDispositionOverrides
        : {},
    outputRootPath: outputRootPath || stored.outputRootPath,
    outputFolderPath: stored.outputFolderPath ?? null,
    outputArtifacts: Array.isArray(stored.outputArtifacts) ? stored.outputArtifacts : [],
  } satisfies WorkspaceManualOverrideState;
}

export function saveWorkspaceManualOverrideState(
  jobId: string,
  nextState: WorkspaceManualOverrideState,
) {
  const state = readManualOverrideStateFile();
  state.workspaces[jobId] = nextState;
  writeManualOverrideStateFile(state);
}

function buildDocumentBundleLookup(bundles: EventBundle[]) {
  const lookup = new Map<string, string>();

  bundles.forEach((bundle) => {
    bundle.evidenceDocumentIds.forEach((documentId) => {
      lookup.set(documentId, bundle.id);
    });
  });

  return lookup;
}

function buildDocumentLookup(documents: StoredDocument[]) {
  return new Map(documents.map((document) => [document.id, document]));
}

function removeDocumentFromBundles(bundles: EventBundle[], documentId: string) {
  return bundles
    .map((bundle) => {
      if (!bundle.evidenceDocumentIds.includes(documentId)) {
        return bundle;
      }

      const nextDocumentIds = bundle.evidenceDocumentIds.filter((entry) => entry !== documentId);

      return {
        ...bundle,
        evidenceDocumentIds: nextDocumentIds,
        leadDocumentId:
          bundle.leadDocumentId === documentId
            ? nextDocumentIds[0] ?? null
            : bundle.leadDocumentId,
      };
    })
    .filter((bundle) => bundle.evidenceDocumentIds.length > 0);
}

function buildSyntheticDocumentBundle(
  jobId: string,
  document: StoredDocument,
  disposition: DocumentDispositionOverride,
): EventBundle {
  const summary = document.summary;

  return {
    id: `manual-${disposition}-${document.id}`,
    jobId,
    bundleKind: disposition,
    name: formatSpecialBundleName(document, disposition),
    shortSummary:
      summary?.shortSummary ||
      (disposition === "archive"
        ? "This evidence has been archived out of the active petition review set."
        : "This evidence has been removed from the active petition review set."),
    detailedSummary:
      summary?.detailedSummary ||
      (disposition === "archive"
        ? "This evidence has been manually archived for later review and is excluded from the active petition drafting set."
        : "This evidence has been manually removed from the active petition drafting set and should be reviewed separately before petition drafting."),
    eventType: disposition === "archive" ? "Archived evidence" : "Removed evidence",
    latestRelevantDate: summary?.primaryDate ?? null,
    timeframeLabel:
      summary?.primaryDateReason ||
      (disposition === "archive"
        ? "Archived for later review"
        : "Removed before petition drafting"),
    location: summary?.locations?.[0] || "Location not specified",
    organizations: summary?.organizations ?? [],
    people: summary?.people ?? [],
    keywords: summary?.tags ?? [],
    confidence: summary?.confidence ?? 0,
    leadDocumentId: document.id,
    evidenceDocumentIds: [document.id],
  };
}

function applyDocumentEventOverrides(
  bundles: EventBundle[],
  documentEventOverrides: Record<string, string>,
) {
  let currentBundles = bundles.map(cloneBundle);

  Object.entries(documentEventOverrides)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .forEach(([documentId, targetBundleId]) => {
      const currentLookup = buildDocumentBundleLookup(currentBundles);
      const sourceBundleId = currentLookup.get(documentId);

      if (!sourceBundleId || sourceBundleId === targetBundleId) {
        return;
      }

      const targetBundle = currentBundles.find((bundle) => bundle.id === targetBundleId);

      if (!targetBundle) {
        return;
      }

      currentBundles = currentBundles
        .map((bundle) => {
          if (bundle.id === sourceBundleId) {
            const nextDocumentIds = bundle.evidenceDocumentIds.filter(
              (entry) => entry !== documentId,
            );

            return {
              ...bundle,
              evidenceDocumentIds: nextDocumentIds,
              leadDocumentId:
                bundle.leadDocumentId === documentId ? nextDocumentIds[0] ?? null : bundle.leadDocumentId,
            };
          }

          if (bundle.id === targetBundleId) {
            return bundle.evidenceDocumentIds.includes(documentId)
              ? bundle
              : {
                  ...bundle,
                  evidenceDocumentIds: [...bundle.evidenceDocumentIds, documentId],
                  leadDocumentId: bundle.leadDocumentId ?? documentId,
                };
          }

          return bundle;
        })
        .filter((bundle) => bundle.evidenceDocumentIds.length > 0);
    });

  return currentBundles;
}

function applyDocumentDispositionOverrides(
  bundles: EventBundle[],
  documents: StoredDocument[],
  documentDispositionOverrides: Record<string, DocumentDispositionOverride>,
  jobId: string,
) {
  let currentBundles = bundles.map(cloneBundle);
  const documentLookup = buildDocumentLookup(documents);

  Object.entries(documentDispositionOverrides)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .forEach(([documentId, disposition]) => {
      const document = documentLookup.get(documentId);

      if (!document) {
        return;
      }

      currentBundles = removeDocumentFromBundles(currentBundles, documentId).filter(
        (bundle) => bundle.id !== `manual-${disposition}-${documentId}`,
      );

      currentBundles.push(buildSyntheticDocumentBundle(jobId, document, disposition));
    });

  return currentBundles;
}

function buildSyntheticDecision(bundle: EventBundle, documents: StoredDocument[]) {
  if (bundle.bundleKind !== "archive" && bundle.bundleKind !== "unwanted") {
    return null;
  }

  const leadDocument =
    documents.find((document) => document.id === bundle.leadDocumentId) ??
    documents.find((document) => document.id === bundle.evidenceDocumentIds[0]) ??
    null;
  const bucket = getReviewBucketForDisposition(bundle.bundleKind);
  const rationale =
    bundle.bundleKind === "archive"
      ? "This evidence was manually archived and excluded from the active petition drafting set."
      : "This evidence was manually removed from the active petition drafting set for separate human review.";

  return {
    bundleId: bundle.id,
    bucketCode: bucket.bucketCode,
    bucketName: bucket.bucketName,
    bucketKind: bucket.bucketKind,
    primaryCriterionCode: null,
    primaryCriterionName: null,
    secondaryCriterionCodes: [],
    secondaryCriterionNames: [],
    confidence: leadDocument?.summary?.confidence ?? bundle.confidence,
    rationale,
    reviewDisposition: bundle.bundleKind,
    unclassifiedReason: bundle.bundleKind === "unwanted" ? rationale : null,
    suggestedExhibitTitle: leadDocument
      ? formatSpecialExhibitTitle(leadDocument, bundle.bundleKind)
      : bundle.name,
  } satisfies Eb1aCriterionDecision;
}

function applyCategoryOverrides(
  bundles: EventBundle[],
  classification: WorkspaceEb1aClassificationState | null,
  categoryOverrides: Record<string, string>,
  documents: StoredDocument[],
) {
  if (!classification) {
    return null;
  }

  if (classification.status !== "completed") {
    return classification;
  }

  const baseDecisionLookup = new Map(
    classification.decisions.map((decision) => [decision.bundleId, decision]),
  );

  const decisions = bundles
    .map((bundle) => {
      const baseDecision =
        baseDecisionLookup.get(bundle.id) ?? buildSyntheticDecision(bundle, documents);

      if (!baseDecision) {
        return null;
      }

      const overrideBucketCode = categoryOverrides[bundle.id];

      if (!overrideBucketCode) {
        return { ...baseDecision };
      }

      const bucket = getReviewBucketForCode(overrideBucketCode);

      return {
        ...baseDecision,
        bucketCode: bucket.bucketCode,
        bucketName: bucket.bucketName,
        bucketKind: bucket.bucketKind,
        primaryCriterionCode: bucket.primaryCriterionCode,
        primaryCriterionName: bucket.primaryCriterionName,
        secondaryCriterionCodes:
          bucket.reviewDisposition === "classified" ? baseDecision.secondaryCriterionCodes : [],
        secondaryCriterionNames:
          bucket.reviewDisposition === "classified" ? baseDecision.secondaryCriterionNames : [],
        reviewDisposition: bucket.reviewDisposition,
        unclassifiedReason:
          bucket.reviewDisposition === "unclassified"
            ? baseDecision.unclassifiedReason || "Manually routed to human review."
            : bucket.reviewDisposition === "unwanted"
              ? baseDecision.unclassifiedReason || "Manually routed to unwanted review."
              : null,
      } satisfies Eb1aCriterionDecision;
    })
    .filter((decision): decision is Eb1aCriterionDecision => Boolean(decision));

  const overrideCount = Object.keys(categoryOverrides).length;

  return {
    ...classification,
    decisions,
    buckets: buildBuckets(decisions),
    unclassifiedBundleIds: decisions
      .filter((decision) => decision.reviewDisposition === "unclassified")
      .map((decision) => decision.bundleId),
    message:
      overrideCount > 0
        ? `${classification.message} Manual category overrides active: ${overrideCount}.`
        : classification.message,
  } satisfies WorkspaceEb1aClassificationState;
}

export function applyWorkspaceManualOverrides(input: ApplyManualOverridesInput) {
  if (!input.eventBundles || input.eventBundles.status !== "completed") {
    return {
      eventBundles: input.eventBundles,
      classification: input.classification,
      overrideState: input.overrideState,
    };
  }

  const overrideCount = countOverrides(input.overrideState);
  const eventAdjustedBundles = applyDocumentEventOverrides(
    input.eventBundles.bundles,
    input.overrideState.documentEventOverrides,
  );
  const bundles = applyDocumentDispositionOverrides(
    eventAdjustedBundles,
    input.documents,
    input.overrideState.documentDispositionOverrides,
    input.jobId,
  );
  const eventBundles: WorkspaceEventBundleState = {
    ...input.eventBundles,
    bundles,
    message:
      overrideCount > 0
        ? `${input.eventBundles.message} Manual overrides active: ${overrideCount}.`
        : input.eventBundles.message,
  };
  const classification = applyCategoryOverrides(
    bundles,
    input.classification,
    input.overrideState.categoryOverrides,
    input.documents,
  );

  if (
    classification &&
    input.overrideState.outputFolderPath &&
    input.overrideState.outputArtifacts.length
  ) {
    classification.outputFolderPath = input.overrideState.outputFolderPath;
    classification.outputArtifacts = input.overrideState.outputArtifacts;
  }

  return {
    eventBundles,
    classification,
    overrideState: input.overrideState,
  };
}

export async function regenerateWorkspaceOverrideOutput(input: {
  jobId: string;
  folderLabel: string;
  candidateName: string;
  documents: StoredDocument[];
  eventBundles: WorkspaceEventBundleState | null;
  classification: WorkspaceEb1aClassificationState | null;
  overrideState: WorkspaceManualOverrideState;
}) {
  const effective = applyWorkspaceManualOverrides({
    jobId: input.jobId,
    eventBundles: input.eventBundles,
    classification: input.classification,
    documents: input.documents,
    overrideState: input.overrideState,
  });

  if (!effective.eventBundles || !effective.classification) {
    return input.overrideState;
  }

  if (countOverrides(input.overrideState) === 0) {
    return {
      ...input.overrideState,
      outputFolderPath: null,
      outputArtifacts: [],
    };
  }

  const outputPackage = await createOutputPackage({
    jobId: input.jobId,
    folderLabel: input.folderLabel,
    candidateName: input.candidateName,
    outputRootPath: input.overrideState.outputRootPath,
    bundles: effective.eventBundles.bundles,
    decisions: effective.classification.decisions,
    documents: input.documents,
  });

  return {
    ...input.overrideState,
    outputFolderPath: outputPackage.outputFolderPath,
    outputArtifacts: outputPackage.outputArtifacts,
  } satisfies WorkspaceManualOverrideState;
}
