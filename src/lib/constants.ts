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
    folderName: "01 — Awards & Recognition",
  },
  {
    code: "02",
    legalCode: "(ii)",
    name: "Memberships",
    folderName: "02 — Memberships",
  },
  {
    code: "03",
    legalCode: "(iii)",
    name: "Published Material",
    folderName: "03 — Published Material",
  },
  {
    code: "04",
    legalCode: "(iv)",
    name: "Judging",
    folderName: "04 — Judging",
  },
  {
    code: "05",
    legalCode: "(v)",
    name: "Original Contributions",
    folderName: "05 — Original Contributions",
  },
  {
    code: "06",
    legalCode: "(vi)",
    name: "Authorship",
    folderName: "06 — Authorship",
  },
  {
    code: "07",
    legalCode: "(vii)",
    name: "Exhibitions",
    folderName: "07 — Exhibitions",
  },
  {
    code: "08",
    legalCode: "(viii)",
    name: "Leading or Critical Role",
    folderName: "08 — Leading Critical Role",
  },
  {
    code: "09",
    legalCode: "(ix)",
    name: "High Salary",
    folderName: "09 — High Salary",
  },
  {
    code: "10",
    legalCode: "(x)",
    name: "Commercial Success",
    folderName: "10 — Commercial Success",
  },
  {
    code: "11",
    legalCode: "(xi)",
    name: "Comparable Evidence",
    folderName: "11 — Comparable Evidence",
  },
] as const;

export const EB1A_CRITERIA = EB1A_CRITERIA_DEFINITIONS.map(
  (criterion) => criterion.name,
);

export const EB1A_CRITERIA_CATALOG = EB1A_CRITERIA_DEFINITIONS.map(
  (criterion) => `${criterion.legalCode} ${criterion.name}`,
).join(", ");

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
