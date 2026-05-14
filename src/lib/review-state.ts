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
