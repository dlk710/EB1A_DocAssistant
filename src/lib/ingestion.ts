import {
  buildDocumentVector,
  mergeDocumentUsage,
  summarizeDocument,
} from "@/lib/ai";
import { startWorkspaceBundlingJob } from "@/lib/event-bundles";
import { prepareDocumentInput } from "@/lib/file-processing";
import {
  cancelJob,
  failJob,
  finalizeJob,
  incrementJobProgress,
  isJobCancellationRequested,
  markJobProcessing,
} from "@/lib/jobs";
import { getJobDocuments, upsertDocuments } from "@/lib/qdrant";
import { getRuntimeSettings } from "@/lib/settings";
import type { DocumentMetadata, StoredDocument } from "@/lib/types";

declare global {
  var __eb1aActiveJobs: Set<string> | undefined;
}

const activeJobs = globalThis.__eb1aActiveJobs ?? new Set<string>();
globalThis.__eb1aActiveJobs = activeJobs;

const zeroVectorCache: Record<number, number[]> = {};

function getZeroVector() {
  const dimensions = getRuntimeSettings().embeddingDimensions;

  if (!zeroVectorCache[dimensions]) {
    zeroVectorCache[dimensions] = Array.from({ length: dimensions }, () => 0);
  }

  return zeroVectorCache[dimensions];
}

async function processSingleDocument(document: StoredDocument) {
  const processingDocument: StoredDocument = {
    ...document,
    processingStatus: "processing",
    error: null,
    updatedAt: new Date().toISOString(),
  };
  await upsertDocuments([
    {
      document: processingDocument,
      vector: getZeroVector(),
    },
  ]);

  const preparedInput = await prepareDocumentInput(document);
  const summarized = await summarizeDocument(document, preparedInput);
  const embedded = await buildDocumentVector(document, summarized.summary, preparedInput);

  const metadata: DocumentMetadata = {
    extractionMethod: preparedInput.extractionMethod,
    sourceKind: preparedInput.sourceKind,
    preview: preparedInput.preview,
    previewMode: preparedInput.previewMode,
    pageCount: preparedInput.pageCount,
    charCount: preparedInput.charCount,
    rootFolder: document.folderLabel,
    indexedAt: new Date().toISOString(),
    relativePath: document.relativePath,
  };

  const completedDocument: StoredDocument = {
    ...document,
    pageCount: preparedInput.pageCount,
    extractedCharCount: preparedInput.charCount,
    sourceKind: preparedInput.sourceKind,
    processingStatus: "completed",
    summary: summarized.summary,
    metadata,
    usage: mergeDocumentUsage(summarized.usage, embedded.usage),
    error: null,
    updatedAt: new Date().toISOString(),
  };

  await upsertDocuments([
    {
      document: completedDocument,
      vector: embedded.vector,
    },
  ]);
}

async function markPendingDocumentsCanceled(jobId: string) {
  const documents = await getJobDocuments(jobId);
  const canceledAt = new Date().toISOString();
  const pendingDocuments = documents.filter(
    (document) =>
      document.processingStatus === "queued" || document.processingStatus === "processing",
  );

  if (!pendingDocuments.length) {
    return;
  }

  await upsertDocuments(
    pendingDocuments.map((document) => ({
      document: {
        ...document,
        sourceKind: "failed",
        processingStatus: "failed",
        error: "Canceled by user before processing could finish.",
        updatedAt: canceledAt,
      },
      vector: getZeroVector(),
    })),
  );
}

export function startIngestionJob(jobId: string) {
  if (activeJobs.has(jobId)) {
    return;
  }

  activeJobs.add(jobId);

  setTimeout(async () => {
    try {
      if (isJobCancellationRequested(jobId)) {
        await markPendingDocumentsCanceled(jobId);
        cancelJob(jobId, "Canceled by user before indexing began.");
        return;
      }

      markJobProcessing(jobId);
      const documents = getJobDocuments(jobId);
      const queuedDocuments = (await documents).filter(
        (document) => document.processingStatus === "queued",
      );

      for (const document of queuedDocuments) {
        if (isJobCancellationRequested(jobId)) {
          await markPendingDocumentsCanceled(jobId);
          cancelJob(jobId, "Canceled by user during document indexing.");
          return;
        }

        try {
          await processSingleDocument(document);
          incrementJobProgress(jobId, false);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown processing error";
          await upsertDocuments([
            {
              document: {
                ...document,
                sourceKind: "failed",
                processingStatus: "failed",
                error: message,
                updatedAt: new Date().toISOString(),
              },
              vector: getZeroVector(),
            },
          ]);
          incrementJobProgress(jobId, true);
        }

        if (isJobCancellationRequested(jobId)) {
          await markPendingDocumentsCanceled(jobId);
          cancelJob(jobId, "Canceled by user during document indexing.");
          return;
        }
      }

      if (isJobCancellationRequested(jobId)) {
        await markPendingDocumentsCanceled(jobId);
        cancelJob(jobId, "Canceled by user before event bundling started.");
        return;
      }

      finalizeJob(jobId);
      const refreshedDocuments = await getJobDocuments(jobId);
      startWorkspaceBundlingJob(jobId, refreshedDocuments);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown job error";
      failJob(jobId, message);
    } finally {
      activeJobs.delete(jobId);
    }
  }, 0);
}
