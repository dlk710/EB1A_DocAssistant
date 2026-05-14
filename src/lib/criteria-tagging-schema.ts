import { z } from "zod";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";

const criterionCodes = EB1A_CRITERIA_DEFINITIONS.map((criterion) => criterion.code) as [
  string,
  ...string[],
];

export const criteriaTaggingSchema = z.object({
  criteria: z
    .array(
      z.object({
        code: z.enum(criterionCodes),
        role: z.enum(["primary", "supporting"]),
        confidence: z.number().min(0).max(1),
        reasoning: z.string().trim().min(1).max(400),
      }),
    )
    .max(6),
  keepSuggestion: z.enum(["kept", "pending", "archived"]),
  keepReason: z.string().trim().min(1).max(300),
});

export const criteriaTaggingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["criteria", "keepSuggestion", "keepReason"],
  properties: {
    criteria: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "role", "confidence", "reasoning"],
        properties: {
          code: {
            type: "string",
            enum: EB1A_CRITERIA_DEFINITIONS.map((criterion) => criterion.code),
          },
          role: {
            type: "string",
            enum: ["primary", "supporting"],
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          reasoning: {
            type: "string",
          },
        },
      },
    },
    keepSuggestion: {
      type: "string",
      enum: ["kept", "pending", "archived"],
    },
    keepReason: {
      type: "string",
    },
  },
} as const;
