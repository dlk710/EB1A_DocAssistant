import crypto from "node:crypto";
import { eventBundleCandidateJsonSchema, eventBundleCandidateSchema } from "@/lib/event-bundle-schema";
import { normalizePrimaryDate } from "@/lib/date";
import { isReviewableEvidenceFile } from "@/lib/evidence-filters";
import { clearJobCancellationRequest, getJob, isJobCancellationRequested } from "@/lib/jobs";
import { getOpenAiContext } from "@/lib/openai";
import { calculateTextModelCost } from "@/lib/openai-pricing";
import { fillPromptTemplate } from "@/lib/prompt-library";
import {
  formatBundleDisplayName,
  formatSpecialBundleName,
  getFilenameReviewDisposition,
} from "@/lib/review-routing";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type { EventBundle, StoredDocument, TextModelUsage, WorkspaceEventBundleState } from "@/lib/types";

interface EventBundleStateFile {
  workspaces: Record<string, WorkspaceEventBundleState>;
}

const EVENT_BUNDLES_FILE = "event-bundles.json";
const EVENT_BUNDLE_VERSION = 12;
const AUXILIARY_BUNDLE_MERGE_THRESHOLD = 5;
const ROLE_ANCHOR_MERGE_THRESHOLD = 8;

type StructuredRolePrefix = "CR" | "LR" | "OC";

interface StructuredBundleHint {
  prefix: StructuredRolePrefix;
  projectName: string | null;
  aliases: string[];
  reason: string;
}

type RawBundleCandidate = ReturnType<typeof sanitizeEventBundleCandidate>["bundles"][number];

declare global {
  var __eb1aActiveEventBundleJobs: Set<string> | undefined;
}

const activeBundleJobs = globalThis.__eb1aActiveEventBundleJobs ?? new Set<string>();
globalThis.__eb1aActiveEventBundleJobs = activeBundleJobs;

function readEventBundleStateFile() {
  return readStateFile<EventBundleStateFile>(EVENT_BUNDLES_FILE, {
    workspaces: {},
  });
}

function writeEventBundleStateFile(state: EventBundleStateFile) {
  writeStateFile(EVENT_BUNDLES_FILE, state);
}

function getDocumentsFingerprint(documents: StoredDocument[]) {
  const completedDocuments = documents.filter(
    (document) =>
      document.processingStatus === "completed" && isReviewableEvidenceFile(document),
  );

  return {
    sourceDocumentCount: completedDocuments.length,
    sourceLatestDocumentUpdateAt:
      completedDocuments
        .map((document) => document.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ?? null,
  };
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function buildTextUsage(
  model: string,
  usage:
    | {
        input_tokens?: number | null;
        output_tokens?: number | null;
        total_tokens?: number | null;
        input_tokens_details?: {
          cached_tokens?: number | null;
        } | null;
      }
    | null
    | undefined,
): TextModelUsage | null {
  if (!usage) {
    return null;
  }

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cachedInputTokens = usage.input_tokens_details?.cached_tokens ?? 0;

  return {
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
    costUsd: calculateTextModelCost({
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
    }),
  };
}

function getStoredWorkspaceEventBundleState(jobId: string) {
  return readEventBundleStateFile().workspaces[jobId] ?? null;
}

function saveWorkspaceEventBundleState(
  jobId: string,
  nextState: WorkspaceEventBundleState,
) {
  const state = readEventBundleStateFile();
  state.workspaces[jobId] = nextState;
  writeEventBundleStateFile(state);
}

function buildSyntheticBundleState(
  jobId: string,
  documents: StoredDocument[],
  message: string,
): WorkspaceEventBundleState {
  const fingerprint = getDocumentsFingerprint(documents);

  return {
    version: EVENT_BUNDLE_VERSION,
    jobId,
    status: "idle",
    message,
    bundles: [],
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    totalCostUsd: 0,
    updatedAt: new Date(0).toISOString(),
    error: null,
  };
}

function buildCanceledBundleState(
  jobId: string,
  documents: StoredDocument[],
  message: string,
): WorkspaceEventBundleState {
  const fingerprint = getDocumentsFingerprint(documents);

  return {
    version: EVENT_BUNDLE_VERSION,
    jobId,
    status: "canceled",
    message,
    bundles: [],
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  };
}

function isBundleStateCurrent(
  state: WorkspaceEventBundleState | null,
  documents: StoredDocument[],
) {
  if (!state) {
    return false;
  }

  const fingerprint = getDocumentsFingerprint(documents);

  return (
    state.version === EVENT_BUNDLE_VERSION &&
    state.sourceDocumentCount === fingerprint.sourceDocumentCount &&
    state.sourceLatestDocumentUpdateAt === fingerprint.sourceLatestDocumentUpdateAt
  );
}

function buildWorkspaceDocumentDigest(documents: StoredDocument[]) {
  const structuredHintLookup = buildStructuredHintLookup(documents);

  return documents
    .filter(
      (document) =>
        document.processingStatus === "completed" &&
        isReviewableEvidenceFile(document) &&
        !getFilenameReviewDisposition(document.fileName),
    )
    .map((document) => {
      const structuredHint = structuredHintLookup.get(document.id) ?? null;

      return {
        id: document.id,
        fileName: document.fileName,
        relativePath: document.relativePath,
        documentType: document.summary?.documentType || document.extension || "File",
        title: document.summary?.title || document.fileName,
        shortSummary: document.summary?.shortSummary || "Summary unavailable.",
        detailedSummary:
          document.summary?.detailedSummary || "Detailed summary unavailable.",
        latestRelevantDate: document.summary?.primaryDate || null,
        notableFacts: document.summary?.notableFacts ?? [],
        organizations: document.summary?.organizations ?? [],
        people: document.summary?.people ?? [],
        locations: document.summary?.locations ?? [],
        tags: document.summary?.tags ?? [],
        candidateName: document.candidateName,
        structuredRolePrefix: structuredHint?.prefix ?? null,
        bundleHintName:
          structuredHint?.projectName && structuredHint?.prefix
            ? formatStructuredBundleName(structuredHint.prefix, structuredHint.projectName)
            : null,
        bundleHintAliases: structuredHint?.aliases ?? [],
        bundleHintReason: structuredHint?.reason ?? null,
      };
    });
}

function clampString(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
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

function sanitizeEventBundleCandidate(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    bundles: Array.isArray(value.bundles)
      ? value.bundles
          .filter((bundle): bundle is Record<string, unknown> => Boolean(bundle) && typeof bundle === "object")
          .map((bundle) => ({
            name: clampString(bundle.name, 160, "Untitled event"),
            shortSummary: clampString(bundle.shortSummary, 240, "Summary unavailable."),
            detailedSummary: clampString(
              bundle.detailedSummary,
              1400,
              "Detailed summary unavailable.",
            ),
            eventType: clampString(bundle.eventType, 80, "Evidence event"),
            latestRelevantDate:
              bundle.latestRelevantDate === null
                ? null
                : clampString(bundle.latestRelevantDate, 32) || null,
            timeframeLabel: clampString(bundle.timeframeLabel, 120, "Date not specified"),
            location: clampString(bundle.location, 120, "Location not specified"),
            organizations: clampStringArray(bundle.organizations, 12, 120),
            people: clampStringArray(bundle.people, 12, 120),
            keywords: clampStringArray(bundle.keywords, 12, 48),
            confidence: Math.min(
              100,
              Math.max(
                0,
                Math.round(typeof bundle.confidence === "number" ? bundle.confidence : 0),
              ),
            ),
            leadDocumentId:
              bundle.leadDocumentId === null
                ? null
                : clampString(bundle.leadDocumentId, 80) || null,
            evidenceDocumentIds: clampStringArray(bundle.evidenceDocumentIds, 48, 80),
          }))
      : [],
  };
}

function buildFallbackBundle(document: StoredDocument): EventBundle {
  const latestRelevantDate = normalizePrimaryDate(document.summary?.primaryDate ?? null);
  const structuredHint = inferStructuredBundleHint(document);

  return {
    id: crypto.randomUUID(),
    jobId: document.jobId,
    bundleKind: "standard",
    name: formatBundleDisplayName(
      structuredHint?.projectName
        ? formatStructuredBundleName(structuredHint.prefix, structuredHint.projectName)
        : document.summary?.title || document.fileName,
      latestRelevantDate,
    ),
    shortSummary: document.summary?.shortSummary || "Summary unavailable.",
    detailedSummary:
      document.summary?.detailedSummary || "Detailed summary unavailable for this evidence.",
    eventType:
      structuredHint?.projectName
        ? getStructuredEventType(structuredHint.prefix)
        : document.summary?.documentType || "Evidence item",
    latestRelevantDate,
    timeframeLabel: document.summary?.primaryDateReason || "Single supporting evidence item.",
    location: document.summary?.locations?.[0] || "Location not specified",
    organizations: document.summary?.organizations ?? [],
    people: document.summary?.people ?? [],
    keywords: uniqueMergedValues(
      document.summary?.tags ?? [],
      structuredHint ? [structuredHint.prefix, ...(structuredHint.projectName ? [structuredHint.projectName] : []), ...structuredHint.aliases] : [],
    ),
    confidence: Math.min(document.summary?.confidence ?? 0, 72),
    leadDocumentId: document.id,
    evidenceDocumentIds: [document.id],
  };
}

function buildSpecialReviewBundle(
  document: StoredDocument,
  disposition: "archive" | "unwanted",
): EventBundle {
  const latestRelevantDate = normalizePrimaryDate(document.summary?.primaryDate ?? null);
  const label = disposition === "archive" ? "Archive Category" : "Unwanted";
  const summaryTail =
    disposition === "archive"
      ? "The filename contains the word archive, so this file was routed into the Archive Category for later reference instead of normal event grouping."
      : "The filename contains delete or remove, so this file was routed into the Unwanted queue for human review instead of normal event grouping.";

  return {
    id: crypto.randomUUID(),
    jobId: document.jobId,
    bundleKind: disposition,
    name: formatSpecialBundleName(document, disposition),
    shortSummary:
      disposition === "archive"
        ? "Filename rule routed this file to Archive Category."
        : "Filename rule routed this file to Unwanted review.",
    detailedSummary: [document.summary?.detailedSummary, summaryTail]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1400),
    eventType: label,
    latestRelevantDate,
    timeframeLabel:
      document.summary?.primaryDateReason || "Filename rule preserved this file outside normal event bundling.",
    location: document.summary?.locations?.[0] || "Location not specified",
    organizations: document.summary?.organizations ?? [],
    people: document.summary?.people ?? [],
    keywords: Array.from(new Set([...(document.summary?.tags ?? []), label])),
    confidence: 100,
    leadDocumentId: document.id,
    evidenceDocumentIds: [document.id],
  };
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhrase(value: string) {
  return normalizeWhitespace(value).replace(/[^\p{L}\p{N}\s]+/gu, "").toLowerCase();
}

function buildPhraseAcronym(value: string) {
  const initials = normalizeWhitespace(value)
    .split(/\s+/)
    .filter((part) => /^[A-Za-z]/.test(part))
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials.length >= 2 && initials.length <= 8 ? initials : null;
}

function extractUppercaseAliases(value: string) {
  const matches = Array.from(value.matchAll(/\b[A-Z]{2,8}\b/g), (match) => match[0]);
  return uniqueMergedValues(matches);
}

function cleanInitiativeLabel(value: string) {
  return normalizeWhitespace(
    value
      .replace(/^[^A-Za-z0-9]+/, "")
      .replace(/[^A-Za-z0-9)\]]+$/, "")
      .replace(
        /\b(Project|Platform|Finder|Search|Match|Engine|API|System|Program|Initiative|Framework|App|Suite)(Project|Platform|Finder|Search|Match|Engine|API|System|Program|Initiative|Framework|App|Suite)\b/g,
        "$1 $2",
      )
      .replace(/\.\s*(Project|Platform|Finder|Search|Match|Engine|API|System|Program|Initiative|Framework|App|Suite)$/gi, "")
      .replace(/\b(Project|Platform|Finder|Search|Match|Engine|API|System|Program|Initiative|Framework|App|Suite)\s+\1\b/gi, "$1")
      .replace(/\s+(?:at|for|with|within)\s+[A-Z].*$/, "")
      .replace(/\s+\([A-Z]{2,8}\)$/, ""),
  );
}

function isGenericInitiativeLabel(value: string) {
  const normalized = normalizePhrase(value);

  if (
    /[\\/]/.test(value) ||
    /\b(raw|eb1a|for client review|critical role|original contributions|email evidences|newsletter|signed|final)\b/i.test(
      value,
    )
  ) {
    return true;
  }

  return [
    "ai leadership",
    "leadership",
    "technical leadership",
    "data science leadership",
    "healthcare ai",
    "healthcare innovation",
    "healthcare digital innovation",
    "team collaboration",
    "product architect",
    "advanced analytics",
    "digital transformation",
    "cost savings",
    "enterprise scale ai",
    "machine learning models",
    "operational excellence",
    "cross functional collaboration",
    "software release",
    "project release",
    "internal newsletter",
    "enterprise initiative",
    "project success",
    "evidence item",
    "docx",
    "ai project",
    "ai in health",
    "ai health use cases",
    "app development",
    "provider search",
    "smart provider search",
    "government initiative",
    "initiated platform",
    "indiaai",
    "ai system development",
    "business app",
    "data science",
    "ai deployment",
    "ai data science",
  ].includes(normalized);
}

function isStrongInitiativeLabel(value: string) {
  const cleaned = cleanInitiativeLabel(value);
  const normalized = normalizePhrase(cleaned);

  if (!normalized || normalized.length < 4 || isGenericInitiativeLabel(cleaned)) {
    return false;
  }

  if (
    /\b(platform|finder|search|match|engine|api|system|project|program|initiative|framework|app|suite)\b/i.test(
      cleaned,
    )
  ) {
    return true;
  }

  if (/[A-Z]{2,8}/.test(cleaned) || /[a-z][A-Z]/.test(cleaned)) {
    return true;
  }

  const words = cleaned.split(/\s+/);
  return words.length >= 2 && words.every((word) => /[A-Z]/.test(word[0] ?? ""));
}

function pickBestProjectName(candidates: string[]) {
  const cleanedCandidates = candidates
    .map(cleanInitiativeLabel)
    .filter((value) => value && isStrongInitiativeLabel(value));
  const frequencyByNormalizedValue = new Map<string, number>();

  cleanedCandidates.forEach((value) => {
    const normalized = normalizePhrase(value);
    frequencyByNormalizedValue.set(normalized, (frequencyByNormalizedValue.get(normalized) ?? 0) + 1);
  });

  const scored = uniqueMergedValues(cleanedCandidates)
    .map((value) => {
      let score = 0;

      if (
        /\b(platform|finder|search|match|engine|api|system|project|program|initiative|framework|app|suite)\b/i.test(
          value,
        )
      ) {
        score += 5;
      }

      if (/[A-Z]{2,8}/.test(value) || /\([A-Z]{2,8}\)/.test(value)) {
        score += 3;
      }

      score += Math.min(frequencyByNormalizedValue.get(normalizePhrase(value)) ?? 0, 4) * 2;
      score += Math.min(value.split(/\s+/).length, 5);

      return { value, score };
    })
    .sort((left, right) => right.score - left.score || left.value.length - right.value.length);

  return scored[0]?.value ?? null;
}

function extractStructuredProjectCandidates(value: string) {
  const cleaned = normalizeWhitespace(value);
  const matches = new Set<string>();
  const pattern =
    /\b([A-Z][A-Za-z0-9&/℠.-]*(?:\s+[A-Z][A-Za-z0-9&/℠.-]*){0,5}\s+(?:Platform|Finder|Search|Match|Engine|API|System|Project|Program|Initiative|Framework|App|Suite))\b/g;

  for (const match of cleaned.matchAll(pattern)) {
    const candidate = cleanInitiativeLabel(match[1] ?? "");
    if (candidate && isStrongInitiativeLabel(candidate)) {
      matches.add(candidate);
    }
  }

  return Array.from(matches);
}

function buildAcronymExpansionMap(value: string) {
  const expansions = new Map<string, string>();
  const normalized = normalizeWhitespace(value);
  const phraseFirstPattern =
    /\b([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){1,5})\s+\(([A-Z]{2,8})\)/g;
  const acronymFirstPattern =
    /\b([A-Z]{2,8})\s+\(([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){1,5})\)/g;

  for (const match of normalized.matchAll(phraseFirstPattern)) {
    const phrase = cleanInitiativeLabel(match[1] ?? "");
    const acronym = (match[2] ?? "").toUpperCase();

    if (phrase && acronym && isStrongInitiativeLabel(phrase)) {
      expansions.set(acronym, phrase);
    }
  }

  for (const match of normalized.matchAll(acronymFirstPattern)) {
    const acronym = (match[1] ?? "").toUpperCase();
    const phrase = cleanInitiativeLabel(match[2] ?? "");

    if (phrase && acronym && isStrongInitiativeLabel(phrase)) {
      expansions.set(acronym, phrase);
    }
  }

  return expansions;
}

function stripCandidateNameFromLabel(value: string, candidateName: string | null | undefined) {
  const cleanedValue = cleanInitiativeLabel(value);
  const trimmedCandidateName = normalizeWhitespace(candidateName ?? "");

  if (!trimmedCandidateName) {
    return cleanedValue;
  }

  const candidateVariants = uniqueMergedValues([
    trimmedCandidateName,
    trimmedCandidateName.split(/\s+/).slice(0, 2).join(" "),
    trimmedCandidateName.split(/\s+/)[0] ?? "",
  ]).filter(Boolean);

  let stripped = cleanedValue;

  candidateVariants.forEach((variant) => {
    stripped = stripped.replace(new RegExp(`^${variant}\\b\\s*`, "i"), "");
  });

  return cleanInitiativeLabel(stripped);
}

function expandAcronymProjectName(projectName: string | null, sourceText: string) {
  if (!projectName) {
    return null;
  }

  const acronymExpansions = buildAcronymExpansionMap(sourceText);
  const cleanedProjectName = cleanInitiativeLabel(projectName);
  const leadingAcronym = cleanedProjectName.match(/^([A-Z]{2,8})\b/)?.[1]?.toUpperCase() ?? null;

  if (!leadingAcronym) {
    return cleanedProjectName;
  }

  const expansion = acronymExpansions.get(leadingAcronym);

  if (!expansion) {
    return cleanedProjectName;
  }

  if (normalizePhrase(cleanedProjectName) === normalizePhrase(leadingAcronym)) {
    return expansion;
  }

  return cleanInitiativeLabel(cleanedProjectName.replace(new RegExp(`^${leadingAcronym}\\b\\s*`, "i"), expansion));
}

function detectStructuredRolePrefix(document: StoredDocument) {
  const signalText = [
    document.fileName,
    document.relativePath,
    document.summary?.title ?? "",
    document.summary?.shortSummary ?? "",
    document.summary?.detailedSummary ?? "",
  ].join(" ");

  if (/\bOC[_\s-]|\boriginal contributions?\b|\boriginal contribution\b/i.test(signalText)) {
    return "OC" as const;
  }

  if (/\bLR[_\s-]|\bleading role\b|\bleadership role\b/i.test(signalText)) {
    return "LR" as const;
  }

  if (/\bCR[_\s-]|\bcritical role\b/i.test(signalText)) {
    return "CR" as const;
  }

  return null;
}

function inferStructuredBundleHint(document: StoredDocument): StructuredBundleHint | null {
  const prefix = detectStructuredRolePrefix(document);

  if (!prefix) {
    return null;
  }

  const title = document.summary?.title ?? "";
  const detailedSummary = document.summary?.detailedSummary ?? "";
  const notableFacts = document.summary?.notableFacts ?? [];
  const tags = document.summary?.tags ?? [];
  const sourceText = [
    document.fileName,
    title,
    detailedSummary,
    notableFacts.join(" "),
    tags.join(" "),
  ].join(" ");
  const candidateProjectNames = [
    ...tags,
    ...extractStructuredProjectCandidates(title),
    ...extractStructuredProjectCandidates(detailedSummary),
    ...extractStructuredProjectCandidates(notableFacts.join(" ")),
    ...extractStructuredProjectCandidates(document.fileName.replace(/[_-]+/g, " ")),
  ].map((candidate) => stripCandidateNameFromLabel(candidate, document.candidateName));
  const projectName = pickBestProjectName(candidateProjectNames);
  const expandedProjectName = expandAcronymProjectName(projectName, sourceText);
  const projectAcronym = expandedProjectName ? buildPhraseAcronym(expandedProjectName) : null;
  const aliases = uniqueMergedValues([
    ...(expandedProjectName ? [expandedProjectName] : []),
    ...(projectAcronym ? [projectAcronym] : []),
    ...extractUppercaseAliases(sourceText),
    ...tags.filter((tag) => isStrongInitiativeLabel(tag)),
  ]).slice(0, 8);

  const reason = expandedProjectName
    ? `Structured ${prefix} dossier anchored to ${expandedProjectName}.`
    : `Structured ${prefix} dossier with role-specific evidence.`;

  return {
    prefix,
    projectName: expandedProjectName,
    aliases,
    reason,
  };
}

function getStructuredEventType(prefix: StructuredRolePrefix) {
  if (prefix === "CR") {
    return "Critical role project";
  }

  if (prefix === "LR") {
    return "Leading role project";
  }

  return "Original contribution project";
}

function formatStructuredBundleName(prefix: StructuredRolePrefix, projectName: string | null) {
  if (!projectName) {
    return prefix;
  }

  const cleanedProjectName = cleanInitiativeLabel(projectName);
  return cleanedProjectName.startsWith(`${prefix} `)
    ? cleanedProjectName
    : `${prefix} ${cleanedProjectName}`;
}

function buildStructuredHintLookup(documents: StoredDocument[]) {
  return new Map(
    documents
      .map((document) => {
        const hint = inferStructuredBundleHint(document);
        return hint ? ([document.id, hint] as const) : null;
      })
      .filter((entry): entry is readonly [string, StructuredBundleHint] => Boolean(entry)),
  );
}

function uniqueMergedValues(...valueGroups: string[][]) {
  const seen = new Set<string>();
  const merged: string[] = [];

  valueGroups.flat().forEach((value) => {
    const normalized = normalizeToken(value);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    merged.push(value);
  });

  return merged;
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right.map(normalizeToken));

  return left.reduce((count, value) => {
    return rightSet.has(normalizeToken(value)) ? count + 1 : count;
  }, 0);
}

function isDateClose(left: string | null, right: string | null, maxDays = 120) {
  if (!left || !right) {
    return true;
  }

  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return true;
  }

  return Math.abs(leftTime - rightTime) <= maxDays * 24 * 60 * 60 * 1000;
}

function isAuxiliaryEventType(value: string) {
  const normalized = normalizeToken(value);
  const auxiliaryTokens = [
    "photograph",
    "photo",
    "image",
    "badge",
    "name badge",
    "screenshot",
    "slide",
    "speaker slide",
    "presentation slide",
    "supporting visual",
  ];

  return auxiliaryTokens.some((token) => normalized.includes(token));
}

function scoreBundleMerge(source: EventBundle, target: EventBundle) {
  const organizationOverlap = countOverlap(source.organizations, target.organizations);
  const peopleOverlap = countOverlap(source.people, target.people);
  const keywordOverlap = countOverlap(source.keywords, target.keywords);

  let score = organizationOverlap * 4 + peopleOverlap * 2 + keywordOverlap;

  if (isDateClose(source.latestRelevantDate, target.latestRelevantDate)) {
    score += 2;
  }

  if (
    normalizeToken(source.location) !== "location not specified" &&
    normalizeToken(source.location) === normalizeToken(target.location)
  ) {
    score += 2;
  }

  return score;
}

function mergeAuxiliaryBundles(bundles: EventBundle[]) {
  const sortedBundles = [...bundles].sort(
    (left, right) => right.evidenceDocumentIds.length - left.evidenceDocumentIds.length,
  );
  const consumedSourceIds = new Set<string>();

  for (const sourceBundle of sortedBundles) {
    if (
      consumedSourceIds.has(sourceBundle.id) ||
      sourceBundle.evidenceDocumentIds.length > 2 ||
      !isAuxiliaryEventType(sourceBundle.eventType)
    ) {
      continue;
    }

    let bestTarget: EventBundle | null = null;
    let bestScore = 0;

    for (const targetBundle of sortedBundles) {
      if (
        targetBundle.id === sourceBundle.id ||
        consumedSourceIds.has(targetBundle.id) ||
        targetBundle.evidenceDocumentIds.length < sourceBundle.evidenceDocumentIds.length
      ) {
        continue;
      }

      const score = scoreBundleMerge(sourceBundle, targetBundle);

      if (score > bestScore) {
        bestScore = score;
        bestTarget = targetBundle;
      }
    }

    if (!bestTarget || bestScore < AUXILIARY_BUNDLE_MERGE_THRESHOLD) {
      continue;
    }

    bestTarget.evidenceDocumentIds = uniqueMergedValues(
      bestTarget.evidenceDocumentIds,
      sourceBundle.evidenceDocumentIds,
    );
    bestTarget.organizations = uniqueMergedValues(
      bestTarget.organizations,
      sourceBundle.organizations,
    );
    bestTarget.people = uniqueMergedValues(bestTarget.people, sourceBundle.people);
    bestTarget.keywords = uniqueMergedValues(bestTarget.keywords, sourceBundle.keywords);

    if (
      bestTarget.location === "Location not specified" &&
      sourceBundle.location !== "Location not specified"
    ) {
      bestTarget.location = sourceBundle.location;
    }

    if (
      sourceBundle.latestRelevantDate &&
      (!bestTarget.latestRelevantDate ||
        sourceBundle.latestRelevantDate > bestTarget.latestRelevantDate)
    ) {
      bestTarget.latestRelevantDate = sourceBundle.latestRelevantDate;
    }

    if (!bestTarget.detailedSummary.includes("supporting visual evidence")) {
      bestTarget.detailedSummary = clampString(
        `${bestTarget.detailedSummary} This bundle also includes supporting visual evidence tied to the same event.`,
        1400,
        bestTarget.detailedSummary,
      );
    }

    consumedSourceIds.add(sourceBundle.id);
  }

  return sortedBundles.filter((bundle) => !consumedSourceIds.has(bundle.id));
}

function splitStructuredRoleCandidates(
  rawBundles: RawBundleCandidate[],
  structuredHintLookup: Map<string, StructuredBundleHint>,
) {
  const normalizedBundles: RawBundleCandidate[] = [];

  rawBundles.forEach((bundle) => {
    const groupedStructuredDocs = new Map<
      string,
      { hint: StructuredBundleHint; documentIds: string[] }
    >();

    bundle.evidenceDocumentIds.forEach((documentId) => {
      const hint = structuredHintLookup.get(documentId);

      if (!hint?.projectName) {
        return;
      }

      const key = `${hint.prefix}::${normalizePhrase(hint.projectName)}`;
      const existing = groupedStructuredDocs.get(key);

      if (existing) {
        existing.documentIds.push(documentId);
        return;
      }

      groupedStructuredDocs.set(key, {
        hint,
        documentIds: [documentId],
      });
    });

    if (groupedStructuredDocs.size <= 1) {
      normalizedBundles.push(bundle);
      return;
    }

    const consumedStructuredIds = new Set<string>();

    groupedStructuredDocs.forEach(({ hint, documentIds }) => {
      documentIds.forEach((documentId) => consumedStructuredIds.add(documentId));
      normalizedBundles.push({
        ...bundle,
        name: formatStructuredBundleName(hint.prefix, hint.projectName),
        shortSummary: hint.projectName
          ? `Structured ${hint.prefix} bundle centered on ${hint.projectName}.`
          : bundle.shortSummary,
        eventType: getStructuredEventType(hint.prefix),
        leadDocumentId: documentIds[0] ?? bundle.leadDocumentId,
        evidenceDocumentIds: documentIds,
      });
    });

    const remainderDocumentIds = bundle.evidenceDocumentIds.filter(
      (documentId) => !consumedStructuredIds.has(documentId),
    );

    if (remainderDocumentIds.length) {
      normalizedBundles.push({
        ...bundle,
        leadDocumentId: remainderDocumentIds.includes(bundle.leadDocumentId ?? "")
          ? bundle.leadDocumentId
          : remainderDocumentIds[0],
        evidenceDocumentIds: remainderDocumentIds,
      });
    }
  });

  return normalizedBundles;
}

function countAliasMatches(aliases: string[], haystack: string) {
  return aliases.reduce((count, alias) => {
    const normalizedAlias = normalizePhrase(alias);
    return normalizedAlias && haystack.includes(normalizedAlias) ? count + 1 : count;
  }, 0);
}

function getBundleStructuredHint(
  bundle: EventBundle,
  structuredHintLookup: Map<string, StructuredBundleHint>,
) {
  return bundle.evidenceDocumentIds
    .map((documentId) => structuredHintLookup.get(documentId) ?? null)
    .find((hint): hint is StructuredBundleHint => Boolean(hint)) ?? null;
}

function mergeStructuredRoleBundles(
  bundles: EventBundle[],
  structuredHintLookup: Map<string, StructuredBundleHint>,
) {
  const sortedBundles = [...bundles].sort(
    (left, right) => right.evidenceDocumentIds.length - left.evidenceDocumentIds.length,
  );
  const consumedSourceIds = new Set<string>();

  for (const anchorBundle of sortedBundles) {
    if (consumedSourceIds.has(anchorBundle.id) || anchorBundle.bundleKind !== "standard") {
      continue;
    }

    const anchorHint = getBundleStructuredHint(anchorBundle, structuredHintLookup);

    if (!anchorHint?.projectName) {
      continue;
    }

    anchorBundle.name = formatStructuredBundleName(anchorHint.prefix, anchorHint.projectName);
    anchorBundle.eventType = getStructuredEventType(anchorHint.prefix);
    anchorBundle.keywords = uniqueMergedValues(anchorBundle.keywords, [
      anchorHint.prefix,
      anchorHint.projectName,
      ...anchorHint.aliases,
    ]);

    const anchorAliases = uniqueMergedValues([
      anchorHint.projectName,
      ...anchorHint.aliases,
    ]).map(normalizePhrase);
    const anchorKey = `${anchorHint.prefix}::${normalizePhrase(anchorHint.projectName)}`;

    for (const sourceBundle of sortedBundles) {
      if (
        sourceBundle.id === anchorBundle.id ||
        consumedSourceIds.has(sourceBundle.id) ||
        sourceBundle.bundleKind !== "standard"
      ) {
        continue;
      }

      const sourceHint = getBundleStructuredHint(sourceBundle, structuredHintLookup);

      if (sourceHint?.projectName) {
        const sourceKey = `${sourceHint.prefix}::${normalizePhrase(sourceHint.projectName)}`;

        if (sourceKey !== anchorKey) {
          continue;
        }

        anchorBundle.evidenceDocumentIds = uniqueMergedValues(
          anchorBundle.evidenceDocumentIds,
          sourceBundle.evidenceDocumentIds,
        );
        anchorBundle.organizations = uniqueMergedValues(
          anchorBundle.organizations,
          sourceBundle.organizations,
        );
        anchorBundle.people = uniqueMergedValues(anchorBundle.people, sourceBundle.people);
        anchorBundle.keywords = uniqueMergedValues(anchorBundle.keywords, sourceBundle.keywords, [
          sourceHint.prefix,
          sourceHint.projectName,
          ...sourceHint.aliases,
        ]);
        consumedSourceIds.add(sourceBundle.id);
        continue;
      }

      const haystack = normalizePhrase(
        [
          sourceBundle.name,
          sourceBundle.eventType,
          sourceBundle.keywords.join(" "),
          sourceBundle.organizations.join(" "),
          sourceBundle.people.join(" "),
        ].join(" "),
      );

      const aliasMatches = countAliasMatches(anchorAliases, haystack);

      if (aliasMatches === 0) {
        continue;
      }

      let score = aliasMatches * 6;
      score += countOverlap(anchorBundle.organizations, sourceBundle.organizations) * 2;
      score += countOverlap(anchorBundle.keywords, sourceBundle.keywords) * 2;

      if (isDateClose(anchorBundle.latestRelevantDate, sourceBundle.latestRelevantDate, 540)) {
        score += 1;
      }

      if (score < ROLE_ANCHOR_MERGE_THRESHOLD) {
        continue;
      }

      anchorBundle.evidenceDocumentIds = uniqueMergedValues(
        anchorBundle.evidenceDocumentIds,
        sourceBundle.evidenceDocumentIds,
      );
      anchorBundle.organizations = uniqueMergedValues(
        anchorBundle.organizations,
        sourceBundle.organizations,
      );
      anchorBundle.people = uniqueMergedValues(anchorBundle.people, sourceBundle.people);
      anchorBundle.keywords = uniqueMergedValues(anchorBundle.keywords, sourceBundle.keywords);

      if (
        anchorBundle.location === "Location not specified" &&
        sourceBundle.location !== "Location not specified"
      ) {
        anchorBundle.location = sourceBundle.location;
      }

      consumedSourceIds.add(sourceBundle.id);
    }
  }

  return sortedBundles.filter((bundle) => !consumedSourceIds.has(bundle.id));
}

function postProcessBundles(
  jobId: string,
  documents: StoredDocument[],
  rawBundles: RawBundleCandidate[],
  structuredHintLookup: Map<string, StructuredBundleHint>,
) {
  const completedDocuments = documents.filter(
    (document) =>
      document.processingStatus === "completed" && isReviewableEvidenceFile(document),
  );
  const specialDocuments = completedDocuments.filter((document) =>
    Boolean(getFilenameReviewDisposition(document.fileName)),
  );
  const specialBundles = specialDocuments.map((document) =>
    buildSpecialReviewBundle(
      document,
      getFilenameReviewDisposition(document.fileName) as "archive" | "unwanted",
    ),
  );
  const groupableDocuments = completedDocuments.filter(
    (document) => !getFilenameReviewDisposition(document.fileName),
  );
  const documentLookup = new Map(groupableDocuments.map((document) => [document.id, document]));
  const assignedDocumentIds = new Set<string>();

  const bundleCandidates = rawBundles
    .map((bundle) => {
      const uniqueDocumentIds = Array.from(
        new Set(bundle.evidenceDocumentIds.filter((documentId) => documentLookup.has(documentId))),
      ).filter((documentId) => !assignedDocumentIds.has(documentId));

      if (!uniqueDocumentIds.length) {
        return null;
      }

      uniqueDocumentIds.forEach((documentId) => assignedDocumentIds.add(documentId));

      const eventBundle: EventBundle = {
        id: crypto.randomUUID(),
        jobId,
        bundleKind: "standard",
        name: formatBundleDisplayName(
          bundle.name,
          normalizePrimaryDate(bundle.latestRelevantDate),
        ),
        shortSummary: bundle.shortSummary,
        detailedSummary: bundle.detailedSummary,
        eventType: bundle.eventType,
        latestRelevantDate: normalizePrimaryDate(bundle.latestRelevantDate),
        timeframeLabel: bundle.timeframeLabel,
        location: bundle.location,
        organizations: bundle.organizations,
        people: bundle.people,
        keywords: bundle.keywords,
        confidence: bundle.confidence,
        leadDocumentId:
          bundle.leadDocumentId && uniqueDocumentIds.includes(bundle.leadDocumentId)
            ? bundle.leadDocumentId
            : uniqueDocumentIds[0],
        evidenceDocumentIds: uniqueDocumentIds,
      };

      return eventBundle;
    })
    .filter((bundle): bundle is EventBundle => Boolean(bundle));

  const bundles: EventBundle[] = bundleCandidates;

  const unassignedDocuments = groupableDocuments.filter(
    (document) => !assignedDocumentIds.has(document.id),
  );

  const fallbackBundles = unassignedDocuments.map((document) => buildFallbackBundle(document));
  const normalizedBundles = mergeStructuredRoleBundles(
    mergeAuxiliaryBundles([...bundles, ...fallbackBundles]),
    structuredHintLookup,
  );

  return [...normalizedBundles, ...specialBundles].sort((left, right) => {
    if (left.latestRelevantDate && right.latestRelevantDate) {
      return right.latestRelevantDate.localeCompare(left.latestRelevantDate);
    }

    if (left.latestRelevantDate) {
      return -1;
    }

    if (right.latestRelevantDate) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

async function generateEventBundles(
  jobId: string,
  documents: StoredDocument[],
) {
  const completedDocuments = documents.filter(
    (document) =>
      document.processingStatus === "completed" && isReviewableEvidenceFile(document),
  );

  if (!completedDocuments.length) {
    return {
      bundles: [],
      usage: null,
      message: "Event bundling is waiting for completed evidence summaries.",
    };
  }

  const groupableDocuments = completedDocuments.filter(
    (document) => !getFilenameReviewDisposition(document.fileName),
  );

  if (!groupableDocuments.length) {
    const specialBundles = postProcessBundles(
      jobId,
      completedDocuments,
      [],
      buildStructuredHintLookup(completedDocuments),
    );

    return {
      bundles: specialBundles,
      usage: null,
      message: `All ${specialBundles.length} completed file(s) were routed by filename rules into Archive Category or Unwanted review.`,
    };
  }

  const { client, settings } = getOpenAiContext();
  const documentDigest = buildWorkspaceDocumentDigest(completedDocuments);
  const structuredHintLookup = buildStructuredHintLookup(completedDocuments);

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: fillPromptTemplate(settings.bundlingPrompt, {
              candidateName: settings.candidateName || "the candidate",
            }),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Workspace job ID: ${jobId}`,
              "Completed evidence documents:",
              JSON.stringify(documentDigest, null, 2),
            ].join("\n\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "event_bundle_map",
        strict: true,
        schema: eventBundleCandidateJsonSchema,
      },
    },
  });

  const parsed = eventBundleCandidateSchema.parse(
    sanitizeEventBundleCandidate(JSON.parse(response.output_text)),
  );
  const normalizedCandidates = splitStructuredRoleCandidates(
    parsed.bundles,
    structuredHintLookup,
  );
  const bundles = postProcessBundles(
    jobId,
    completedDocuments,
    normalizedCandidates,
    structuredHintLookup,
  );
  const archiveCount = bundles.filter((bundle) => bundle.bundleKind === "archive").length;
  const unwantedCount = bundles.filter((bundle) => bundle.bundleKind === "unwanted").length;
  const standardCount = bundles.length - archiveCount - unwantedCount;

  return {
    bundles,
    usage: buildTextUsage(settings.summaryModel, response.usage),
    message: `Built ${standardCount} event bundle(s) from ${completedDocuments.length} evidence file(s), plus ${archiveCount} archive and ${unwantedCount} unwanted filename-rule bundle(s).`,
  };
}

async function runWorkspaceBundlingJob(
  jobId: string,
  documents: StoredDocument[],
) {
  const fingerprint = getDocumentsFingerprint(documents);

  saveWorkspaceEventBundleState(jobId, {
    version: EVENT_BUNDLE_VERSION,
    jobId,
    status: "processing",
    message: "AI is grouping the workspace evidence into real-world events.",
    bundles: [],
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  });

  try {
    if (isJobCancellationRequested(jobId)) {
      saveWorkspaceEventBundleState(
        jobId,
        buildCanceledBundleState(
          jobId,
          documents,
          "Event bundling was canceled by the user before it could finish.",
        ),
      );
      clearJobCancellationRequest(jobId);
      return;
    }

    const result = await generateEventBundles(jobId, documents);

    if (isJobCancellationRequested(jobId)) {
      saveWorkspaceEventBundleState(
        jobId,
        buildCanceledBundleState(
          jobId,
          documents,
          "Event bundling was canceled by the user during the AI grouping pass.",
        ),
      );
      clearJobCancellationRequest(jobId);
      return;
    }

    saveWorkspaceEventBundleState(jobId, {
      version: EVENT_BUNDLE_VERSION,
      jobId,
      status: "completed",
      message: result.message,
      bundles: result.bundles,
      sourceDocumentCount: fingerprint.sourceDocumentCount,
      sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
      totalCostUsd: roundUsd(result.usage?.costUsd ?? 0),
      updatedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    saveWorkspaceEventBundleState(jobId, {
      version: EVENT_BUNDLE_VERSION,
      jobId,
      status: "failed",
      message: "Event bundling could not be completed for this workspace.",
      bundles: [],
      sourceDocumentCount: fingerprint.sourceDocumentCount,
      sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
      totalCostUsd: 0,
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown event bundling error.",
    });
  } finally {
    activeBundleJobs.delete(jobId);
  }
}

export function startWorkspaceBundlingJob(
  jobId: string,
  documents: StoredDocument[],
) {
  if (activeBundleJobs.has(jobId)) {
    return;
  }

  if (getJob(jobId)?.status === "canceled" || isJobCancellationRequested(jobId)) {
    saveWorkspaceEventBundleState(
      jobId,
      buildCanceledBundleState(
        jobId,
        documents,
        "Event bundling was canceled before it started.",
      ),
    );
    clearJobCancellationRequest(jobId);
    return;
  }

  activeBundleJobs.add(jobId);
  const fingerprint = getDocumentsFingerprint(documents);

  saveWorkspaceEventBundleState(jobId, {
    version: EVENT_BUNDLE_VERSION,
    jobId,
    status: "queued",
    message: "Event bundling is queued for this workspace.",
    bundles: [],
    sourceDocumentCount: fingerprint.sourceDocumentCount,
    sourceLatestDocumentUpdateAt: fingerprint.sourceLatestDocumentUpdateAt,
    totalCostUsd: 0,
    updatedAt: new Date().toISOString(),
    error: null,
  });

  setTimeout(() => {
    void runWorkspaceBundlingJob(jobId, documents);
  }, 0);
}

export function ensureWorkspaceEventBundles(
  jobId: string,
  documents: StoredDocument[],
) {
  const storedState = getStoredWorkspaceEventBundleState(jobId);
  const job = getJob(jobId);

  if (job?.status === "canceled") {
    return (
      storedState ??
      buildCanceledBundleState(
        jobId,
        documents,
        "Event bundling was canceled for this workspace.",
      )
    );
  }

  if (
    job?.status === "queued" ||
    job?.status === "processing" ||
    job?.status === "canceling"
  ) {
    return (
      storedState ??
      buildSyntheticBundleState(
        jobId,
        documents,
        job.status === "canceling"
          ? "Event bundling is waiting for the cancellation request to finish."
          : "Event bundling will start after document indexing completes.",
      )
    );
  }

  if (
    !documents.some(
      (document) =>
        document.processingStatus === "completed" && isReviewableEvidenceFile(document),
    )
  ) {
    return (
      storedState ??
      buildSyntheticBundleState(
        jobId,
        documents,
        "Event bundling will start after at least one document has been summarized.",
      )
    );
  }

  if (
    storedState?.status === "failed" ||
    (!storedState || storedState.status !== "canceled") &&
      !isBundleStateCurrent(storedState, documents)
  ) {
    startWorkspaceBundlingJob(jobId, documents);

    return (
      getStoredWorkspaceEventBundleState(jobId) ??
      buildSyntheticBundleState(
        jobId,
        documents,
        "Event bundling has been queued for this workspace.",
      )
    );
  }

  return storedState;
}
