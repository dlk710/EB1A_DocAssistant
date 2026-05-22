import path from "node:path";
import {
  QDRANT_COLLECTION,
  QDRANT_STORAGE_ROOT,
  QDRANT_URL,
} from "@/lib/constants";
import { compareIsoDatesDescending } from "@/lib/date";
import { ensureStorageRoots } from "@/lib/state-store";
import type {
  CriterionTagOrigin,
  CriterionTagState,
  DocumentDisposition,
  DocumentMetadata,
  DocumentSummaryPayload,
  DocumentUsage,
  EvidenceCriterionTag,
  EvidenceReviewStatus,
  LibraryOverview,
  StoredDocument,
} from "@/lib/types";

interface QdrantEnvelope<T> {
  result: T;
  status: string;
  time: number;
}

interface QdrantPoint {
  id: string | number;
  payload?: Record<string, unknown>;
  score?: number;
}

interface ScrollResult {
  points: QdrantPoint[];
  next_page_offset: string | number | null;
}

interface QueryResult {
  points: QdrantPoint[];
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function pointIdToString(id: string | number) {
  return typeof id === "number" ? String(id) : id;
}

function parseSummary(value: unknown) {
  return (value ?? null) as DocumentSummaryPayload | null;
}

function parseMetadata(value: unknown) {
  return (value ?? null) as DocumentMetadata | null;
}

function parseUsage(value: unknown) {
  return (value ?? null) as DocumentUsage | null;
}

function parseCriteriaTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<EvidenceCriterionTag[]>((accumulator, entry) => {
    if (!entry || typeof entry !== "object") {
      return accumulator;
    }

    const record = entry as Record<string, unknown>;
    const code = String(record.code ?? "");
    const name = String(record.name ?? "");

    if (!code || !name) {
      return accumulator;
    }

    accumulator.push({
      id: typeof record.id === "string" ? record.id : undefined,
      documentId:
        typeof record.documentId === "string" ? record.documentId : undefined,
      workspaceId:
        typeof record.workspaceId === "string" ? record.workspaceId : undefined,
      code,
      criterionCode:
        typeof record.criterionCode === "string" ? record.criterionCode : undefined,
      legalCode: String(record.legalCode ?? ""),
      name,
      role: record.role === "supporting" ? "supporting" : "primary",
      source: record.source === "manual" ? "manual" : "ai",
      origin:
        record.origin === "attorney"
          ? ("attorney" satisfies CriterionTagOrigin)
          : record.origin === "ai"
            ? ("ai" satisfies CriterionTagOrigin)
            : undefined,
      state:
        record.state === "enabled" || record.state === "disabled" || record.state === "suggested"
          ? (record.state satisfies CriterionTagState)
          : undefined,
      confidence:
        typeof record.confidence === "number"
          ? Math.max(0, Math.min(1, record.confidence))
          : 0,
      aiConfidence:
        record.aiConfidence === null
          ? null
          : typeof record.aiConfidence === "number"
            ? Math.max(0, Math.min(1, record.aiConfidence))
            : undefined,
      reasoning: String(record.reasoning ?? ""),
      taggedAt: String(record.taggedAt ?? new Date(0).toISOString()),
      createdAt:
        typeof record.createdAt === "string" ? record.createdAt : undefined,
      updatedAt:
        typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    });

    return accumulator;
  }, []);
}

function parseReviewStatus(value: unknown): EvidenceReviewStatus {
  if (value === "pending" || value === "reference" || value === "archived") {
    return value;
  }

  return "kept";
}

function parseDisposition(value: unknown): DocumentDisposition | undefined {
  if (
    value === "untouched" ||
    value === "tagged" ||
    value === "reference" ||
    value === "archived"
  ) {
    return value;
  }

  return undefined;
}

function payloadToDocument(payload: Record<string, unknown>, pointId: string | number): StoredDocument {
  return {
    id: String(payload.id ?? pointIdToString(pointId)),
    jobId: String(payload.jobId ?? ""),
    candidateName: String(payload.candidateName ?? ""),
    folderLabel: String(payload.folderLabel ?? ""),
    fileName: String(payload.fileName ?? ""),
    relativePath: String(payload.relativePath ?? ""),
    absolutePath: String(payload.absolutePath ?? ""),
    extension: String(payload.extension ?? ""),
    mimeType: String(payload.mimeType ?? "application/octet-stream"),
    bytes: Number(payload.bytes ?? 0),
    checksum: String(payload.checksum ?? ""),
    pageCount:
      payload.pageCount === null || payload.pageCount === undefined
        ? null
        : Number(payload.pageCount),
    extractedCharCount: Number(payload.extractedCharCount ?? 0),
    sourceKind: String(payload.sourceKind ?? "queued"),
    processingStatus: String(payload.processingStatus ?? "queued") as StoredDocument["processingStatus"],
    summary: parseSummary(payload.summary),
    metadata: parseMetadata(payload.metadata),
    usage: parseUsage(payload.usage),
    criteriaTags: parseCriteriaTags(payload.criteriaTags),
    disposition: parseDisposition(payload.disposition),
    reviewStatus: parseReviewStatus(payload.reviewStatus),
    reviewStatusSource:
      payload.reviewStatusSource === "manual"
        ? "manual"
        : payload.reviewStatusSource === "rule"
          ? "rule"
          : "ai",
    reviewStatusReason:
      payload.reviewStatusReason === null || payload.reviewStatusReason === undefined
        ? null
        : String(payload.reviewStatusReason),
    notes: String(payload.notes ?? ""),
    isPinned: Boolean(payload.isPinned),
    error: payload.error === null || payload.error === undefined ? null : String(payload.error),
    createdAt: String(payload.createdAt ?? ""),
    updatedAt: String(payload.updatedAt ?? ""),
  };
}

function documentToPayload(document: StoredDocument) {
  return {
    id: document.id,
    jobId: document.jobId,
    candidateName: document.candidateName,
    folderLabel: document.folderLabel,
    fileName: document.fileName,
    relativePath: document.relativePath,
    absolutePath: document.absolutePath,
    extension: document.extension,
    mimeType: document.mimeType,
    bytes: document.bytes,
    checksum: document.checksum,
    pageCount: document.pageCount,
    extractedCharCount: document.extractedCharCount,
    sourceKind: document.sourceKind,
    processingStatus: document.processingStatus,
    summary: document.summary,
    metadata: document.metadata,
    usage: document.usage,
    criteriaTags: document.criteriaTags,
    disposition: document.disposition,
    reviewStatus: document.reviewStatus,
    reviewStatusSource: document.reviewStatusSource,
    reviewStatusReason: document.reviewStatusReason,
    notes: document.notes,
    isPinned: document.isPinned,
    error: document.error,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

async function qdrantFetch<T>(requestPath: string, init?: RequestInit) {
  ensureStorageRoots();
  const response = await fetch(`${QDRANT_URL}${requestPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Qdrant request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as QdrantEnvelope<T>;
  return payload.result;
}

let ensuredDimensions: number | null = null;

export async function ensureQdrantCollection(dimensions: number) {
  if (ensuredDimensions === dimensions) {
    return;
  }

  ensureStorageRoots();
  const response = await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    await qdrantFetch<boolean>(`/collections/${QDRANT_COLLECTION}`, {
      method: "PUT",
      body: JSON.stringify({
        vectors: {
          size: dimensions,
          distance: "Cosine",
        },
        on_disk_payload: true,
      }),
    });
    ensuredDimensions = dimensions;
    return;
  }

  if (!response.ok) {
    throw new Error(`Unable to reach local Qdrant at ${QDRANT_URL}.`);
  }

  const payload = (await response.json()) as QdrantEnvelope<{
    config?: { params?: { vectors?: { size?: number } } };
  }>;
  const existingSize = payload.result?.config?.params?.vectors?.size;

  if (existingSize && existingSize !== dimensions) {
    throw new Error(
      `Qdrant collection ${QDRANT_COLLECTION} expects ${existingSize} dimensions, but settings request ${dimensions}.`,
    );
  }

  ensuredDimensions = dimensions;
}

function sortDocuments(documents: StoredDocument[]) {
  return [...documents].sort((left, right) => {
    const dateComparison = compareIsoDatesDescending(
      left.summary?.primaryDate ?? null,
      right.summary?.primaryDate ?? null,
    );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

async function scrollDocuments(input?: {
  filter?: Record<string, unknown>;
  limit?: number;
}) {
  const documents: StoredDocument[] = [];
  let offset: string | number | null = null;
  const targetLimit = input?.limit ?? 1000;

  do {
    const scrollResult: ScrollResult = await qdrantFetch<ScrollResult>(
      `/collections/${QDRANT_COLLECTION}/points/scroll`,
      {
        method: "POST",
        body: JSON.stringify({
          limit: Math.min(128, targetLimit - documents.length),
          offset: offset ?? undefined,
          filter: input?.filter,
          with_payload: true,
          with_vector: false,
        }),
      },
    );

    documents.push(
      ...scrollResult.points.map((point) =>
        payloadToDocument(point.payload ?? {}, point.id),
      ),
    );
    offset = scrollResult.next_page_offset;
  } while (offset !== null && documents.length < targetLimit);

  return documents;
}

function buildJobFilter(jobId: string, extraMust: Record<string, unknown>[] = []) {
  return {
    must: [
      {
        key: "jobId",
        match: {
          value: jobId,
        },
      },
      ...extraMust,
    ],
  };
}

function buildJobIdsFilter(jobIds: string[], extraMust: Record<string, unknown>[] = []) {
  return {
    must: [
      {
        key: "jobId",
        match: {
          any: jobIds,
        },
      },
      ...extraMust,
    ],
  };
}

export async function upsertDocuments(
  documents: Array<{
    document: StoredDocument;
    vector: number[];
  }>,
) {
  if (!documents.length) {
    return;
  }

  await qdrantFetch<{ operation_id: number; status: string }>(
    `/collections/${QDRANT_COLLECTION}/points?wait=true`,
    {
      method: "PUT",
      body: JSON.stringify({
        points: documents.map(({ document, vector }) => ({
          id: document.id,
          vector,
          payload: documentToPayload(document),
        })),
      }),
    },
  );
}

export async function getDocument(documentId: string) {
  const result = await qdrantFetch<QdrantPoint[]>(`/collections/${QDRANT_COLLECTION}/points`, {
    method: "POST",
    body: JSON.stringify({
      ids: [documentId],
      with_payload: true,
      with_vector: false,
    }),
  });

  const point = result[0];
  return point ? payloadToDocument(point.payload ?? {}, point.id) : null;
}

export async function setDocumentPayload(
  documentId: string,
  payload: Record<string, unknown>,
) {
  await qdrantFetch<{ operation_id: number; status: string }>(
    `/collections/${QDRANT_COLLECTION}/points/payload?wait=true`,
    {
      method: "POST",
      body: JSON.stringify({
        payload,
        points: [documentId],
      }),
    },
  );
}

export async function setDocumentsPayload(
  documentIds: string[],
  payload: Record<string, unknown>,
) {
  if (!documentIds.length) {
    return;
  }

  await qdrantFetch<{ operation_id: number; status: string }>(
    `/collections/${QDRANT_COLLECTION}/points/payload?wait=true`,
    {
      method: "POST",
      body: JSON.stringify({
        payload,
        points: documentIds,
      }),
    },
  );
}

export async function listDocuments(limit = 600, jobId?: string | null) {
  return sortDocuments(
    await scrollDocuments({
      limit,
      filter: jobId ? buildJobFilter(jobId) : undefined,
    }),
  );
}

export async function getJobDocuments(jobId: string) {
  return sortDocuments(
    await scrollDocuments({
      filter: buildJobFilter(jobId),
      limit: 1000,
    }),
  );
}

export async function getDocumentsForJobs(jobIds: string[]) {
  if (!jobIds.length) {
    return [];
  }

  return sortDocuments(
    await scrollDocuments({
      filter: buildJobIdsFilter(jobIds),
      limit: 5000,
    }),
  );
}

export async function searchDocuments(
  queryVector: number[],
  limit = 20,
  jobId?: string | null,
) {
  const result = await qdrantFetch<QueryResult>(
    `/collections/${QDRANT_COLLECTION}/points/query`,
    {
      method: "POST",
      body: JSON.stringify({
        query: queryVector,
        limit,
        with_payload: true,
        with_vector: false,
        filter: jobId
          ? buildJobFilter(jobId, [
              {
                key: "processingStatus",
                match: {
                  value: "completed",
                },
              },
            ])
          : {
              must: [
                {
                  key: "processingStatus",
                  match: {
                    value: "completed",
                  },
                },
              ],
            },
      }),
    },
  );

  return result.points.map((point) => ({
    document: payloadToDocument(point.payload ?? {}, point.id),
    score: point.score ?? 0,
  }));
}

export async function searchDocumentsAcrossWorkspaces(
  queryVector: number[],
  limit: number,
  jobIds: string[],
) {
  if (!jobIds.length) {
    return [];
  }

  const result = await qdrantFetch<QueryResult>(
    `/collections/${QDRANT_COLLECTION}/points/query`,
    {
      method: "POST",
      body: JSON.stringify({
        query: queryVector,
        limit,
        with_payload: true,
        with_vector: false,
        filter: buildJobIdsFilter(jobIds, [
          {
            key: "processingStatus",
            match: {
              value: "completed",
            },
          },
        ]),
      }),
    },
  );

  return result.points.map((point) => ({
    document: payloadToDocument(point.payload ?? {}, point.id),
    score: point.score ?? 0,
  }));
}

export async function clearQdrantCollection(dimensions: number) {
  await fetch(`${QDRANT_URL}/collections/${QDRANT_COLLECTION}`, {
    method: "DELETE",
  });
  ensuredDimensions = null;
  await ensureQdrantCollection(dimensions);
}

export async function deleteJobDocuments(jobId: string) {
  await qdrantFetch<{ operation_id: number; status: string }>(
    `/collections/${QDRANT_COLLECTION}/points/delete?wait=true`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: buildJobFilter(jobId),
      }),
    },
  );
}

export async function getOverview(jobId?: string | null): Promise<LibraryOverview> {
  const documents = await listDocuments(1000, jobId);
  const totalOpenAiCostUsd = roundUsd(
    documents.reduce((sum, document) => sum + (document.usage?.totalCostUsd ?? 0), 0),
  );

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

export function debugQdrantStoragePath() {
  return path.resolve(QDRANT_STORAGE_ROOT);
}
