import type { FolderSignalPolicy } from "@/lib/types";

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
  folderEvidenceStrength: "strong" | "weak";
}

export const FOLDER_SIGNAL_POLICIES: FolderSignalPolicy[] = [
  "prefer_folder",
  "balanced",
];

export const DEFAULT_FOLDER_SIGNAL_POLICY: FolderSignalPolicy = "prefer_folder";

export function getFolderSignalPolicyLabel(policy: FolderSignalPolicy) {
  switch (policy) {
    case "prefer_folder":
      return "Prefer folder structure first";
    case "balanced":
    default:
      return "Balance folder and content";
  }
}

export function getFolderSignalPolicyDescription(policy: FolderSignalPolicy) {
  switch (policy) {
    case "prefer_folder":
      return "Treat the uploaded root folder, nested folders, and filename as the first routing signal. Fall back to document content only when folder evidence is weak, generic, conflicting, or absent.";
    case "balanced":
    default:
      return "Use folder names as helpful hints, but let the document content and bundle evidence carry equal weight when the signals differ.";
  }
}

export function getFolderSignalPolicyInstruction(policy: FolderSignalPolicy) {
  switch (policy) {
    case "prefer_folder":
      return "Routing policy: Prefer folder structure first. Treat the original root folder, nested folders, and filename as the first routing signal. Preserve those labels when they identify a real dossier, project, event, or work stream. Fall back to document content only when folder evidence is weak, generic, conflicting, or absent.";
    case "balanced":
    default:
      return "Routing policy: Balance folder structure with document content. Use the original root folder, nested folders, and filename as organizational hints, but let the document content resolve ambiguity when the signals differ.";
  }
}

export function isFolderSignalPolicy(value: string): value is FolderSignalPolicy {
  return value === "balanced" || value === "prefer_folder";
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
  const folderEvidenceStrength = folderHints.length > 0 ? "strong" : "weak";

  return {
    rootFolder: cleanedRoot || null,
    folderPath: meaningfulSegments.length ? meaningfulSegments.join(" / ") : null,
    folderSegments: meaningfulSegments,
    leafFolder: meaningfulSegments[meaningfulSegments.length - 1] ?? rootHint[0] ?? null,
    folderHints,
    folderEvidenceStrength,
  };
}

export function buildFolderContextText(relativePath: string, rootFolder?: string | null) {
  const context = buildFolderContext(relativePath, rootFolder);

  return [
    `Original root folder: ${context.rootFolder || "Not specified"}`,
    `Nested folders: ${context.folderPath || "None"}`,
    `Folder evidence strength: ${context.folderEvidenceStrength}`,
    context.folderHints.length
      ? `Preserved folder hints: ${context.folderHints.join(" | ")}`
      : "Preserved folder hints: None",
  ].join("\n");
}
