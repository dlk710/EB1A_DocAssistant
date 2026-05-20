import crypto from "node:crypto";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type { SubBundle, WorkspaceReviewState } from "@/lib/types";

interface ReviewStateFile {
  workspaces: Record<string, WorkspaceReviewState>;
}

const REVIEW_STATE_FILE = "review-state.json";
const REVIEW_STATE_VERSION = 1;

function readReviewStateFile() {
  return readStateFile<ReviewStateFile>(REVIEW_STATE_FILE, {
    workspaces: {},
  });
}

function writeReviewStateFile(state: ReviewStateFile) {
  writeStateFile(REVIEW_STATE_FILE, state);
}

export function createEmptyWorkspaceReviewState(jobId: string): WorkspaceReviewState {
  return {
    version: REVIEW_STATE_VERSION,
    jobId,
    updatedAt: new Date(0).toISOString(),
    bannerDismissedAt: null,
    subBundles: [],
    documentBundleDecisions: {},
    bundleCriterionDecisions: {},
  };
}

export function getWorkspaceReviewState(jobId: string) {
  const state = readReviewStateFile().workspaces[jobId];

  if (!state) {
    return createEmptyWorkspaceReviewState(jobId);
  }

  return {
    version: state.version ?? REVIEW_STATE_VERSION,
    jobId,
    updatedAt: state.updatedAt || new Date(0).toISOString(),
    bannerDismissedAt: state.bannerDismissedAt ?? null,
    subBundles: Array.isArray(state.subBundles)
      ? state.subBundles.map((subBundle) => ({
          id: subBundle.id,
          jobId,
          parentBundleId: subBundle.parentBundleId,
          name: subBundle.name,
          evidenceDocumentIds: Array.isArray(subBundle.evidenceDocumentIds)
            ? subBundle.evidenceDocumentIds
            : [],
          createdAt: subBundle.createdAt,
          updatedAt: subBundle.updatedAt || subBundle.createdAt,
        }))
      : [],
    documentBundleDecisions:
      state.documentBundleDecisions && typeof state.documentBundleDecisions === "object"
        ? Object.fromEntries(
            Object.entries(state.documentBundleDecisions)
              .filter(([, value]) => Boolean(value && typeof value === "object"))
              .map(([documentId, value]) => [
                documentId,
                {
                  status: value.status === "other" ? "other" : "accepted",
                  updatedAt:
                    typeof value.updatedAt === "string"
                      ? value.updatedAt
                      : new Date(0).toISOString(),
                },
              ]),
          )
        : {},
    bundleCriterionDecisions:
      state.bundleCriterionDecisions && typeof state.bundleCriterionDecisions === "object"
        ? Object.fromEntries(
            Object.entries(state.bundleCriterionDecisions)
              .filter(([, value]) => Boolean(value && typeof value === "object"))
              .map(([bundleId, value]) => [
                bundleId,
                {
                  status: value.status === "other" ? "other" : "accepted",
                  criterionCode:
                    typeof value.criterionCode === "string" ? value.criterionCode : null,
                  updatedAt:
                    typeof value.updatedAt === "string"
                      ? value.updatedAt
                      : new Date(0).toISOString(),
                },
              ]),
          )
        : {},
  } satisfies WorkspaceReviewState;
}

export function saveWorkspaceReviewState(
  jobId: string,
  nextState: WorkspaceReviewState,
) {
  const state = readReviewStateFile();
  state.workspaces[jobId] = nextState;
  writeReviewStateFile(state);
}

export function dismissWorkspaceReviewBanner(jobId: string) {
  const current = getWorkspaceReviewState(jobId);

  saveWorkspaceReviewState(jobId, {
    ...current,
    bannerDismissedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function createSubBundle(input: {
  jobId: string;
  parentBundleId: string;
  name: string;
  evidenceDocumentIds: string[];
}) {
  const current = getWorkspaceReviewState(input.jobId);
  const now = new Date().toISOString();
  const subBundle: SubBundle = {
    id: crypto.randomUUID(),
    jobId: input.jobId,
    parentBundleId: input.parentBundleId,
    name: input.name.trim(),
    evidenceDocumentIds: [...new Set(input.evidenceDocumentIds)],
    createdAt: now,
    updatedAt: now,
  };

  saveWorkspaceReviewState(input.jobId, {
    ...current,
    updatedAt: now,
    subBundles: [...current.subBundles, subBundle],
  });

  return subBundle;
}

export function updateSubBundle(
  jobId: string,
  subBundleId: string,
  updater: (current: SubBundle) => SubBundle | null,
) {
  const current = getWorkspaceReviewState(jobId);
  let nextSubBundle: SubBundle | null = null;

  const nextSubBundles = current.subBundles
    .map((subBundle) => {
      if (subBundle.id !== subBundleId) {
        return subBundle;
      }

      nextSubBundle = updater(subBundle);
      return nextSubBundle;
    })
    .filter((subBundle): subBundle is SubBundle => Boolean(subBundle));

  saveWorkspaceReviewState(jobId, {
    ...current,
    updatedAt: new Date().toISOString(),
    subBundles: nextSubBundles,
  });

  return nextSubBundle;
}

export function removeDocumentFromSubBundles(
  jobId: string,
  documentIds: string[],
  parentBundleId?: string | null,
) {
  const current = getWorkspaceReviewState(jobId);
  const documentIdSet = new Set(documentIds);
  const nextSubBundles = current.subBundles
    .map((subBundle) => {
      if (parentBundleId && subBundle.parentBundleId !== parentBundleId) {
        return subBundle;
      }

      return {
        ...subBundle,
        evidenceDocumentIds: subBundle.evidenceDocumentIds.filter(
          (documentId) => !documentIdSet.has(documentId),
        ),
        updatedAt: new Date().toISOString(),
      };
    })
    .filter((subBundle) => subBundle.evidenceDocumentIds.length > 0);

  saveWorkspaceReviewState(jobId, {
    ...current,
    updatedAt: new Date().toISOString(),
    subBundles: nextSubBundles,
  });
}

export function setDocumentBundleDecision(
  jobId: string,
  documentId: string,
  status: "accepted" | "other",
) {
  const current = getWorkspaceReviewState(jobId);
  const now = new Date().toISOString();

  saveWorkspaceReviewState(jobId, {
    ...current,
    updatedAt: now,
    documentBundleDecisions: {
      ...current.documentBundleDecisions,
      [documentId]: {
        status,
        updatedAt: now,
      },
    },
  });
}

export function clearDocumentBundleDecision(jobId: string, documentId: string) {
  const current = getWorkspaceReviewState(jobId);

  if (!(documentId in current.documentBundleDecisions)) {
    return;
  }

  const nextDecisions = { ...current.documentBundleDecisions };
  delete nextDecisions[documentId];

  saveWorkspaceReviewState(jobId, {
    ...current,
    updatedAt: new Date().toISOString(),
    documentBundleDecisions: nextDecisions,
  });
}

export function clearDocumentBundleDecisions(jobId: string, documentIds: string[]) {
  const current = getWorkspaceReviewState(jobId);
  const nextDecisions = { ...current.documentBundleDecisions };
  let changed = false;

  documentIds.forEach((documentId) => {
    if (documentId in nextDecisions) {
      delete nextDecisions[documentId];
      changed = true;
    }
  });

  if (!changed) {
    return;
  }

  saveWorkspaceReviewState(jobId, {
    ...current,
    updatedAt: new Date().toISOString(),
    documentBundleDecisions: nextDecisions,
  });
}

export function setBundleCriterionDecision(
  jobId: string,
  bundleId: string,
  status: "accepted" | "other",
  criterionCode: string | null,
) {
  const current = getWorkspaceReviewState(jobId);
  const now = new Date().toISOString();

  saveWorkspaceReviewState(jobId, {
    ...current,
    updatedAt: now,
    bundleCriterionDecisions: {
      ...current.bundleCriterionDecisions,
      [bundleId]: {
        status,
        criterionCode,
        updatedAt: now,
      },
    },
  });
}

export function clearBundleCriterionDecision(jobId: string, bundleId: string) {
  const current = getWorkspaceReviewState(jobId);

  if (!(bundleId in current.bundleCriterionDecisions)) {
    return;
  }

  const nextDecisions = { ...current.bundleCriterionDecisions };
  delete nextDecisions[bundleId];

  saveWorkspaceReviewState(jobId, {
    ...current,
    updatedAt: new Date().toISOString(),
    bundleCriterionDecisions: nextDecisions,
  });
}

export function clearBundleCriterionDecisions(jobId: string, bundleIds: string[]) {
  const current = getWorkspaceReviewState(jobId);
  const nextDecisions = { ...current.bundleCriterionDecisions };
  let changed = false;

  bundleIds.forEach((bundleId) => {
    if (bundleId in nextDecisions) {
      delete nextDecisions[bundleId];
      changed = true;
    }
  });

  if (!changed) {
    return;
  }

  saveWorkspaceReviewState(jobId, {
    ...current,
    updatedAt: new Date().toISOString(),
    bundleCriterionDecisions: nextDecisions,
  });
}
