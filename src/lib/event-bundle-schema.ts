import { z } from "zod";

export const eventBundleCandidateSchema = z.object({
  bundles: z.array(
    z.object({
      name: z.string().min(1).max(160),
      shortSummary: z.string().min(1).max(240),
      detailedSummary: z.string().min(1).max(1400),
      eventType: z.string().min(1).max(80),
      latestRelevantDate: z.string().min(1).max(32).nullable(),
      timeframeLabel: z.string().min(1).max(120),
      location: z.string().min(1).max(120),
      organizations: z.array(z.string().min(1).max(120)).max(12),
      people: z.array(z.string().min(1).max(120)).max(12),
      keywords: z.array(z.string().min(1).max(48)).max(12),
      confidence: z.number().int().min(0).max(100),
      leadDocumentId: z.string().min(1).max(80).nullable(),
      evidenceDocumentIds: z.array(z.string().min(1).max(80)).min(1).max(48),
    }),
  ),
});

export const eventBundleCandidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bundles"],
  properties: {
    bundles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "shortSummary",
          "detailedSummary",
          "eventType",
          "latestRelevantDate",
          "timeframeLabel",
          "location",
          "organizations",
          "people",
          "keywords",
          "confidence",
          "leadDocumentId",
          "evidenceDocumentIds",
        ],
        properties: {
          name: { type: "string" },
          shortSummary: { type: "string" },
          detailedSummary: { type: "string" },
          eventType: { type: "string" },
          latestRelevantDate: { type: ["string", "null"] },
          timeframeLabel: { type: "string" },
          location: { type: "string" },
          organizations: {
            type: "array",
            items: { type: "string" },
            maxItems: 12,
          },
          people: {
            type: "array",
            items: { type: "string" },
            maxItems: 12,
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            maxItems: 12,
          },
          confidence: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
          leadDocumentId: {
            type: ["string", "null"],
          },
          evidenceDocumentIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 48,
          },
        },
      },
    },
  },
} as const;
