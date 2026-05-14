interface EvidencePathLike {
  fileName: string;
  relativePath: string;
}

const IGNORED_PATH_SEGMENTS = new Set(["__MACOSX"]);

export function isReviewableEvidenceFile(input: EvidencePathLike) {
  if (!input.fileName || input.fileName.startsWith(".")) {
    return false;
  }

  const pathSegments = input.relativePath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return !pathSegments.some(
    (segment) => segment.startsWith(".") || IGNORED_PATH_SEGMENTS.has(segment),
  );
}
