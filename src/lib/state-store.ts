import fs from "node:fs";
import path from "node:path";
import {
  EXPORT_ROOT,
  PACKET_ROOT,
  PREVIEW_ROOT,
  QDRANT_STORAGE_ROOT,
  STATE_ROOT,
  STORAGE_ROOT,
  UPLOAD_ROOT,
} from "@/lib/constants";

function ensureDirectory(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
}

export function ensureStorageRoots() {
  ensureDirectory(STORAGE_ROOT);
  ensureDirectory(UPLOAD_ROOT);
  ensureDirectory(STATE_ROOT);
  ensureDirectory(PREVIEW_ROOT);
  ensureDirectory(QDRANT_STORAGE_ROOT);
  ensureDirectory(EXPORT_ROOT);
  ensureDirectory(PACKET_ROOT);
}

function writeJsonAtomic(filePath: string, value: unknown) {
  ensureDirectory(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
  fs.renameSync(tempPath, filePath);
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return raw.trim() ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readStateFile<T>(fileName: string, fallback: T): T {
  ensureStorageRoots();
  const filePath = path.join(STATE_ROOT, fileName);
  return readJsonFile(filePath, fallback);
}

export function writeStateFile<T>(fileName: string, value: T) {
  ensureStorageRoots();
  writeJsonAtomic(path.join(STATE_ROOT, fileName), value);
}

export function ensureStateSubdirectory(...segments: string[]) {
  ensureStorageRoots();
  const directoryPath = path.join(STATE_ROOT, ...segments);
  ensureDirectory(directoryPath);
  return directoryPath;
}

export function ensureClientStorage(clientId: string) {
  return ensureStateSubdirectory("clients", clientId);
}

export function ensurePacketStorage(clientId: string) {
  ensureStorageRoots();
  const directoryPath = path.join(PACKET_ROOT, clientId);
  ensureDirectory(directoryPath);
  return directoryPath;
}

export function readAbsoluteStateFile<T>(filePath: string, fallback: T): T {
  ensureStorageRoots();
  return readJsonFile(filePath, fallback);
}

export function writeAbsoluteStateFile<T>(filePath: string, value: T) {
  ensureStorageRoots();
  writeJsonAtomic(filePath, value);
}
