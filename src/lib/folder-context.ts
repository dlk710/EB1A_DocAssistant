const GENERIC_FOLDER_SEGMENTS = new Set([
  "__macosx",
  "archive",
  "archives",
  "document",
  "documents",
  "docs",
  "downloads",
  "evidence",
  "file",
  "files",
  "folder",
  "folders",
  "image",
  "images",
  "misc",
  "miscellaneous",
  "new folder",
  "photo",
  "photos",
  "raw",
  "scan",
  "scans",
  "screenshot",
  "screenshots",
  "upload",
  "uploads",
  "untitled folder",
]);

function pathSegments(relativePath: string) {
  return relativePath
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function cleanFolderSegment(segment: string) {
  return segment.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeFolderSegment(segment: string) {
  return cleanFolderSegment(segment).toLowerCase();
}

function uniqueByNormalized(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeFolderSegment(value);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(cleanFolderSegment(value));
  });

  return result;
}

function isMeaningfulFolderSegment(segment: string) {
  const normalized = normalizeFolderSegment(segment);

  if (!normalized || normalized.length < 2) {
    return false;
  }

  if (GENERIC_FOLDER_SEGMENTS.has(normalized)) {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return false;
  }

  return true;
}

export interface FolderContext {
  rootFolder: string | null;
  folderPath: string | null;
  folderSegments: string[];
  leafFolder: string | null;
  folderHints: string[];
}

export function buildFolderContext(relativePath: string, rootFolder?: string | null): FolderContext {
  const segments = pathSegments(relativePath);
  const filelessSegments = segments.slice(0, -1).map(cleanFolderSegment).filter(Boolean);
  const cleanedRoot = cleanFolderSegment(rootFolder || filelessSegments[0] || "");
  const withoutRoot =
    cleanedRoot && normalizeFolderSegment(filelessSegments[0] || "") === normalizeFolderSegment(cleanedRoot)
      ? filelessSegments.slice(1)
      : filelessSegments;
  const meaningfulSegments = uniqueByNormalized(withoutRoot.filter(isMeaningfulFolderSegment));
  const rootHint = cleanedRoot && isMeaningfulFolderSegment(cleanedRoot) ? [cleanedRoot] : [];
  const folderHints = uniqueByNormalized([...rootHint, ...meaningfulSegments]).slice(0, 6);

  return {
    rootFolder: cleanedRoot || null,
    folderPath: meaningfulSegments.length ? meaningfulSegments.join(" / ") : null,
    folderSegments: meaningfulSegments,
    leafFolder: meaningfulSegments[meaningfulSegments.length - 1] ?? rootHint[0] ?? null,
    folderHints,
  };
}

export function buildFolderContextText(relativePath: string, rootFolder?: string | null) {
  const context = buildFolderContext(relativePath, rootFolder);

  return [
    `Original root folder: ${context.rootFolder || "Not specified"}`,
    `Nested folders: ${context.folderPath || "None"}`,
    context.folderHints.length
      ? `Preserved folder hints: ${context.folderHints.join(" | ")}`
      : "Preserved folder hints: None",
  ].join("\n");
}
