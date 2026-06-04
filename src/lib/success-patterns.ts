import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { isAlwaysHumanCriterion } from "@/lib/criterion-routing";
import type { ClientDocument, StoredDocument } from "@/lib/types";

const matcherSchema = z.object({
  type: z.enum(["keyword", "regex"]),
  values: z.array(z.string().min(1)),
});

const successTagPriorSchema = z.object({
  id: z.string().min(1),
  criterionCode: z.string().regex(/^\d{2}$/),
  label: z.string().min(1),
  matcher: matcherSchema,
  minimumConfidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  source: z.string().min(1),
  enabled: z.boolean(),
});

export type SuccessTagPriorRule = z.infer<typeof successTagPriorSchema>;

export interface SuccessTagPriorHit {
  id: string;
  criterionCode: string;
  minimumConfidence: number;
  rationale: string;
  matchedOn: string;
}

type EvidenceDocument = Pick<
  StoredDocument | ClientDocument,
  "fileName" | "relativePath" | "summary" | "metadata"
>;

let cachedSuccessTagPriorRules: SuccessTagPriorRule[] | null = null;

function readJsonFile(fileName: string) {
  const fullPath = path.join(process.cwd(), "data", fileName);
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
}

export function getSuccessTagPriorRules() {
  cachedSuccessTagPriorRules ??= z
    .array(successTagPriorSchema)
    .parse(readJsonFile("success-tag-priors.json"));

  return cachedSuccessTagPriorRules;
}

function buildEvidenceText(document: EvidenceDocument) {
  return [
    document.fileName,
    document.relativePath,
    document.summary?.title,
    document.summary?.shortSummary,
    document.summary?.detailedSummary,
    document.summary?.evidenceValue,
    document.summary?.recommendedUse,
    document.summary?.documentType,
    document.summary?.publicationVenue,
    document.summary?.publicationType,
    document.summary?.reviewType,
    ...(document.summary?.possibleCriteria ?? []),
    ...(document.summary?.tags ?? []),
    ...(document.summary?.notableFacts ?? []),
    ...(document.summary?.organizations ?? []),
    document.metadata?.preview,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function matcherHit(matcher: SuccessTagPriorRule["matcher"], haystack: string) {
  for (const value of matcher.values) {
    const needle = value.toLowerCase();

    if (matcher.type === "keyword" && haystack.includes(needle)) {
      return value;
    }

    if (matcher.type === "regex") {
      try {
        if (new RegExp(value, "i").test(haystack)) {
          return value;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

export function findSuccessTagPriorHits(document: EvidenceDocument): SuccessTagPriorHit[] {
  const haystack = buildEvidenceText(document);

  return getSuccessTagPriorRules()
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const matchedOn = matcherHit(rule.matcher, haystack);

      return matchedOn
        ? {
            id: rule.id,
            criterionCode: rule.criterionCode,
            minimumConfidence: rule.minimumConfidence,
            rationale: rule.rationale,
            matchedOn,
          }
        : null;
    })
    .filter((hit): hit is SuccessTagPriorHit => Boolean(hit));
}

export function findSuccessTagPriorForCriterion(
  document: EvidenceDocument,
  criterionCode: string,
) {
  if (isAlwaysHumanCriterion(criterionCode)) {
    return null;
  }

  return (
    findSuccessTagPriorHits(document).find((hit) => hit.criterionCode === criterionCode) ?? null
  );
}
