import {
  getCriterionDefinition,
  getCriterionDisplayLabel,
} from "@/lib/constants";
import type {
  ClientDocument,
  CriterionTagOrigin,
  CriterionTagRole,
  CriterionTagState,
  DocumentDisposition,
  EvidenceCriterionTag,
  EvidenceReviewStatus,
  StoredDocument,
} from "@/lib/types";

type DocumentWithTags = Pick<
  StoredDocument,
  "id" | "jobId" | "updatedAt" | "reviewStatus" | "criteriaTags" | "disposition"
>;

const TAG_STATE_PRIORITY: Record<CriterionTagState, number> = {
  enabled: 3,
  suggested: 2,
  disabled: 1,
};

const TAG_ROLE_PRIORITY: Record<CriterionTagRole, number> = {
  primary: 2,
  supporting: 1,
};

function clampConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeTagState(
  entry: Partial<EvidenceCriterionTag>,
  fallbackReviewStatus: EvidenceReviewStatus,
): CriterionTagState {
  if (entry.state === "suggested" || entry.state === "enabled" || entry.state === "disabled") {
    return entry.state;
  }

  if (fallbackReviewStatus === "kept") {
    return "enabled";
  }

  return "suggested";
}

function normalizeTagOrigin(entry: Partial<EvidenceCriterionTag>): CriterionTagOrigin {
  if (entry.origin === "attorney") {
    return "attorney";
  }

  if (entry.source === "manual") {
    return "attorney";
  }

  return "ai";
}

function normalizeTagRole(entry: Partial<EvidenceCriterionTag>): CriterionTagRole {
  return entry.role === "supporting" ? "supporting" : "primary";
}

function normalizeCriterionCode(value: string | null | undefined) {
  const definition = getCriterionDefinition(value);
  return definition?.code ?? null;
}

function buildNormalizedTag(
  entry: Partial<EvidenceCriterionTag>,
  document: DocumentWithTags,
): EvidenceCriterionTag | null {
  const code = normalizeCriterionCode(entry.criterionCode ?? entry.code);

  if (!code) {
    return null;
  }

  const definition = getCriterionDefinition(code);

  if (!definition) {
    return null;
  }

  const origin = normalizeTagOrigin(entry);
  const createdAt = entry.createdAt ?? entry.taggedAt ?? document.updatedAt;
  const updatedAt = entry.updatedAt ?? entry.taggedAt ?? document.updatedAt;
  const state = normalizeTagState(entry, document.reviewStatus);
  const confidence = clampConfidence(entry.confidence);
  const aiConfidence =
    entry.aiConfidence === null
      ? null
      : typeof entry.aiConfidence === "number"
        ? clampConfidence(entry.aiConfidence)
        : origin === "ai"
          ? confidence
          : null;

  return {
    id: entry.id ?? `${document.id}:${definition.code}`,
    documentId: entry.documentId ?? document.id,
    workspaceId: entry.workspaceId ?? document.jobId,
    code: definition.code,
    criterionCode: definition.code,
    legalCode: definition.legalCode,
    name: definition.name,
    role: normalizeTagRole(entry),
    source: origin === "attorney" ? "manual" : "ai",
    origin,
    state,
    confidence,
    aiConfidence,
    reasoning: typeof entry.reasoning === "string" ? entry.reasoning : "",
    taggedAt: entry.taggedAt ?? createdAt,
    createdAt,
    updatedAt,
  };
}

function pickPreferredTag(
  left: EvidenceCriterionTag,
  right: EvidenceCriterionTag,
) {
  const leftStateRank = TAG_STATE_PRIORITY[left.state ?? "suggested"];
  const rightStateRank = TAG_STATE_PRIORITY[right.state ?? "suggested"];

  if (leftStateRank !== rightStateRank) {
    return leftStateRank > rightStateRank ? left : right;
  }

  const leftRoleRank = TAG_ROLE_PRIORITY[left.role];
  const rightRoleRank = TAG_ROLE_PRIORITY[right.role];

  if (leftRoleRank !== rightRoleRank) {
    return leftRoleRank > rightRoleRank ? left : right;
  }

  const leftConfidence = left.aiConfidence ?? left.confidence;
  const rightConfidence = right.aiConfidence ?? right.confidence;

  if (leftConfidence !== rightConfidence) {
    return leftConfidence > rightConfidence ? left : right;
  }

  return (left.updatedAt ?? left.taggedAt) >= (right.updatedAt ?? right.taggedAt) ? left : right;
}

export function normalizeCriterionTags(document: DocumentWithTags) {
  const normalized = (document.criteriaTags ?? [])
    .map((entry) => buildNormalizedTag(entry, document))
    .filter((entry): entry is EvidenceCriterionTag => Boolean(entry));
  const tagByCriterion = new Map<string, EvidenceCriterionTag>();

  normalized.forEach((entry) => {
    const existing = tagByCriterion.get(entry.code);

    if (!existing) {
      tagByCriterion.set(entry.code, entry);
      return;
    }

    tagByCriterion.set(entry.code, pickPreferredTag(existing, entry));
  });

  return [...tagByCriterion.values()].sort((left, right) =>
    left.code.localeCompare(right.code),
  );
}

export function hasEnabledCriterionTag(
  document: Pick<ClientDocument | StoredDocument, "criteriaTags">,
  criterionCode?: string | null,
) {
  return normalizeCriterionTags({
    id: "preview",
    jobId: "preview",
    updatedAt: new Date(0).toISOString(),
    reviewStatus: "pending",
    disposition: "untouched",
    criteriaTags: document.criteriaTags,
  }).some(
    (tag) =>
      tag.state === "enabled" &&
      (!criterionCode || tag.code === normalizeCriterionCode(criterionCode)),
  );
}

export function hasSuggestedCriterionTag(
  document: Pick<ClientDocument | StoredDocument, "criteriaTags">,
  criterionCode?: string | null,
) {
  return normalizeCriterionTags({
    id: "preview",
    jobId: "preview",
    updatedAt: new Date(0).toISOString(),
    reviewStatus: "pending",
    disposition: "untouched",
    criteriaTags: document.criteriaTags,
  }).some(
    (tag) =>
      tag.state === "suggested" &&
      (!criterionCode || tag.code === normalizeCriterionCode(criterionCode)),
  );
}

export function getHighestAiConfidence(
  document: Pick<ClientDocument | StoredDocument, "criteriaTags">,
) {
  return normalizeCriterionTags({
    id: "preview",
    jobId: "preview",
    updatedAt: new Date(0).toISOString(),
    reviewStatus: "pending",
    disposition: "untouched",
    criteriaTags: document.criteriaTags,
  }).reduce((best, tag) => Math.max(best, tag.aiConfidence ?? tag.confidence), 0);
}

export function deriveDocumentDisposition(
  document: Pick<StoredDocument, "criteriaTags" | "reviewStatus" | "disposition">,
): DocumentDisposition {
  if (
    document.disposition === "reference" ||
    document.disposition === "archived" ||
    document.disposition === "tagged" ||
    document.disposition === "untouched"
  ) {
    if (
      document.disposition === "tagged" &&
      !normalizeCriterionTags({
        id: "preview",
        jobId: "preview",
        updatedAt: new Date(0).toISOString(),
        reviewStatus: document.reviewStatus,
        disposition: document.disposition,
        criteriaTags: document.criteriaTags,
      }).some((tag) => tag.state === "enabled")
    ) {
      return "untouched";
    }

    return document.disposition;
  }

  if (document.reviewStatus === "reference") {
    return "reference";
  }

  if (document.reviewStatus === "archived") {
    return "archived";
  }

  const hasEnabledTag = normalizeCriterionTags({
    id: "preview",
    jobId: "preview",
    updatedAt: new Date(0).toISOString(),
    reviewStatus: document.reviewStatus,
    disposition: "untouched",
    criteriaTags: document.criteriaTags,
  }).some((tag) => tag.state === "enabled");

  return hasEnabledTag ? "tagged" : "untouched";
}

export function deriveLegacyReviewStatus(
  disposition: DocumentDisposition,
): EvidenceReviewStatus {
  switch (disposition) {
    case "tagged":
      return "kept";
    case "reference":
      return "reference";
    case "archived":
      return "archived";
    default:
      return "pending";
  }
}

export function normalizeStoredDocument(document: StoredDocument) {
  const normalizedTags = normalizeCriterionTags(document);
  const disposition = deriveDocumentDisposition({
    criteriaTags: normalizedTags,
    reviewStatus: document.reviewStatus,
    disposition: document.disposition,
  });
  const reviewStatus = deriveLegacyReviewStatus(disposition);
  const changed =
    JSON.stringify(normalizedTags) !== JSON.stringify(document.criteriaTags) ||
    disposition !== document.disposition ||
    reviewStatus !== document.reviewStatus;

  return {
    changed,
    document: changed
      ? {
          ...document,
          criteriaTags: normalizedTags,
          disposition,
          reviewStatus,
        }
      : {
          ...document,
          disposition,
          criteriaTags: normalizedTags,
        },
  };
}

export function upsertCriterionTag(
  document: DocumentWithTags,
  criterionCode: string,
  input: {
    role?: CriterionTagRole;
    state: CriterionTagState;
    origin?: CriterionTagOrigin;
    aiConfidence?: number | null;
    reasoning?: string;
  },
) {
  const definition = getCriterionDefinition(criterionCode);

  if (!definition) {
    throw new Error(`Unknown criterion '${criterionCode}'.`);
  }

  const now = new Date().toISOString();
  const tags = normalizeCriterionTags(document);
  const existing = tags.find((tag) => tag.code === definition.code);
  const origin = input.origin ?? "attorney";
  const nextTag: EvidenceCriterionTag = {
    id: existing?.id ?? `${document.id}:${definition.code}`,
    documentId: document.id,
    workspaceId: document.jobId,
    code: definition.code,
    criterionCode: definition.code,
    legalCode: definition.legalCode,
    name: definition.name,
    role: input.role ?? existing?.role ?? "supporting",
    source: origin === "attorney" ? "manual" : "ai",
    origin,
    state: input.state,
    confidence: input.aiConfidence ?? existing?.confidence ?? 0,
    aiConfidence:
      origin === "ai"
        ? input.aiConfidence ?? existing?.aiConfidence ?? existing?.confidence ?? 0
        : existing?.aiConfidence ?? null,
    reasoning: input.reasoning ?? existing?.reasoning ?? "",
    taggedAt: existing?.taggedAt ?? now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const nextTags = [...tags.filter((tag) => tag.code !== definition.code), nextTag].sort(
    (left, right) => left.code.localeCompare(right.code),
  );
  const currentDisposition = deriveDocumentDisposition(document);
  const hasEnabledTag = nextTags.some((tag) => tag.state === "enabled");
  const nextDisposition: DocumentDisposition =
    currentDisposition === "archived" || currentDisposition === "reference"
      ? currentDisposition
      : hasEnabledTag
        ? "tagged"
        : "untouched";

  return {
    criteriaTags: nextTags,
    disposition: nextDisposition,
    reviewStatus: deriveLegacyReviewStatus(nextDisposition),
  };
}

export function setDocumentDisposition(
  document: DocumentWithTags,
  disposition: DocumentDisposition,
) {
  const normalizedTags = normalizeCriterionTags(document);
  const nextDisposition: DocumentDisposition =
    disposition === "tagged"
      ? normalizedTags.some((tag) => tag.state === "enabled")
        ? "tagged"
        : "untouched"
      : disposition;

  return {
    criteriaTags: normalizedTags,
    disposition: nextDisposition,
    reviewStatus: deriveLegacyReviewStatus(nextDisposition),
  };
}

export function describeCriterionTag(tag: EvidenceCriterionTag) {
  const label = getCriterionDisplayLabel(tag.code, {
    fallbackName: tag.name,
  });

  if (tag.state === "enabled") {
    return `${label} · ${tag.role}`;
  }

  if (tag.state === "suggested") {
    return `${label} · suggested`;
  }

  return `${label} · disabled`;
}
