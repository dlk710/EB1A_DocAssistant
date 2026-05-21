import type { DuplicateDocumentReport, JobRecord, SystemArchiveReport } from "@/lib/types";
import { readStateFile, writeStateFile } from "@/lib/state-store";

interface JobsState {
  jobs: JobRecord[];
}

const JOBS_FILE = "jobs.json";

function readJobsState(): JobsState {
  const state = readStateFile<JobsState>(JOBS_FILE, { jobs: [] });

  return {
    jobs: state.jobs.map((job) => ({
      ...job,
      clientId: job.clientId ?? "",
      candidateName: job.candidateName ?? "",
      cancellationRequestedAt: job.cancellationRequestedAt ?? null,
      duplicateReport:
        job.duplicateReport &&
        typeof job.duplicateReport === "object" &&
        Array.isArray(job.duplicateReport.groups)
          ? {
              selectedFiles: Number(job.duplicateReport.selectedFiles ?? job.totalFiles ?? 0),
              uniqueFiles: Number(job.duplicateReport.uniqueFiles ?? job.totalFiles ?? 0),
              skippedDuplicateFiles: Number(job.duplicateReport.skippedDuplicateFiles ?? 0),
              groups: job.duplicateReport.groups
                .filter((group) => group && typeof group === "object")
                .map((group) => ({
                  checksum: String(group.checksum ?? ""),
                  keptRelativePath: String(group.keptRelativePath ?? ""),
                  duplicateRelativePaths: Array.isArray(group.duplicateRelativePaths)
                    ? group.duplicateRelativePaths.map((value) => String(value))
                    : [],
                }))
                .filter((group) => group.keptRelativePath && group.duplicateRelativePaths.length),
            }
          : null,
      systemArchiveReport:
        job.systemArchiveReport &&
        typeof job.systemArchiveReport === "object" &&
        Array.isArray(job.systemArchiveReport.files)
          ? {
              autoArchivedFiles: Number(job.systemArchiveReport.autoArchivedFiles ?? 0),
              files: job.systemArchiveReport.files
                .filter((file) => file && typeof file === "object")
                .map((file) => ({
                  relativePath: String(file.relativePath ?? ""),
                  reason: String(file.reason ?? ""),
                }))
                .filter((file) => file.relativePath),
            }
          : null,
    })),
  };
}

function writeJobsState(state: JobsState) {
  writeStateFile(JOBS_FILE, state);
}

function sortJobs(jobs: JobRecord[]) {
  return [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function updateJob(jobId: string, updater: (job: JobRecord) => JobRecord) {
  const state = readJobsState();
  state.jobs = state.jobs.map((job) => (job.id === jobId ? updater(job) : job));
  writeJobsState(state);
}

export function createJob(
  job: Pick<JobRecord, "id" | "clientId" | "candidateName" | "folderLabel" | "totalFiles"> & {
    duplicateReport?: DuplicateDocumentReport | null;
    systemArchiveReport?: SystemArchiveReport | null;
  },
) {
  const state = readJobsState();
  state.jobs = sortJobs([
    {
      id: job.id,
      clientId: job.clientId,
      candidateName: job.candidateName,
      folderLabel: job.folderLabel,
      status: "queued",
      cancellationRequestedAt: null,
      totalFiles: job.totalFiles,
      processedFiles: 0,
      failedFiles: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      duplicateReport: job.duplicateReport ?? null,
      systemArchiveReport: job.systemArchiveReport ?? null,
    },
    ...state.jobs,
  ]);
  writeJobsState(state);
}

export function getJob(jobId: string) {
  return readJobsState().jobs.find((job) => job.id === jobId) ?? null;
}

export function listJobs(limit = 8) {
  return sortJobs(readJobsState().jobs).slice(0, limit);
}

export function markJobProcessing(jobId: string) {
  updateJob(jobId, (job) => ({
    ...job,
    status: "processing",
    startedAt: job.startedAt || new Date().toISOString(),
    error: null,
  }));
}

export function incrementJobProgress(jobId: string, failed = false) {
  updateJob(jobId, (job) => ({
    ...job,
    processedFiles: job.processedFiles + 1,
    failedFiles: job.failedFiles + (failed ? 1 : 0),
  }));
}

export function finalizeJob(jobId: string) {
  updateJob(jobId, (job) => ({
    ...job,
    status: job.failedFiles > 0 ? "completed_with_errors" : "completed",
    cancellationRequestedAt: null,
    completedAt: new Date().toISOString(),
  }));
}

export function failJob(jobId: string, error: string) {
  updateJob(jobId, (job) => ({
    ...job,
    status: "failed",
    cancellationRequestedAt: null,
    error,
    completedAt: new Date().toISOString(),
  }));
}

export function requestJobCancellation(jobId: string) {
  updateJob(jobId, (job) => ({
    ...job,
    status:
      job.status === "queued" || job.status === "processing" ? "canceling" : job.status,
    cancellationRequestedAt: job.cancellationRequestedAt || new Date().toISOString(),
    error: job.error,
  }));
}

export function isJobCancellationRequested(jobId: string) {
  const job = getJob(jobId);

  return Boolean(job?.cancellationRequestedAt);
}

export function cancelJob(jobId: string, error: string) {
  updateJob(jobId, (job) => ({
    ...job,
    status: "canceled",
    cancellationRequestedAt: null,
    error,
    completedAt: new Date().toISOString(),
  }));
}

export function clearJobCancellationRequest(jobId: string) {
  updateJob(jobId, (job) => ({
    ...job,
    cancellationRequestedAt: null,
    status: job.status === "canceling" ? "processing" : job.status,
  }));
}

export function removeJob(jobId: string) {
  const state = readJobsState();
  state.jobs = state.jobs.filter((job) => job.id !== jobId);
  writeJobsState(state);
}

export function replaceJobs(jobs: JobRecord[]) {
  writeJobsState({
    jobs: sortJobs(jobs),
  });
}
