import { EB1A_CRITERIA } from "@/lib/constants";
import { normalizePrimaryDate } from "@/lib/date";
import { documentSummaryJsonSchema, documentSummarySchema } from "@/lib/document-schema";
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
