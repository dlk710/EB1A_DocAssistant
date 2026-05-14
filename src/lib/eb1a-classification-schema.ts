import { z } from "zod";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";

const criterionCodes = EB1A_CRITERIA_DEFINITIONS.map((criterion) => criterion.code);
const criterionCodeSet = new Set<string>(criterionCodes);

export const eb1aClassificationCandidateSchema = z.object({
  decisions: z.array(
    z.object({
      bundleId: z.string().min(1).max(80),
      primaryCriterionCode: z
        .string()
        .refine((value) => criterionCodeSet.has(value), {
          message: "Invalid primary criterion code.",
        })
        .nullable(),
      secondaryCriterionCodes: z
        .array(
          z.string().refine((value) => criterionCodeSet.has(value), {
            message: "Invalid secondary criterion code.",
          }),
        )
        .max(3),
      confidence: z.number().int().min(0).max(100),
      rationale: z.string().min(1).max(520),
      unclassifiedReason: z.string().min(1).max(320).nullable(),
      suggestedExhibitTitle: z.string().min(1).max(180),
    }),
  ),
});

export const eb1aClassificationCandidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "bundleId",
          "primaryCriterionCode",
          "secondaryCriterionCodes",
          "confidence",
          "rationale",
          "unclassifiedReason",
          "suggestedExhibitTitle",
        ],
        properties: {
          bundleId: { type: "string" },
          primaryCriterionCode: {
            type: ["string", "null"],
            enum: [...criterionCodes, null],
          },
          secondaryCriterionCodes: {
            type: "array",
            items: {
              type: "string",
              enum: criterionCodes,
            },
            maxItems: 3,
          },
          confidence: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
          rationale: { type: "string" },
          unclassifiedReason: {
            type: ["string", "null"],
          },
          suggestedExhibitTitle: {
            type: "string",
          },
        },
      },
    },
  },
} as const;
