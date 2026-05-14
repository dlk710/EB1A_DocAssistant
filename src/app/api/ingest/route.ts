import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime-types";
import { startIngestionJob } from "@/lib/ingestion";
import { createJob } from "@/lib/jobs";
import { getRuntimeSettings } from "@/lib/settings";
import { ensureStorageRoots } from "@/lib/state-store";
import { ensureQdrantCollection, upsertDocuments } from "@/lib/qdrant";
import { UPLOAD_ROOT } from "@/lib/constants";
import type { StoredDocument } from "@/lib/types";

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

export async function POST(request: Request) {
  ensureStorageRoots();
  const formData = await request.formData();
  const files = formData.getAll("files").filter((value) => value instanceof File) as File[];
  const rawPaths = formData.getAll("paths").map((value) => String(value));
  const runtimeSettings = getRuntimeSettings();
  const candidateName =
    String(formData.get("candidateName") || "").trim() || runtimeSettings.candidateName;

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
  const jobId = crypto.randomUUID();

  createJob({
    id: jobId,
    candidateName,
    folderLabel,
    totalFiles: files.length,
  });

  const queuedDocuments: StoredDocument[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const relativePath = normalizedPaths[index];
    const absolutePath = path.join(UPLOAD_ROOT, jobId, relativePath);
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
    const timestamp = new Date().toISOString();

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, bytes);

    queuedDocuments.push({
      id: crypto.randomUUID(),
      jobId,
      candidateName,
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
      checksum,
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
    queuedDocuments.map((document) => ({
      document,
      vector: zeroVector,
    })),
  );
  startIngestionJob(jobId);

  return Response.json({
    ok: true,
    jobId,
    candidateName,
    totalFiles: files.length,
    folderLabel,
  });
}
