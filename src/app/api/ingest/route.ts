import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime-types";
import { createClient, getClient } from "@/lib/clients";
import { startIngestionJob } from "@/lib/ingestion";
import { createJob } from "@/lib/jobs";
import { getRuntimeSettings } from "@/lib/settings";
import { ensureStorageRoots } from "@/lib/state-store";
import { appendClientTimelineEvent } from "@/lib/timeline";
import { ensureQdrantCollection, upsertDocuments } from "@/lib/qdrant";
import { UPLOAD_ROOT } from "@/lib/constants";
import type {
  DuplicateDocumentGroup,
  StoredDocument,
  SystemArchivedIntakeFile,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRelativePath(value: string) {
  const cleaned = value
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

  return cleaned || `file-${crypto.randomUUID()}`;
}

function inferFolderLabel(paths: string[]) {
  const firstPath = paths[0] ?? "";
  return firstPath.split("/")[0] || "Uploaded evidence";
}

function isMacSystemFile(relativePath: string) {
  return path.basename(relativePath) === ".DS_Store";
}

export async function POST(request: Request) {
  ensureStorageRoots();
  const formData = await request.formData();
  const files = formData.getAll("files").filter((value) => value instanceof File) as File[];
  const rawPaths = formData.getAll("paths").map((value) => String(value));
  const runtimeSettings = getRuntimeSettings();
  const candidateName =
    String(formData.get("candidateName") || "").trim() || runtimeSettings.candidateName;
  const requestedClientId = String(formData.get("clientId") || "").trim();

  if (!files.length) {
    return Response.json(
      {
        error: "Select a folder with at least one file.",
      },
      { status: 400 },
    );
  }

  if (!candidateName) {
    return Response.json(
      {
        error: "Add a candidate name before indexing evidence.",
      },
      { status: 400 },
    );
  }

  const normalizedPaths = files.map((file, index) =>
    normalizeRelativePath(rawPaths[index] || file.name),
  );
  const folderLabel =
    String(formData.get("folderLabel") || "").trim() || inferFolderLabel(normalizedPaths);
  const existingClient = requestedClientId ? getClient(requestedClientId) : null;
  const client =
    existingClient ??
    createClient({
      displayName: candidateName,
      petitionType: "EB-1A",
    });
  const effectiveCandidateName = existingClient?.displayName || candidateName;
  const jobId = crypto.randomUUID();
  const duplicateGroupsByChecksum = new Map<string, DuplicateDocumentGroup>();
  const uniqueUploads: Array<{
    file: File;
    relativePath: string;
    bytes: Buffer;
    checksum: string;
  }> = [];
  const systemArchiveUploads: Array<{
    file: File;
    relativePath: string;
    bytes: Buffer;
    checksum: string;
  }> = [];
  const firstUploadByChecksum = new Map<
    string,
    {
      relativePath: string;
    }
  >();

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const relativePath = normalizedPaths[index];
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(bytes).digest("hex");

    if (isMacSystemFile(relativePath)) {
      systemArchiveUploads.push({
        file,
        relativePath,
        bytes,
        checksum,
      });
      continue;
    }

    const firstUpload = firstUploadByChecksum.get(checksum);

    if (firstUpload) {
      const existingGroup = duplicateGroupsByChecksum.get(checksum);

      if (existingGroup) {
        existingGroup.duplicateRelativePaths.push(relativePath);
      } else {
        duplicateGroupsByChecksum.set(checksum, {
          checksum,
          keptRelativePath: firstUpload.relativePath,
          duplicateRelativePaths: [relativePath],
        });
      }

      continue;
    }

    firstUploadByChecksum.set(checksum, {
      relativePath,
    });
    uniqueUploads.push({
      file,
      relativePath,
      bytes,
      checksum,
    });
  }

  const duplicateGroups = Array.from(duplicateGroupsByChecksum.values()).sort((left, right) =>
    left.keptRelativePath.localeCompare(right.keptRelativePath),
  );
  const selectedIndexableFiles = files.length - systemArchiveUploads.length;
  const skippedDuplicateFiles = selectedIndexableFiles - uniqueUploads.length;
  const duplicateReport =
    skippedDuplicateFiles > 0
      ? {
          selectedFiles: selectedIndexableFiles,
          uniqueFiles: uniqueUploads.length,
          skippedDuplicateFiles,
          groups: duplicateGroups,
        }
      : null;
  const systemArchivedFiles: SystemArchivedIntakeFile[] = systemArchiveUploads.map((upload) => ({
    relativePath: upload.relativePath,
    reason: "Auto-archived macOS .DS_Store system file.",
  }));
  const systemArchiveReport =
    systemArchivedFiles.length > 0
      ? {
          autoArchivedFiles: systemArchivedFiles.length,
          files: systemArchivedFiles,
        }
      : null;

  createJob({
    id: jobId,
    clientId: client.id,
    candidateName: effectiveCandidateName,
    folderLabel,
    totalFiles: uniqueUploads.length,
    duplicateReport,
    systemArchiveReport,
  });
  appendClientTimelineEvent({
    id: `${jobId}:workspace-added:${Date.now()}`,
    clientId: client.id,
    occurredAt: new Date().toISOString(),
    kind: "workspace-added",
    workspaceId: jobId,
    summary: `Workspace '${folderLabel}' added.`,
    metadata: {
      workspaceId: jobId,
      folderLabel,
      selectedFileCount: files.length,
      fileCount: uniqueUploads.length,
      skippedDuplicateFiles,
      autoArchivedSystemFiles: systemArchivedFiles.length,
    },
  });

  const archivedSystemDocuments: StoredDocument[] = [];
  const queuedDocuments: StoredDocument[] = [];

  for (const upload of systemArchiveUploads) {
    const file = upload.file;
    const relativePath = upload.relativePath;
    const absolutePath = path.join(UPLOAD_ROOT, jobId, relativePath);
    const bytes = upload.bytes;
    const timestamp = new Date().toISOString();

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, bytes);

    archivedSystemDocuments.push({
      id: crypto.randomUUID(),
      jobId,
      candidateName: effectiveCandidateName,
      folderLabel,
      fileName: path.basename(relativePath),
      relativePath,
      absolutePath,
      extension: path.extname(relativePath).toLowerCase(),
      mimeType:
        file.type ||
        (typeof mime.lookup(relativePath) === "string"
          ? (mime.lookup(relativePath) as string)
          : "application/octet-stream"),
      bytes: bytes.byteLength,
      checksum: upload.checksum,
      pageCount: null,
      extractedCharCount: 0,
      sourceKind: "system_file",
      processingStatus: "completed",
      summary: null,
      metadata: {
        extractionMethod: "filename_only",
        sourceKind: "system_file",
        preview: "Auto-archived macOS .DS_Store system file.",
        previewMode: "filename_only",
        pageCount: null,
        charCount: 0,
        rootFolder: folderLabel,
        indexedAt: timestamp,
        relativePath,
      },
      usage: null,
      criteriaTags: [],
      reviewStatus: "archived",
      reviewStatusSource: "rule",
      reviewStatusReason: "Auto-archived macOS .DS_Store system file.",
      notes: "",
      isPinned: false,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const upload of uniqueUploads) {
    const file = upload.file;
    const relativePath = upload.relativePath;
    const absolutePath = path.join(UPLOAD_ROOT, jobId, relativePath);
    const bytes = upload.bytes;
    const timestamp = new Date().toISOString();

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, bytes);

    queuedDocuments.push({
      id: crypto.randomUUID(),
      jobId,
      candidateName: effectiveCandidateName,
      folderLabel,
      fileName: path.basename(relativePath),
      relativePath,
      absolutePath,
      extension: path.extname(relativePath).toLowerCase(),
      mimeType:
        file.type ||
        (typeof mime.lookup(relativePath) === "string"
          ? (mime.lookup(relativePath) as string)
          : "application/octet-stream"),
      bytes: bytes.byteLength,
      checksum: upload.checksum,
      pageCount: null,
      extractedCharCount: 0,
      sourceKind: "queued",
      processingStatus: "queued",
      summary: null,
      metadata: null,
      usage: null,
      criteriaTags: [],
      reviewStatus: "kept",
      reviewStatusSource: "ai",
      reviewStatusReason: null,
      notes: "",
      isPinned: false,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await ensureQdrantCollection(runtimeSettings.embeddingDimensions);
  const zeroVector = Array.from(
    { length: runtimeSettings.embeddingDimensions },
    () => 0,
  );
  await upsertDocuments(
    [...archivedSystemDocuments, ...queuedDocuments].map((document) => ({
      document,
      vector: zeroVector,
    })),
  );
  startIngestionJob(jobId);

  return Response.json({
    ok: true,
    jobId,
    candidateName: effectiveCandidateName,
    totalFiles: uniqueUploads.length,
    selectedFiles: files.length,
    uniqueFiles: uniqueUploads.length,
    skippedDuplicateFiles,
    autoArchivedSystemFiles: systemArchivedFiles.length,
    systemArchivedFiles,
    duplicateGroups,
    folderLabel,
  });
}
