import fs from "node:fs/promises";
import path from "node:path";
import { EXPORT_ROOT, PREVIEW_ROOT, UPLOAD_ROOT } from "@/lib/constants";
import { removeJob } from "@/lib/jobs";
import { deleteJobDocuments, getJobDocuments } from "@/lib/qdrant";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type {
  WorkspaceEb1aClassificationState,
  WorkspaceManualOverrideState,
} from "@/lib/types";

interface WorkspaceStateFile<T> {
  workspaces: Record<string, T>;
}

const WORKSPACE_STATE_FILES = [
  "event-bundles.json",
  "eb1a-classification.json",
  "criteria-tagging.json",
  "manual-overrides.json",
  "review-state.json",
] as const;

function isWithinRoot(root: string, target: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function readWorkspaceStateFile<T>(fileName: string) {
  return readStateFile<WorkspaceStateFile<T>>(fileName, {
    workspaces: {},
  });
}

function writeWorkspaceStateFile<T>(fileName: string, state: WorkspaceStateFile<T>) {
  writeStateFile(fileName, state);
}

function removeWorkspaceStateRecord(fileName: string, jobId: string) {
  const state = readWorkspaceStateFile<unknown>(fileName);

  if (!(jobId in state.workspaces)) {
    return;
  }

  delete state.workspaces[jobId];
  writeWorkspaceStateFile(fileName, state);
}

function collectWorkspaceOutputFolders(jobId: string) {
  const classificationState =
    readWorkspaceStateFile<WorkspaceEb1aClassificationState>("eb1a-classification.json")
      .workspaces[jobId] ?? null;
  const manualOverrideState =
    readWorkspaceStateFile<WorkspaceManualOverrideState>("manual-overrides.json").workspaces[
      jobId
    ] ?? null;

  const outputRootCandidates = [
    EXPORT_ROOT,
    classificationState?.outputRootPath,
    manualOverrideState?.outputRootPath,
  ].filter((value): value is string => Boolean(value));

  const outputFolderCandidates = [
    classificationState?.outputFolderPath,
    manualOverrideState?.outputFolderPath,
  ].filter((value): value is string => Boolean(value));

  return outputFolderCandidates.filter((folderPath) =>
    outputRootCandidates.some((rootPath) => isWithinRoot(rootPath, folderPath)),
  );
}

export async function deleteWorkspaceData(jobId: string) {
  const documents = await getJobDocuments(jobId);
  const outputFolders = collectWorkspaceOutputFolders(jobId);

  await Promise.allSettled([
    fs.rm(path.join(UPLOAD_ROOT, jobId), { recursive: true, force: true }),
    ...documents.map((document) =>
      fs.rm(path.join(PREVIEW_ROOT, document.id), { recursive: true, force: true }),
    ),
    ...outputFolders.map((folderPath) =>
      fs.rm(path.resolve(folderPath), { recursive: true, force: true }),
    ),
  ]);

  await deleteJobDocuments(jobId);

  WORKSPACE_STATE_FILES.forEach((fileName) => {
    removeWorkspaceStateRecord(fileName, jobId);
  });

  removeJob(jobId);

  return {
    deletedDocuments: documents.length,
  };
}
