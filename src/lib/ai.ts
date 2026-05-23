import {
  EB1A_CRITERIA,
  EB1A_CRITERIA_CATALOG,
  EB1A_CRITERIA_DEFINITIONS,
} from "@/lib/constants";
import {
  criteriaTaggingJsonSchema,
  criteriaTaggingSchema,
} from "@/lib/criteria-tagging-schema";
import { normalizePrimaryDate } from "@/lib/date";
import { documentSummaryJsonSchema, documentSummarySchema } from "@/lib/document-schema";
import {
  buildFolderContextText,
  getFolderSignalPolicyInstruction,
} from "@/lib/folder-context";
import type { PreparedDocumentInput } from "@/lib/file-processing";
import { sanitizeDocument } from "@/lib/library";
import { getOpenAiContext } from "@/lib/openai";
import {
  calculateEmbeddingCost,
  calculateTextModelCost,
} from "@/lib/openai-pricing";
import { fillPromptTemplate } from "@/lib/prompt-library";
import { ensureQdrantCollection, searchDocuments } from "@/lib/qdrant";
import type {
  DocumentSummaryPayload,
  DocumentUsage,
  EmbeddingModelUsage,
  EvidenceCriterionTag,
  EvidenceReviewStatus,
  SearchResult,
  StoredDocument,
  TextModelUsage,
} from "@/lib/types";

function buildImageInput(promptBody: string) {
  const lastLineIndex = promptBody.lastIndexOf("\n");
  const metadataText = promptBody.slice(0, lastLineIndex).trim();
  const imageUrl = promptBody.slice(lastLineIndex + 1).trim();

  return [
    {
      type: "input_text" as const,
      text: metadataText,
    },
    {
      type: "input_image" as const,
      image_url: imageUrl,
      detail: "high" as const,
    },
  ];
}

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

function normalizeLooseText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function candidateNameLikelyMismatch(document: StoredDocument) {
  const candidate = normalizeLooseText(document.candidateName);

  if (!candidate) {
    return false;
  }

  const supportingText = normalizeLooseText(
    [
      document.fileName,
      document.relativePath,
      document.summary?.title ?? "",
      document.summary?.shortSummary ?? "",
      document.summary?.detailedSummary ?? "",
      ...(document.summary?.people ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!supportingText) {
    return false;
  }

  if (supportingText.includes(candidate)) {
    return false;
  }

  const candidateTokens = candidate.split(" ").filter((token) => token.length >= 3);
  if (candidateTokens.length > 0 && candidateTokens.every((token) => supportingText.includes(token))) {
    return false;
  }

  return (document.summary?.people?.length ?? 0) > 0;
}

function inferFallbackCriteriaTags(document: StoredDocument) {
  const combinedText = normalizeLooseText(
    [
      document.fileName,
      document.relativePath,
      document.summary?.title ?? "",
      document.summary?.shortSummary ?? "",
      document.summary?.detailedSummary ?? "",
      document.summary?.documentType ?? "",
      ...(document.summary?.tags ?? []),
      ...(document.summary?.possibleCriteria ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
  const taggedAt = new Date().toISOString();
  const inferred: EvidenceCriterionTag[] = [];
  const definitionLookup = new Map<
    EvidenceCriterionTag["code"],
    (typeof EB1A_CRITERIA_DEFINITIONS)[number]
  >(
    EB1A_CRITERIA_DEFINITIONS.map((criterion) => [
      criterion.code as EvidenceCriterionTag["code"],
      criterion,
    ]),
  );

  function pushTag(
    code: EvidenceCriterionTag["code"],
    role: "primary" | "supporting",
    reasoning: string,
  ) {
    const definition = definitionLookup.get(code);
    if (!definition || inferred.some((tag) => tag.code === code)) {
      return;
    }

    inferred.push({
      code: definition.code,
      legalCode: definition.legalCode,
      name: definition.name,
      role,
      source: "ai",
      confidence: role === "primary" ? 0.61 : 0.52,
      reasoning,
      taggedAt,
    });
  }

  if (/\b(award|honor|prize|medal|recognition|certificate of appreciation|certificate of achievement)\b/.test(combinedText)) {
    pushTag(
      "01",
      "primary",
      "Heuristic fallback: the file path and summary contain obvious award or recognition language.",
    );
  }

  if (/\b(membership|member|senior member|fellow|invitation to join|elected member)\b/.test(combinedText)) {
    pushTag(
      "02",
      "primary",
      "Heuristic fallback: the file path and summary contain obvious membership language.",
    );
  }

  if (/\b(authorship|author|publication|publications|journal|conference paper|paper list|selected publications|book chapter)\b/.test(combinedText)) {
    pushTag(
      "06",
      "primary",
      "Heuristic fallback: the file path and summary contain obvious authorship or publication language.",
    );
  }

  return inferred;
}

function sanitizeSummaryCandidate(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

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
  };
}

function sanitizeCriteriaTaggingCandidate(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    criteria: Array.isArray(value.criteria)
      ? value.criteria
          .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
          .map((entry) => ({
            code: clampString(entry.code, 8),
            role: entry.role === "supporting" ? "supporting" : "primary",
            confidence:
              typeof entry.confidence === "number"
                ? Math.max(0, Math.min(1, entry.confidence))
                : 0,
            reasoning: clampString(entry.reasoning, 400, "Reasoning unavailable."),
          }))
      : [],
    keepSuggestion:
      value.keepSuggestion === "pending" || value.keepSuggestion === "archived"
        ? value.keepSuggestion
        : "kept",
    keepReason: clampString(value.keepReason, 300, "No keep/archive reason was returned."),
  };
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

function buildEmbeddingUsage(
  model: string,
  usage:
    | {
        prompt_tokens?: number | null;
        total_tokens?: number | null;
      }
    | null
    | undefined,
): EmbeddingModelUsage | null {
  if (!usage) {
    return null;
  }

  const inputTokens = usage.prompt_tokens ?? usage.total_tokens ?? 0;

  return {
    model,
    inputTokens,
    totalTokens: usage.total_tokens ?? inputTokens,
    costUsd: calculateEmbeddingCost({
      model,
      inputTokens,
    }),
  };
}

function combineUsage(
  summaryUsage: TextModelUsage | null,
  embeddingUsage: EmbeddingModelUsage | null,
): DocumentUsage {
  const total =
    (summaryUsage?.costUsd ?? 0) + (embeddingUsage?.costUsd ?? 0);

  return {
    summary: summaryUsage,
    embedding: embeddingUsage,
    totalCostUsd: total ? Math.round(total * 1_000_000) / 1_000_000 : 0,
    currency: "USD",
    calculatedAt: new Date().toISOString(),
  };
}

function buildEmbeddingText(summary: DocumentSummaryPayload, preparedInput: PreparedDocumentInput) {
  return [
    summary.title,
    summary.shortSummary,
    summary.detailedSummary,
    summary.evidenceValue,
    summary.recommendedUse,
    summary.primaryDate || "",
    summary.primaryDateReason,
    summary.notableFacts.join("\n"),
    summary.people.join(", "),
    summary.organizations.join(", "),
    summary.dates.join(", "),
    summary.tags.join(", "),
    summary.possibleCriteria.join(", "),
    preparedInput.preview,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function summarizeDocument(
  document: StoredDocument,
  preparedInput: PreparedDocumentInput,
): Promise<{
  summary: DocumentSummaryPayload;
  usage: DocumentUsage;
}> {
  const { client, settings } = getOpenAiContext();
  const candidateLabel = document.candidateName.trim() || "the candidate";
  const promptLibraryInstructions = fillPromptTemplate(settings.summaryPrompt, {
    candidateName: candidateLabel,
    criteriaList: EB1A_CRITERIA.join(", "),
  });

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              promptLibraryInstructions,
              `Candidate context: ${candidateLabel}.`,
              "Return strict JSON only.",
              "Never invent details. If the evidence is ambiguous or incomplete, say so in missingContext and lower confidence.",
              "If the document includes multiple dates, primaryDate must be the latest date clearly tied to the document's subject or event, such as the latest relevant email in a thread.",
              "Do not choose scan timestamps, print dates, or file-system dates unless they are clearly the subject-relevant date.",
              "primaryDate must be an ISO date string in YYYY-MM-DD when the exact day is knowable, otherwise null.",
              "primaryDateReason should briefly explain why that latest date was chosen.",
              "possibleCriteria must be an empty array at this stage.",
            ].join(" "),
          },
        ],
      },
      {
        role: "user",
        content:
          preparedInput.extractionMethod === "vision"
            ? buildImageInput(`Candidate name: ${candidateLabel}\n\n${preparedInput.promptBody}`)
            : [
                {
                  type: "input_text",
                  text: `Candidate name: ${candidateLabel}\n\n${preparedInput.promptBody}`,
                },
              ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "eb1a_document_summary",
        strict: true,
        schema: documentSummaryJsonSchema,
      },
    },
  });

  const parsed = documentSummarySchema.parse(
    sanitizeSummaryCandidate(JSON.parse(response.output_text)),
  );
  parsed.primaryDate = normalizePrimaryDate(parsed.primaryDate);

  if (preparedInput.extractionMethod === "filename_only") {
    parsed.confidence = Math.min(parsed.confidence, 42);
  }

  if (!parsed.tags.includes(document.extension.replace(".", "").toUpperCase())) {
    parsed.tags.unshift(document.extension.replace(".", "").toUpperCase() || "FILE");
  }

  return {
    summary: parsed,
    usage: combineUsage(buildTextUsage(settings.summaryModel, response.usage), null),
  };
}

export async function tagDocumentCriteria(input: {
  document: StoredDocument;
  bundleContext: string;
  classificationContext: string;
}) {
  const { client, settings } = getOpenAiContext();
  const candidateLabel = input.document.candidateName.trim() || "the candidate";
  const folderContext = buildFolderContextText(
    input.document.relativePath,
    input.document.folderLabel,
  );
  const promptInstructions = fillPromptTemplate(settings.taggingPrompt, {
    candidateName: candidateLabel,
    criteriaCatalog: EB1A_CRITERIA_CATALOG,
    bundleContext: input.bundleContext,
    folderContext,
    documentSummary: [
      input.document.summary?.title ?? input.document.fileName,
      input.document.summary?.shortSummary ?? "",
      input.document.summary?.detailedSummary ?? "",
      input.document.summary?.evidenceValue ?? "",
      input.document.summary?.recommendedUse ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  });

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              promptInstructions,
              getFolderSignalPolicyInstruction(settings.folderSignalPolicy),
              `Candidate context: ${candidateLabel}.`,
              `Current bundle classification context: ${input.classificationContext}.`,
              "Return strict JSON only.",
              "Keep suggestions must use exactly kept, pending, or archived.",
              "Only tag criteria that this one file directly supports.",
            ].join(" "),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                fileName: input.document.fileName,
                relativePath: input.document.relativePath,
                folderContext,
                documentType: input.document.summary?.documentType ?? input.document.extension,
                title: input.document.summary?.title ?? input.document.fileName,
                shortSummary: input.document.summary?.shortSummary ?? "",
                detailedSummary: input.document.summary?.detailedSummary ?? "",
                notableFacts: input.document.summary?.notableFacts ?? [],
                tags: input.document.summary?.tags ?? [],
                people: input.document.summary?.people ?? [],
                organizations: input.document.summary?.organizations ?? [],
                latestDate: input.document.summary?.primaryDate ?? null,
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "eb1a_criteria_tagging",
        strict: true,
        schema: criteriaTaggingJsonSchema,
      },
    },
  });

  const parsed = criteriaTaggingSchema.parse(
    sanitizeCriteriaTaggingCandidate(JSON.parse(response.output_text)),
  );
  const criterionLookup = new Map<string, (typeof EB1A_CRITERIA_DEFINITIONS)[number]>(
    EB1A_CRITERIA_DEFINITIONS.map((criterion) => [criterion.code, criterion]),
  );
  const taggedAt = new Date().toISOString();
  const criteriaTags: EvidenceCriterionTag[] = parsed.criteria.reduce<EvidenceCriterionTag[]>(
    (accumulator, criterion) => {
      const definition = criterionLookup.get(criterion.code);

      if (!definition) {
        return accumulator;
      }

      accumulator.push({
        code: definition.code,
        legalCode: definition.legalCode,
        name: definition.name,
        role: criterion.role,
        source: "ai",
        confidence: criterion.confidence,
        reasoning: criterion.reasoning,
        taggedAt,
      });

      return accumulator;
    },
    [],
  );

  const keepSuggestion = parsed.keepSuggestion as EvidenceReviewStatus;
  const heuristicTags = inferFallbackCriteriaTags(input.document);
  const hasCandidateMismatch = candidateNameLikelyMismatch(input.document);
  const shouldEscalateForReview =
    hasCandidateMismatch || (keepSuggestion === "archived" && criteriaTags.length === 0 && heuristicTags.length > 0);
  const effectiveCriteriaTags = criteriaTags.length > 0 ? criteriaTags : heuristicTags;
  const effectiveReviewStatus = hasCandidateMismatch
    ? "pending"
    : shouldEscalateForReview && keepSuggestion === "archived"
      ? "pending"
      : keepSuggestion;
  const effectiveReviewReason = hasCandidateMismatch
    ? `Setu paused because this file appears to describe a different subject than ${candidateLabel}; human review is required before archiving or keeping it.`
    : shouldEscalateForReview && heuristicTags.length > 0
      ? "Setu found obvious criterion cues in this file and sent it to human review instead of silently archiving it."
      : parsed.keepReason;

  return {
    criteriaTags: effectiveCriteriaTags,
    reviewStatus: effectiveReviewStatus,
    reviewStatusReason: effectiveReviewReason,
    usage: combineUsage(buildTextUsage(settings.summaryModel, response.usage), null),
  };
}

export async function buildDocumentVector(
  document: Pick<StoredDocument, "candidateName">,
  summary: DocumentSummaryPayload,
  preparedInput: PreparedDocumentInput,
) {
  const { client, settings } = getOpenAiContext();
  await ensureQdrantCollection(settings.embeddingDimensions);
  const response = await client.embeddings.create({
    model: settings.embeddingModel,
    input: [
      document.candidateName.trim(),
      buildEmbeddingText(summary, preparedInput),
    ]
      .filter(Boolean)
      .join("\n"),
    dimensions: settings.embeddingDimensions,
  });

  return {
    vector: response.data[0]?.embedding ?? [],
    usage: combineUsage(null, buildEmbeddingUsage(settings.embeddingModel, response.usage)),
  };
}

export function mergeDocumentUsage(
  summaryUsage: DocumentUsage,
  embeddingUsage: DocumentUsage,
): DocumentUsage {
  return combineUsage(summaryUsage.summary, embeddingUsage.embedding);
}

export async function buildQueryVector(query: string) {
  const { client, settings } = getOpenAiContext();
  await ensureQdrantCollection(settings.embeddingDimensions);
  const response = await client.embeddings.create({
    model: settings.embeddingModel,
    input: query,
    dimensions: settings.embeddingDimensions,
  });

  return response.data[0]?.embedding ?? [];
}

export async function semanticSearch(
  query: string,
  limit = 18,
  jobId?: string | null,
): Promise<SearchResult[]> {
  const queryVector = await buildQueryVector(query);
  const matches = await searchDocuments(queryVector, limit, jobId);

  return matches.map((match) => ({
    ...sanitizeDocument(match.document),
    score: match.score,
  }));
}
