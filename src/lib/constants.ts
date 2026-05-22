import path from "node:path";

export const STORAGE_ROOT = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "storage",
);
export const UPLOAD_ROOT = path.join(STORAGE_ROOT, "uploads");
export const STATE_ROOT = path.join(STORAGE_ROOT, "state");
export const PREVIEW_ROOT = path.join(STORAGE_ROOT, "previews");
export const QDRANT_STORAGE_ROOT = path.join(STORAGE_ROOT, "qdrant");
export const EXPORT_ROOT = path.join(STORAGE_ROOT, "exports");
export const PACKET_ROOT = path.join(STORAGE_ROOT, "packets");
export const QDRANT_URL = process.env.QDRANT_URL || "http://127.0.0.1:6333";
export const QDRANT_COLLECTION = "eb1a_evidence_documents";

export const EB1A_CRITERIA_DEFINITIONS = [
  {
    code: "01",
    legalCode: "(i)",
    name: "Awards & Recognition",
    shortLabel: "Awards",
    citation: "8 CFR §204.5(h)(3)(i)",
    folderName: "01 — Awards & Recognition",
  },
  {
    code: "02",
    legalCode: "(ii)",
    name: "Memberships",
    shortLabel: "Members",
    citation: "8 CFR §204.5(h)(3)(ii)",
    folderName: "02 — Memberships",
  },
  {
    code: "03",
    legalCode: "(iii)",
    name: "Published Material",
    shortLabel: "Media",
    citation: "8 CFR §204.5(h)(3)(iii)",
    folderName: "03 — Published Material",
  },
  {
    code: "04",
    legalCode: "(iv)",
    name: "Judging",
    shortLabel: "Judging",
    citation: "8 CFR §204.5(h)(3)(iv)",
    folderName: "04 — Judging",
  },
  {
    code: "05",
    legalCode: "(v)",
    name: "Original Contributions",
    shortLabel: "OC",
    citation: "8 CFR §204.5(h)(3)(v)",
    folderName: "05 — Original Contributions",
  },
  {
    code: "06",
    legalCode: "(vi)",
    name: "Authorship",
    shortLabel: "Authorship",
    citation: "8 CFR §204.5(h)(3)(vi)",
    folderName: "06 — Authorship",
  },
  {
    code: "07",
    legalCode: "(vii)",
    name: "Exhibitions",
    shortLabel: "Exhibitions",
    citation: "8 CFR §204.5(h)(3)(vii)",
    folderName: "07 — Exhibitions",
  },
  {
    code: "08",
    legalCode: "(viii)",
    name: "Leading or Critical Role",
    shortLabel: "LR / CR",
    citation: "8 CFR §204.5(h)(3)(viii)",
    folderName: "08 — Leading Critical Role",
  },
  {
    code: "09",
    legalCode: "(ix)",
    name: "High Salary",
    shortLabel: "Salary",
    citation: "8 CFR §204.5(h)(3)(ix)",
    folderName: "09 — High Salary",
  },
  {
    code: "10",
    legalCode: "(x)",
    name: "Commercial Success",
    shortLabel: "Comm Success",
    citation: "8 CFR §204.5(h)(3)(x)",
    folderName: "10 — Commercial Success",
  },
  {
    code: "11",
    legalCode: "(xi)",
    name: "Comparable Evidence",
    shortLabel: "Comparable",
    citation: "8 CFR §204.5(h)(4)",
    folderName: "11 — Comparable Evidence",
  },
] as const;

export const EB1A_CRITERIA = EB1A_CRITERIA_DEFINITIONS.map(
  (criterion) => criterion.name,
);

export const EB1A_CRITERIA_CATALOG = EB1A_CRITERIA_DEFINITIONS.map(
  (criterion) => `${criterion.legalCode} ${criterion.name}`,
).join(", ");

const criterionIdentifierLookup = new Map<string, (typeof EB1A_CRITERIA_DEFINITIONS)[number]>();

function normalizeCriterionIdentifier(value: string) {
  return value.trim().toLowerCase();
}

for (const criterion of EB1A_CRITERIA_DEFINITIONS) {
  criterionIdentifierLookup.set(normalizeCriterionIdentifier(criterion.code), criterion);
  criterionIdentifierLookup.set(normalizeCriterionIdentifier(criterion.legalCode), criterion);
  criterionIdentifierLookup.set(normalizeCriterionIdentifier(criterion.name), criterion);
}

export function getCriterionDefinition(identifier: string | null | undefined) {
  if (!identifier) {
    return null;
  }

  return criterionIdentifierLookup.get(normalizeCriterionIdentifier(identifier)) ?? null;
}

export function getCriterionDisplayName(
  identifier: string | null | undefined,
  fallback?: string | null,
) {
  return getCriterionDefinition(identifier)?.name || fallback || identifier || "Unknown criterion";
}

export function getCriterionDisplayLabel(
  identifier: string | null | undefined,
  options?: {
    fallbackName?: string | null;
    includeLegalCode?: boolean;
  },
) {
  const definition = getCriterionDefinition(identifier);
  const name = definition?.name || options?.fallbackName || identifier || "Unknown criterion";

  if (options?.includeLegalCode && definition?.legalCode) {
    return `${name} ${definition.legalCode}`;
  }

  return name;
}

export const SPECIAL_REVIEW_BUCKET_DEFINITIONS = [
  {
    code: "ARCHIVE",
    name: "Archive Category",
    folderName: "_Archive",
    bucketKind: "archive",
  },
  {
    code: "UNWANTED",
    name: "Unwanted",
    folderName: "_Unwanted",
    bucketKind: "unwanted",
  },
  {
    code: "OTHER",
    name: "OTHER",
    folderName: "_Other",
    bucketKind: "other",
  },
  {
    code: "REVIEW",
    name: "Human Review",
    folderName: "_Unclassified",
    bucketKind: "human_review",
  },
] as const;

export const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".rtf",
  ".log",
  ".xml",
  ".html",
  ".eml",
]);

export const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

export const NATIVE_PREVIEW_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".eml",
  ".log",
  ".rtf",
  ...IMAGE_EXTENSIONS,
]);

export const QUICKLOOK_PREVIEW_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".key",
  ".pages",
  ".numbers",
]);
