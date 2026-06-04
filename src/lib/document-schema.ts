import { z } from "zod";

export const objectiveEvidenceSchema = z.enum(["objective", "subjective", "mixed"]);
export const publicationTypeSchema = z.enum([
  "peer_reviewed_journal",
  "conference_paper",
  "preprint",
  "editorial_or_opinion",
  "trade_press",
  "mainstream_media",
  "interview_or_placement",
  "press_release",
  "blog_or_self_published",
  "not_a_publication",
]);
export const reviewTypeSchema = z.enum([
  "double_blind",
  "single_blind",
  "open_review",
  "editorial_only",
  "unknown",
  "not_applicable",
]);

export const documentSummarySchema = z.object({
  title: z.string().min(1).max(160),
  shortSummary: z.string().min(1).max(220),
  detailedSummary: z.string().min(1).max(1400),
  evidenceValue: z.string().min(1).max(520),
  recommendedUse: z.string().min(1).max(420),
  documentType: z.string().min(1).max(80),
  confidence: z.number().int().min(0).max(100),
  primaryDate: z.string().min(1).max(32).nullable(),
  primaryDateReason: z.string().min(1).max(180),
  notableFacts: z.array(z.string().min(1).max(220)).max(8),
  people: z.array(z.string().min(1).max(120)).max(10),
  organizations: z.array(z.string().min(1).max(160)).max(10),
  dates: z.array(z.string().min(1).max(120)).max(10),
  locations: z.array(z.string().min(1).max(120)).max(10),
  tags: z.array(z.string().min(1).max(48)).max(12),
  possibleCriteria: z.array(z.string().min(1).max(80)).max(6),
  missingContext: z.array(z.string().min(1).max(180)).max(6),
  riskFlags: z.array(z.string().min(1).max(180)).max(6),
  objectiveEvidence: objectiveEvidenceSchema,
  publicationVenue: z.string().min(1).max(180).nullable(),
  publicationType: publicationTypeSchema,
  reviewType: reviewTypeSchema,
  urls: z.array(z.string().min(1).max(500)).max(20),
  selfSolicitationSignals: z.array(z.string().min(1).max(220)).max(8),
});

export type DocumentSummarySchemaPayload = z.infer<typeof documentSummarySchema>;

const OBJECTIVE_EVIDENCE_VALUES = objectiveEvidenceSchema.options;
const PUBLICATION_TYPE_VALUES = publicationTypeSchema.options;
const REVIEW_TYPE_VALUES = reviewTypeSchema.options;

function clampString(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength).trim();
}

function clampStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => clampString(entry, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function enumFallback<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function normalizeDocumentSummaryCandidate(
  raw: unknown,
): DocumentSummarySchemaPayload {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const publicationVenue = clampString(value.publicationVenue, 180);

  return {
    title: clampString(value.title, 160, "Untitled evidence"),
    shortSummary: clampString(value.shortSummary, 220, "Summary unavailable."),
    detailedSummary: clampString(value.detailedSummary, 1400, "Detailed summary unavailable."),
    evidenceValue: clampString(value.evidenceValue, 520, "Evidence value unavailable."),
    recommendedUse: clampString(value.recommendedUse, 420, "Recommended use unavailable."),
    documentType: clampString(value.documentType, 80, "Evidence file"),
    confidence: Math.min(
      100,
      Math.max(0, Math.round(typeof value.confidence === "number" ? value.confidence : 0)),
    ),
    primaryDate:
      value.primaryDate === null ? null : clampString(value.primaryDate, 32) || null,
    primaryDateReason: clampString(
      value.primaryDateReason,
      180,
      "No primary evidence date was confidently identified.",
    ),
    notableFacts: clampStringArray(value.notableFacts, 8, 220),
    people: clampStringArray(value.people, 10, 120),
    organizations: clampStringArray(value.organizations, 10, 160),
    dates: clampStringArray(value.dates, 10, 120),
    locations: clampStringArray(value.locations, 10, 120),
    tags: clampStringArray(value.tags, 12, 48),
    possibleCriteria: clampStringArray(value.possibleCriteria, 6, 80),
    missingContext: clampStringArray(value.missingContext, 6, 180),
    riskFlags: clampStringArray(value.riskFlags, 6, 180),
    objectiveEvidence: enumFallback(
      value.objectiveEvidence,
      OBJECTIVE_EVIDENCE_VALUES,
      "mixed",
    ),
    publicationVenue: publicationVenue || null,
    publicationType: enumFallback(
      value.publicationType,
      PUBLICATION_TYPE_VALUES,
      "not_a_publication",
    ),
    reviewType: enumFallback(value.reviewType, REVIEW_TYPE_VALUES, "not_applicable"),
    urls: clampStringArray(value.urls, 20, 500),
    selfSolicitationSignals: clampStringArray(value.selfSolicitationSignals, 8, 220),
  };
}

export const documentSummaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "shortSummary",
    "detailedSummary",
    "evidenceValue",
    "recommendedUse",
    "documentType",
    "confidence",
    "primaryDate",
    "primaryDateReason",
    "notableFacts",
    "people",
    "organizations",
    "dates",
    "locations",
    "tags",
    "possibleCriteria",
    "missingContext",
    "riskFlags",
    "objectiveEvidence",
    "publicationVenue",
    "publicationType",
    "reviewType",
    "urls",
    "selfSolicitationSignals",
  ],
  properties: {
    title: { type: "string" },
    shortSummary: { type: "string" },
    detailedSummary: { type: "string" },
    evidenceValue: { type: "string" },
    recommendedUse: { type: "string" },
    documentType: { type: "string" },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    primaryDate: {
      type: ["string", "null"],
    },
    primaryDateReason: { type: "string" },
    notableFacts: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    people: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    organizations: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    dates: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    locations: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    tags: {
      type: "array",
      items: { type: "string" },
      maxItems: 12,
    },
    possibleCriteria: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
    missingContext: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
    riskFlags: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
    objectiveEvidence: {
      type: "string",
      enum: OBJECTIVE_EVIDENCE_VALUES,
    },
    publicationVenue: {
      type: ["string", "null"],
    },
    publicationType: {
      type: "string",
      enum: PUBLICATION_TYPE_VALUES,
    },
    reviewType: {
      type: "string",
      enum: REVIEW_TYPE_VALUES,
    },
    urls: {
      type: "array",
      items: { type: "string" },
      maxItems: 20,
    },
    selfSolicitationSignals: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
  },
} as const;
