import {
  SPECIAL_REVIEW_BUCKET_DEFINITIONS,
  getCriterionDefinition,
} from "@/lib/constants";
import { buildFolderContext, cleanFolderSegment, normalizeFolderSegment } from "@/lib/folder-context";
import type {
  ClientDocument,
  DocumentDispositionOverride,
  Eb1aCriterionDecision,
  ReviewDisposition,
  ReviewBucketKind,
  StoredDocument,
} from "@/lib/types";

const TOP_FOLDER_CRITERIA_RAW = {
  "authorship of scholarly articles - if any": "Authorship",
  "critical role": "Leading or Critical Role",
  "high salary": "High Salary",
  "impact awards": "Awards & Recognition",
  "judging - if any": "Judging",
  "major media - if any": "Published Material",
  "membership - if any": "Memberships",
  "original contributions of major significance": "Original Contributions",
  speaking: "Comparable Evidence",
  archive: "Archive",
} as const;

const SUBFOLDER_CRITERIA_RAW = {
  "for client review::cr letters": "Leading or Critical Role",
  "for client review::oc dependent letters": "Original Contributions",
  "for client review::independent letters": "Human Review",
} as const;

const NON_EVIDENCE_TOP_FOLDERS_RAW = [
  "educational docs",
  "extras",
  "forms",
  "licenses - certifications",
  "recommendation letters",
  "resume",
  "rueters research",
] as const;

const GENERIC_SEGMENTS_RAW = [
  "archive",
  "archives",
  "certifications",
  "copy of",
  "cr letters",
  "current",
  "document",
  "documents",
  "docs",
  "edit2",
  "edited",
  "email evidences",
  "emails & certs",
  "final",
  "forms",
  "independent letters",
  "media samples",
  "misc",
  "oc dependent letters",
  "signed",
] as const;

const CANDIDATE_TOKENS = new Set([
  "lohith",
  "deshpande",
  "kumar",
  "lohithdeshpande",
]);

const TOP_FOLDER_CRITERIA = Object.fromEntries(
  Object.entries(TOP_FOLDER_CRITERIA_RAW).map(([key, value]) => [normalizeFolderSegment(key), value]),
) as Record<string, string>;

const SUBFOLDER_CRITERIA = Object.fromEntries(
  Object.entries(SUBFOLDER_CRITERIA_RAW).map(([key, value]) => {
    const [top, sub] = key.split("::");
    return [`${normalizeFolderSegment(top)}::${normalizeFolderSegment(sub)}`, value];
  }),
) as Record<string, string>;

const NON_EVIDENCE_TOP_FOLDERS = new Set(
  NON_EVIDENCE_TOP_FOLDERS_RAW.map((value) => normalizeFolderSegment(value)),
);

const GENERIC_SEGMENTS = new Set(
  GENERIC_SEGMENTS_RAW.map((value) => normalizeFolderSegment(value)),
);

export interface DocumentRoutingSuggestion {
  eventName: string;
  bundleName: string;
  criteriaClassification: string;
  decisionBasis: string;
  confidence: number;
  needsHumanReview: boolean;
  topFolder: string;
  subfolderPath: string;
  reviewNotes: string;
}

interface ResolvedReviewBucket {
  bucketCode: string;
  bucketName: string;
  bucketKind: ReviewBucketKind;
  primaryCriterionCode: string | null;
  primaryCriterionName: string | null;
  reviewDisposition: ReviewDisposition;
  folderName: string;
}

const specialBucketByCode = new Map(
  SPECIAL_REVIEW_BUCKET_DEFINITIONS.map((bucket) => [bucket.code, bucket]),
);

const specialBucketByKind = new Map(
  SPECIAL_REVIEW_BUCKET_DEFINITIONS.map((bucket) => [bucket.bucketKind, bucket]),
);

function beautifyLabel(value: string) {
  const cleaned = cleanFolderSegment(value)
    .replace(/docx|pdf|pptx|xlsx|png|jpg|jpeg|eml/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return value.trim();
  }

  const titled = cleaned
    .split(" ")
    .map((token) => {
      if (token.toUpperCase() === token && token.length <= 6) {
        return token;
      }
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ");

  return titled
    .replace(/\bSpfi\b/g, "SPFI")
    .replace(/\bMde\b/g, "MDE")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bGds\b/g, "GDS")
    .replace(/\bIccsaiml\b/g, "ICCSAIML")
    .replace(/\bIcida\b/g, "ICIDA")
    .replace(/\bIip\b/g, "IIP")
    .replace(/\bIgi\b/g, "IGI")
    .replace(/\bIjraset\b/g, "IJRASET")
    .replace(/\bAbm\b/g, "ABM")
    .replace(/\bBdi\b/g, "BDI")
    .replace(/\bEh\b/g, "EH")
    .replace(/\bOc\b/g, "OC")
    .replace(/\bCr\b/g, "CR");
}

function cleanFileStem(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return cleanFolderSegment(withoutExtension)
    .replace(/\b(copy of|delete|fw|fwd|re)\b[: ]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeCandidateTokens(value: string) {
  const filtered = value
    .split(/\s+/)
    .filter((token) => token && !CANDIDATE_TOKENS.has(token.toLowerCase()));
  return filtered.join(" ").trim();
}

function relativeSegments(relativePath: string) {
  return relativePath
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => cleanFolderSegment(segment))
    .filter(Boolean);
}

function chooseEventName(document: ClientDocument) {
  const segments = relativeSegments(document.relativePath);
  const folderSegments = segments.slice(0, -1);
  const meaningfulFolders = folderSegments.filter((segment, index) => {
    if (index === 0) {
      return true;
    }

    return !GENERIC_SEGMENTS.has(normalizeFolderSegment(segment));
  });

  const leafMeaningfulFolder = meaningfulFolders[meaningfulFolders.length - 1];
  const summaryTitle = document.summary?.title ? beautifyLabel(document.summary.title) : "";
  const fileStem = beautifyLabel(removeCandidateTokens(cleanFileStem(document.fileName)));

  if (leafMeaningfulFolder && normalizeFolderSegment(leafMeaningfulFolder) !== normalizeFolderSegment(meaningfulFolders[0] ?? "")) {
    return beautifyLabel(removeCandidateTokens(leafMeaningfulFolder));
  }

  if (summaryTitle && !/^(document|letter|certificate|image|screenshot)$/i.test(summaryTitle)) {
    return summaryTitle;
  }

  if (fileStem) {
    return fileStem;
  }

  return beautifyLabel(leafMeaningfulFolder || document.fileName);
}

function keywordCriterion(combinedText: string) {
  const lower = combinedText.toLowerCase();
  const rules: Array<[string, RegExp, string]> = [
    ["Judging", /(judge|judging|peer review|peer reviewer|review a paper|reviewer for)/i, "content keywords point to judging"],
    ["Authorship", /(journal|coauthor|co authored|author|authorship|chapter|manuscript|conference paper|publication)/i, "content keywords point to authorship"],
    ["Original Contributions", /(original contribution|original contributions|innovative|innovation|impact report|call for abstracts|provider news|summit submission)/i, "content keywords point to original contributions"],
    ["Leading or Critical Role", /(critical role|leading role|product architect|principal architect|leadership|led the|recommendation letter|role)/i, "content keywords point to critical role"],
    ["High Salary", /(salary|compensation|w-2|offer letter|pay statement|earnings)/i, "content keywords point to high salary"],
    ["Awards & Recognition", /(award|winner|honor|recognition)/i, "content keywords point to awards"],
    ["Published Material", /(media|publication|press|featured|news article|media brief)/i, "content keywords point to published material"],
    ["Memberships", /(membership|member of|association|fellow)/i, "content keywords point to memberships"],
    ["Comparable Evidence", /(speaker|speaking|keynote|panel|webinar|round table|podcast)/i, "content keywords point to comparable evidence"],
  ];

  const matched = rules.find(([, pattern]) => pattern.test(lower));
  if (!matched) {
    return null;
  }

  return {
    criterion: matched[0],
    note: matched[2],
  };
}

function buildBundleName(topFolder: string, eventName: string, criterion: string) {
  if (criterion === "Archive") {
    return "Archive - System Files";
  }

  if (criterion === "Human Review") {
    const cleanedTopFolder = beautifyLabel(removeCandidateTokens(topFolder));
    if (/^(for client review|recommendation letters|\(root\))$/i.test(cleanedTopFolder)) {
      return `Human Review - ${eventName}`;
    }
    return `${cleanedTopFolder} - ${eventName}`;
  }

  return `${criterion} - ${eventName}`;
}

function documentDisplayTitle(document: Pick<StoredDocument, "fileName" | "summary">) {
  return beautifyLabel(document.summary?.title || cleanFileStem(document.fileName) || document.fileName);
}

export function getFilenameReviewDisposition(fileName: string): DocumentDispositionOverride | null {
  const normalized = normalizeFolderSegment(fileName);

  if (
    normalized === ".ds store" ||
    normalized === "thumbs.db" ||
    normalized.includes(" archive") ||
    normalized.startsWith("archive ") ||
    normalized === "archive"
  ) {
    return "archive";
  }

  if (
    normalized.includes("delete") ||
    normalized.includes("remove") ||
    normalized.startsWith("~$")
  ) {
    return "unwanted";
  }

  return null;
}

export function formatBundleDisplayName(name: string, latestRelevantDate: string | null) {
  const cleanedName = beautifyLabel(name).replace(/\s+/g, " ").trim() || "Untitled Event";
  return latestRelevantDate ? `${latestRelevantDate} ${cleanedName}` : cleanedName;
}

export function formatSpecialBundleName(
  document: Pick<StoredDocument, "fileName" | "summary">,
  disposition: DocumentDispositionOverride,
) {
  const prefix = disposition === "archive" ? "Archive" : "Unwanted";
  return `${prefix} - ${documentDisplayTitle(document)}`;
}

export function formatSpecialExhibitTitle(
  document: Pick<StoredDocument, "fileName" | "summary">,
  disposition: DocumentDispositionOverride,
) {
  return `${disposition === "archive" ? "Archive" : "Unwanted"} Exhibit - ${documentDisplayTitle(document)}`;
}

export function getReviewBucketForDisposition(
  reviewDisposition: ReviewDisposition,
  primaryCriterionCode: string | null = null,
): ResolvedReviewBucket {
  if (reviewDisposition === "classified" && primaryCriterionCode) {
    const criterion = getCriterionDefinition(primaryCriterionCode);
    if (criterion) {
      return {
        bucketCode: criterion.code,
        bucketName: criterion.name,
        bucketKind: "criterion",
        primaryCriterionCode: criterion.code,
        primaryCriterionName: criterion.name,
        reviewDisposition: "classified",
        folderName: criterion.folderName,
      };
    }
  }

  const fallbackCode =
    reviewDisposition === "archive"
      ? "ARCHIVE"
      : reviewDisposition === "unwanted"
        ? "UNWANTED"
        : "REVIEW";
  const bucket = specialBucketByCode.get(fallbackCode) ?? SPECIAL_REVIEW_BUCKET_DEFINITIONS[3];

  return {
    bucketCode: bucket.code,
    bucketName: bucket.name,
    bucketKind: bucket.bucketKind,
    primaryCriterionCode: null,
    primaryCriterionName: null,
    reviewDisposition:
      bucket.code === "ARCHIVE"
        ? "archive"
        : bucket.code === "UNWANTED"
          ? "unwanted"
          : "unclassified",
    folderName: bucket.folderName,
  };
}

export function getReviewBucketForCode(code: string): ResolvedReviewBucket {
  const criterion = getCriterionDefinition(code);
  if (criterion) {
    return {
      bucketCode: criterion.code,
      bucketName: criterion.name,
      bucketKind: "criterion",
      primaryCriterionCode: criterion.code,
      primaryCriterionName: criterion.name,
      reviewDisposition: "classified",
      folderName: criterion.folderName,
    };
  }

  const bucket =
    specialBucketByCode.get(code as (typeof SPECIAL_REVIEW_BUCKET_DEFINITIONS)[number]["code"]) ??
    specialBucketByKind.get("human_review")!;
  return {
    bucketCode: bucket.code,
    bucketName: bucket.name,
    bucketKind: bucket.bucketKind,
    primaryCriterionCode: null,
    primaryCriterionName: null,
    reviewDisposition:
      bucket.code === "ARCHIVE"
        ? "archive"
        : bucket.code === "UNWANTED"
          ? "unwanted"
          : "unclassified",
    folderName: bucket.folderName,
  };
}

export function getDecisionBucket(decision: Pick<Eb1aCriterionDecision, "bucketCode" | "reviewDisposition" | "primaryCriterionCode">) {
  if (decision.reviewDisposition === "classified" && decision.primaryCriterionCode) {
    return getReviewBucketForDisposition("classified", decision.primaryCriterionCode);
  }

  return getReviewBucketForCode(decision.bucketCode);
}

export function buildDocumentRoutingSuggestion(document: ClientDocument): DocumentRoutingSuggestion {
  const segments = relativeSegments(document.relativePath);
  const topFolder = segments.length > 1 ? segments[0] : "(root)";
  const subfolderPath = segments.length > 2 ? segments.slice(1, -1).join(" / ") : "";
  const subfolderLeaf = segments.length > 2 ? segments[segments.length - 2] : "";
  const normalizedTop = normalizeFolderSegment(topFolder);
  const normalizedSub = normalizeFolderSegment(subfolderLeaf);
  const summaryText = [
    document.summary?.title,
    document.summary?.shortSummary,
    document.summary?.detailedSummary,
    document.summary?.recommendedUse,
    document.fileName,
    document.relativePath,
    buildFolderContext(document.relativePath, document.folderLabel).folderHints.join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  if (document.fileName === ".DS_Store") {
    return {
      eventName: "System File",
      bundleName: "Archive - System Files",
      criteriaClassification: "Archive",
      decisionBasis: "system-file",
      confidence: 100,
      needsHumanReview: false,
      topFolder,
      subfolderPath,
      reviewNotes: "Exact macOS metadata file; exclude from review and indexing.",
    };
  }

  const subfolderRule = SUBFOLDER_CRITERIA[`${normalizedTop}::${normalizedSub}`];
  if (subfolderRule) {
    const eventName = chooseEventName(document);
    return {
      eventName,
      bundleName: buildBundleName(topFolder, eventName, subfolderRule),
      criteriaClassification: subfolderRule,
      decisionBasis: "subfolder",
      confidence: subfolderRule === "Human Review" ? 50 : 90,
      needsHumanReview: subfolderRule === "Human Review",
      topFolder,
      subfolderPath,
      reviewNotes: "Subfolder label provided the clearest routing signal.",
    };
  }

  const topFolderRule = TOP_FOLDER_CRITERIA[normalizedTop];
  if (topFolderRule) {
    const eventName = chooseEventName(document);
    return {
      eventName,
      bundleName: buildBundleName(topFolder, eventName, topFolderRule),
      criteriaClassification: topFolderRule,
      decisionBasis: "folder",
      confidence: topFolderRule === "Comparable Evidence" ? 75 : topFolderRule === "Archive" ? 100 : 92,
      needsHumanReview: false,
      topFolder,
      subfolderPath,
      reviewNotes: "Top-level folder strongly maps to an EB1A criterion.",
    };
  }

  const keywordMatch = keywordCriterion(summaryText);
  if (NON_EVIDENCE_TOP_FOLDERS.has(normalizedTop)) {
    if (keywordMatch && !["Comparable Evidence", "Leading or Critical Role"].includes(keywordMatch.criterion)) {
      const eventName = chooseEventName(document);
      return {
        eventName,
        bundleName: buildBundleName(topFolder, eventName, keywordMatch.criterion),
        criteriaClassification: keywordMatch.criterion,
        decisionBasis: "parsed-content",
        confidence: 68,
        needsHumanReview: false,
        topFolder,
        subfolderPath,
        reviewNotes: "Used document summary and preserved folder hints because the path itself was ambiguous.",
      };
    }

    const eventName = chooseEventName(document);
    return {
      eventName,
      bundleName: buildBundleName(topFolder, eventName, "Human Review"),
      criteriaClassification: "Human Review",
      decisionBasis: "folder-ambiguous",
      confidence: 45,
      needsHumanReview: true,
      topFolder,
      subfolderPath,
      reviewNotes: "Path and extracted document summary did not support a confident criterion assignment.",
    };
  }

  if (keywordMatch) {
    const eventName = chooseEventName(document);
    return {
      eventName,
      bundleName: buildBundleName(topFolder, eventName, keywordMatch.criterion),
      criteriaClassification: keywordMatch.criterion,
      decisionBasis: "parsed-content",
      confidence: 72,
      needsHumanReview: false,
      topFolder,
      subfolderPath,
      reviewNotes: "Used document summary and preserved folder hints because the folder rule was not definitive.",
    };
  }

  const eventName = chooseEventName(document);
  return {
    eventName,
    bundleName: buildBundleName(topFolder, eventName, "Human Review"),
    criteriaClassification: "Human Review",
    decisionBasis: "human-review",
    confidence: 35,
    needsHumanReview: true,
    topFolder,
    subfolderPath,
    reviewNotes: "Path and extracted document summary did not support a confident criterion assignment.",
  };
}
