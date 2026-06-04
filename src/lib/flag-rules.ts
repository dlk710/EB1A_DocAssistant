import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ClientDocument, StoredDocument } from "@/lib/types";

const matcherSchema = z.object({
  type: z.enum(["keyword", "venue-name", "regex", "heuristic"]),
  values: z.array(z.string().min(1)),
});

const redFlagRuleSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "predatory_venue",
    "non_independent_media",
    "self_solicited",
    "unverifiable",
    "non_objective",
    "venue_standing_unproven",
  ]),
  matcher: matcherSchema,
  severity: z.enum(["low", "medium", "high"]),
  rationale: z.string().min(1),
  source: z.string().min(1),
  enabled: z.boolean(),
});

const blueFlagRuleSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["independent_publication", "objective_third_party", "high_standing_venue"]),
  matcher: matcherSchema,
  strength: z.enum(["medium", "high"]),
  rationale: z.string().min(1),
  indexing: z.string().min(1),
  impactMetric: z.string().min(1),
  source: z.string().min(1),
  enabled: z.boolean(),
});

export type RedFlagRule = z.infer<typeof redFlagRuleSchema>;
export type BlueFlagRule = z.infer<typeof blueFlagRuleSchema>;

export interface RedFlagHit {
  id: string;
  category: RedFlagRule["category"];
  severity: RedFlagRule["severity"];
  rationale: string;
  matchedOn: string;
}

export interface BlueFlagHit {
  id: string;
  category: BlueFlagRule["category"];
  strength: BlueFlagRule["strength"];
  rationale: string;
  indexing: string;
  impactMetric: string;
  matchedOn: string;
}

type EvidenceDocument = Pick<
  StoredDocument | ClientDocument,
  "fileName" | "relativePath" | "summary" | "metadata"
>;

function readJsonFile(fileName: string) {
  const fullPath = path.join(process.cwd(), "data", fileName);
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
}

export function getRedFlagRules() {
  return z.array(redFlagRuleSchema).parse(readJsonFile("red-flags.json"));
}

export function getBlueFlagRules() {
  return z.array(blueFlagRuleSchema).parse(readJsonFile("blue-flags.json"));
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
    ...(document.summary?.organizations ?? []),
    ...(document.summary?.tags ?? []),
    ...(document.summary?.riskFlags ?? []),
    ...(document.summary?.urls ?? []),
    ...(document.summary?.selfSolicitationSignals ?? []),
    document.metadata?.preview,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function heuristicMatches(value: string, document: EvidenceDocument) {
  if (value === "unknown_review_or_editorial_only") {
    return (
      document.summary?.publicationType !== "not_a_publication" &&
      (document.summary?.reviewType === "unknown" ||
        document.summary?.reviewType === "editorial_only")
    );
  }

  if (value === "urls_present_not_checked") {
    return (document.summary?.urls?.length ?? 0) > 0;
  }

  return false;
}

function matcherHit(
  matcher: RedFlagRule["matcher"] | BlueFlagRule["matcher"],
  document: EvidenceDocument,
) {
  const haystack = buildEvidenceText(document);

  for (const value of matcher.values) {
    const needle = value.toLowerCase();

    if (matcher.type === "heuristic" && heuristicMatches(value, document)) {
      return value;
    }

    if ((matcher.type === "keyword" || matcher.type === "venue-name") && haystack.includes(needle)) {
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

export function findRedFlagHits(document: EvidenceDocument): RedFlagHit[] {
  return getRedFlagRules()
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const matchedOn = matcherHit(rule.matcher, document);

      return matchedOn
        ? {
            id: rule.id,
            category: rule.category,
            severity: rule.severity,
            rationale: rule.rationale,
            matchedOn,
          }
        : null;
    })
    .filter((hit): hit is RedFlagHit => Boolean(hit));
}

export function findBlueFlagHits(document: EvidenceDocument): BlueFlagHit[] {
  return getBlueFlagRules()
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const matchedOn = matcherHit(rule.matcher, document);

      return matchedOn
        ? {
            id: rule.id,
            category: rule.category,
            strength: rule.strength,
            rationale: rule.rationale,
            indexing: rule.indexing,
            impactMetric: rule.impactMetric,
            matchedOn,
          }
        : null;
    })
    .filter((hit): hit is BlueFlagHit => Boolean(hit));
}
