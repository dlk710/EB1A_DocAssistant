import {
  EB1A_CRITERIA_DEFINITIONS,
  SPECIAL_REVIEW_BUCKET_DEFINITIONS,
} from "@/lib/constants";
import type {
  Eb1aCriterionDecision,
  EventBundleKind,
  ReviewBucketKind,
  ReviewDisposition,
  StoredDocument,
} from "@/lib/types";

const criterionLookup = new Map<string, (typeof EB1A_CRITERIA_DEFINITIONS)[number]>(
  EB1A_CRITERIA_DEFINITIONS.map((criterion) => [criterion.code, criterion]),
);

const specialBucketLookup = new Map(
  SPECIAL_REVIEW_BUCKET_DEFINITIONS.map((bucket) => [bucket.bucketKind, bucket]),
);
const specialBucketCodeLookup = new Map<
  string,
  (typeof SPECIAL_REVIEW_BUCKET_DEFINITIONS)[number]
>(
  SPECIAL_REVIEW_BUCKET_DEFINITIONS.map((bucket) => [bucket.code, bucket]),
);

function sanitizeLabel(value: string, fallback: string) {
  const cleaned = value
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

function stripLeadingDate(value: string) {
  return value
    .replace(/^\d{4}[-_/]\d{2}(?:[-_/]\d{2})?\s*/, "")
    .replace(/^\d{4}\s+\d{2}\s*/, "")
    .trim();
}

function clampAtWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const trimmed = value.slice(0, maxLength + 1).trim();
  const boundary = trimmed.lastIndexOf(" ");

  if (boundary > Math.floor(maxLength * 0.6)) {
    return trimmed.slice(0, boundary).trim();
  }

  return trimmed.slice(0, maxLength).trim();
}

export function getFilenameReviewDisposition(fileName: string): Exclude<
  ReviewDisposition,
  "classified" | "unclassified"
> | null {
  const normalized = fileName.toLowerCase();

  if (normalized.includes("delete") || normalized.includes("remove")) {
    return "unwanted";
  }

  if (normalized.includes("archive")) {
    return "archive";
  }

  return null;
}

export function formatYearMonth(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getFullYear()}-${`${parsed.getMonth() + 1}`.padStart(2, "0")}`;
}

export function formatBundleDisplayName(rawName: string, latestRelevantDate: string | null) {
  const prefix = formatYearMonth(latestRelevantDate);
  const shortened = clampAtWordBoundary(
    stripLeadingDate(sanitizeLabel(rawName, "Untitled event")),
    56,
  );

  return prefix ? `${prefix} ${shortened}` : shortened;
}

export function formatSpecialBundleName(
  document: StoredDocument,
  disposition: Extract<ReviewDisposition, "archive" | "unwanted">,
) {
  const prefix = formatYearMonth(document.summary?.primaryDate ?? null);
  const label = disposition === "archive" ? "Archive" : "Unwanted";
  const sourceName = sanitizeLabel(
    document.summary?.title || document.fileName,
    `${label} document`,
  )
    .replace(/\barchive\b/gi, "")
    .replace(/\bdelete\b/gi, "")
    .replace(/\bremove\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const baseName = clampAtWordBoundary(sourceName || `${label} document`, 42);

  return prefix ? `${prefix} ${label} ${baseName}` : `${label} ${baseName}`;
}

export function formatSpecialExhibitTitle(
  document: StoredDocument,
  disposition: Extract<ReviewDisposition, "archive" | "unwanted">,
) {
  const label = disposition === "archive" ? "Archive" : "Unwanted";
  const sourceName = sanitizeLabel(
    document.summary?.title || document.fileName,
    `${label} document`,
  )
    .replace(/\barchive\b/gi, "")
    .replace(/\bdelete\b/gi, "")
    .replace(/\bremove\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return sourceName
    ? `${label} - ${clampAtWordBoundary(sourceName, 64)}`
    : `${label} document`;
}

export function getReviewBucketForDisposition(
  disposition: ReviewDisposition,
  primaryCriterionCode?: string | null,
) {
  if (disposition === "classified" && primaryCriterionCode) {
    const criterion = criterionLookup.get(primaryCriterionCode);

    if (criterion) {
      return {
        bucketCode: criterion.code,
        bucketName: criterion.name,
        folderName: criterion.folderName,
        bucketKind: "criterion" as ReviewBucketKind,
      };
    }
  }

  if (disposition === "archive") {
    const bucket = specialBucketLookup.get("archive");

    if (bucket) {
      return {
        bucketCode: bucket.code,
        bucketName: bucket.name,
        folderName: bucket.folderName,
        bucketKind: bucket.bucketKind,
      };
    }
  }

  if (disposition === "unwanted") {
    const bucket = specialBucketLookup.get("unwanted");

    if (bucket) {
      return {
        bucketCode: bucket.code,
        bucketName: bucket.name,
        folderName: bucket.folderName,
        bucketKind: bucket.bucketKind,
      };
    }
  }

  const bucket = specialBucketLookup.get("human_review");

  return {
    bucketCode: bucket?.code || "REVIEW",
    bucketName: bucket?.name || "Human Review",
    folderName: bucket?.folderName || "_Unclassified",
    bucketKind: bucket?.bucketKind || ("human_review" as ReviewBucketKind),
  };
}

export function getReviewBucketForCode(bucketCode: string) {
  const criterion = criterionLookup.get(bucketCode);

  if (criterion) {
    return {
      bucketCode: criterion.code,
      bucketName: criterion.name,
      folderName: criterion.folderName,
      bucketKind: "criterion" as ReviewBucketKind,
      reviewDisposition: "classified" as ReviewDisposition,
      primaryCriterionCode: criterion.code,
      primaryCriterionName: criterion.name,
    };
  }

  const specialBucket = specialBucketCodeLookup.get(bucketCode);

  if (specialBucket?.bucketKind === "archive") {
    return {
      bucketCode: specialBucket.code,
      bucketName: specialBucket.name,
      folderName: specialBucket.folderName,
      bucketKind: specialBucket.bucketKind,
      reviewDisposition: "archive" as ReviewDisposition,
      primaryCriterionCode: null,
      primaryCriterionName: null,
    };
  }

  if (specialBucket?.bucketKind === "unwanted") {
    return {
      bucketCode: specialBucket.code,
      bucketName: specialBucket.name,
      folderName: specialBucket.folderName,
      bucketKind: specialBucket.bucketKind,
      reviewDisposition: "unwanted" as ReviewDisposition,
      primaryCriterionCode: null,
      primaryCriterionName: null,
    };
  }

  if (specialBucket?.bucketKind === "other") {
    return {
      bucketCode: specialBucket.code,
      bucketName: specialBucket.name,
      folderName: specialBucket.folderName,
      bucketKind: specialBucket.bucketKind,
      reviewDisposition: "unclassified" as ReviewDisposition,
      primaryCriterionCode: null,
      primaryCriterionName: null,
    };
  }

  return {
    bucketCode: "REVIEW",
    bucketName: "Human Review",
    folderName: "_Unclassified",
    bucketKind: "human_review" as ReviewBucketKind,
    reviewDisposition: "unclassified" as ReviewDisposition,
    primaryCriterionCode: null,
    primaryCriterionName: null,
  };
}

export function getDecisionBucket(decision: Pick<
  Eb1aCriterionDecision,
  "reviewDisposition" | "primaryCriterionCode"
>) {
  return getReviewBucketForDisposition(
    decision.reviewDisposition,
    decision.primaryCriterionCode,
  );
}

export function bucketKindForBundleKind(bundleKind: EventBundleKind) {
  if (bundleKind === "archive") {
    return "archive";
  }

  if (bundleKind === "unwanted") {
    return "unwanted";
  }

  return "criterion";
}
