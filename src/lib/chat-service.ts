import crypto from "node:crypto";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import { buildQueryVector } from "@/lib/ai";
import {
  applyCitationContractToDraft,
  applyCitationContractToStressTest,
  applyCitationContractToStrategy,
  applyCitationContractToTriage,
} from "@/lib/chat-citation";
import { classifyChatMode } from "@/lib/chat-classifier";
import {
  briefDraftJsonSchema,
  briefDraftSchema,
  collectClientReviewSets,
  normalizeBriefDraft,
  normalizeStrategyMemo,
  normalizeStressTestReport,
  normalizeTriageAnswer,
  strategyMemoJsonSchema,
  strategyMemoSchema,
  stressTestReportJsonSchema,
  stressTestReportSchema,
  triageAnswerJsonSchema,
  triageAnswerSchema,
} from "@/lib/chat-modes";
import { runGenericProseCheck } from "@/lib/draft-prose-check";
import { draftVersionFromBriefDraft } from "@/lib/drafts";
import {
  getLatestStrategyMemo,
  saveLatestStrategyMemo,
  saveLatestStressTestReport,
} from "@/lib/chat-state";
import {
  renderDraftPrompt,
  renderStrategyPrompt,
  renderStressTestPrompt,
  renderTriagePrompt,
} from "@/lib/chat-prompts";
import { buildLibrarySnapshot } from "@/lib/library";
import { getLockedStrategy } from "@/lib/lock";
import { getCriterionPinboard } from "@/lib/pinboards";
import { getChatReadiness } from "@/lib/chat-readiness";
import { getOpenAiContext } from "@/lib/openai";
import { calculateTextModelCost } from "@/lib/openai-pricing";
import { searchDocumentsAcrossWorkspaces } from "@/lib/qdrant";
import { selectStyleExemplars } from "@/lib/style-profiles";
import { generateSynthesisVersion } from "@/lib/synthesis-service";
import type {
  BriefDraft,
  ChatMode,
  ChatMessageCitation,
  ChatResponse,
  SynthesisChatDraft,
  SynthesisSectionKind,
  ChatTurn,
  ClientDocument,
  LibrarySnapshot,
  ModeClassification,
  StressTestReport,
  StrategyMemo,
  TriageAnswer,
} from "@/lib/types";

function buildUsageCost(
  model: string,
  usage:
    | {
        input_tokens?: number | null;
        output_tokens?: number | null;
        input_tokens_details?: {
          cached_tokens?: number | null;
        } | null;
      }
    | null
    | undefined,
) {
  return (
    calculateTextModelCost({
      model,
      inputTokens: usage?.input_tokens ?? 0,
      cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
    }) ?? 0
  );
}

function parseOutputJson(outputText: string) {
  try {
    return JSON.parse(outputText) as Record<string, unknown>;
  } catch {
    throw new Error("Setu received a malformed model response and could not parse it.");
  }
}

function candidateName(snapshot: LibrarySnapshot) {
  return snapshot.activeClient?.displayName || snapshot.settings.candidateName || "the client";
}

function workspaceScopeLabel(snapshot: LibrarySnapshot) {
  return `${snapshot.clientWorkspaces.length} workspaces`;
}

function criterionMeta(code: string) {
  return (
    EB1A_CRITERIA_DEFINITIONS.find((criterion) => criterion.code === code) ?? {
      code,
      legalCode: code,
      name: code,
      folderName: code,
    }
  );
}

function stripExhibitPrefix(label: string) {
  return label.replace(/^Ex\.\s*/i, "").trim();
}

function finishSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function exhibitLabelLookup(input: {
  lockedEntry: NonNullable<ReturnType<typeof getLockedStrategy>>["primary"][number];
  pinboardEntries: Array<{ documentId: string; exhibitLabel: string }>;
}) {
  const map = new Map<string, string>();
  input.lockedEntry.anchorExhibits.forEach((assignment) => {
    map.set(assignment.documentId, assignment.exhibitLabel);
  });
  input.pinboardEntries.forEach((entry) => {
    map.set(entry.documentId, entry.exhibitLabel);
  });
  return map;
}

function applyExhibitLabelsToDraft(
  draft: BriefDraft,
  exhibitLookup: Map<string, string>,
) {
  return {
    ...draft,
    paragraphs: draft.paragraphs.map((paragraph) => {
      const mappedRefs = paragraph.exhibitRefs
        .map((reference) => {
          const mapped = exhibitLookup.get(reference);
          if (mapped) {
            return stripExhibitPrefix(mapped);
          }
          const stripped = stripExhibitPrefix(reference);
          return /^\d+[A-Z]?$/i.test(stripped) ? stripped : null;
        })
        .filter((reference): reference is string => Boolean(reference))
        .filter(Boolean);
      const fallbackRefs = paragraph.citations
        .map((citation) => exhibitLookup.get(citation.docId))
        .filter((label): label is string => Boolean(label))
        .map((label) => stripExhibitPrefix(label));
      const exhibitRefs = [...new Set([...mappedRefs, ...fallbackRefs])];

      return {
        ...paragraph,
        exhibitRefs,
      };
    }),
  };
}

function draftSupportText(document: ClientDocument) {
  return (
    document.summary?.shortSummary ||
    document.summary?.notableFacts.find(Boolean) ||
    document.summary?.detailedSummary ||
    document.summary?.title ||
    document.fileName
  );
}

function firstSummarySentence(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/(.+?[.!?])(\s|$)/);
  return (match?.[1] || trimmed).trim();
}

function buildConservativeCriterionDraft(input: {
  clientId: string;
  criterionCode: string;
  criterionName: string;
  lockedEntry: NonNullable<ReturnType<typeof getLockedStrategy>>["primary"][number];
  pinboardEntries: Array<{ documentId: string; exhibitLabel: string }>;
  documents: ClientDocument[];
}) {
  const exhibitLookup = exhibitLabelLookup({
    lockedEntry: input.lockedEntry,
    pinboardEntries: input.pinboardEntries,
  });
  const anchoredDocuments = dedupeDocuments(
    [
      ...input.lockedEntry.anchorDocIds
        .map((documentId) => input.documents.find((document) => document.id === documentId) ?? null)
        .filter((document): document is ClientDocument => Boolean(document)),
      ...input.documents.filter((document) => exhibitLookup.has(document.id)),
    ],
  );

  const selectedDocuments = anchoredDocuments.length
    ? anchoredDocuments.slice(0, 3)
    : input.documents.slice(0, 2);

  const paragraphs = selectedDocuments.map((document, index) => {
    const exhibitLabel = stripExhibitPrefix(
      exhibitLookup.get(document.id) || input.lockedEntry.anchorExhibits[index]?.exhibitLabel || `Ex. ${index + 1}`,
    );
    const support = finishSentence(draftSupportText(document));
    const descriptiveContext = firstSummarySentence(document.summary?.detailedSummary);
    const context =
      descriptiveContext && descriptiveContext !== support
        ? finishSentence(descriptiveContext)
        : `This exhibit is part of the locked ${input.criterionName} record.`;

    return {
      text: `${support} ${context} (Ex. ${exhibitLabel}).`.replace(/\s+\(Ex\./, " (Ex."),
      exhibitRefs: [exhibitLabel],
      citations: [
        {
          docId: document.id,
          supports: support,
        },
      ],
    };
  });

  return {
    schemaVersion: "brief-draft/2.0" as const,
    clientId: input.clientId,
    createdAt: new Date().toISOString(),
    section: "criterion-argument" as const,
    targetCriterionCode: input.criterionCode,
    title: `${input.lockedEntry.legalCode} ${input.criterionName}`,
    paragraphs,
    wordCount: paragraphs.reduce(
      (sum, paragraph) => sum + paragraph.text.trim().split(/\s+/).filter(Boolean).length,
      0,
    ),
  };
}

function dedupeDocuments(documents: ClientDocument[]) {
  const seen = new Set<string>();
  return documents.filter((document) => {
    if (seen.has(document.id)) {
      return false;
    }
    seen.add(document.id);
    return true;
  });
}

async function retrieveCriterionDocuments(input: {
  snapshot: LibrarySnapshot;
  criterionCode: string;
  query: string;
  pinnedDocIds: string[];
}) {
  const reviewSets = collectClientReviewSets(input.snapshot);
  const reviewableById = new Map(
    reviewSets.reviewableDocuments.map((document) => [document.id, document]),
  );
  const criterionTagged = reviewSets.reviewableDocuments.filter((document) =>
    document.criteriaTags.some((tag) => tag.code === input.criterionCode),
  );
  const pinnedDocuments = input.pinnedDocIds
    .map((docId) => reviewableById.get(docId) ?? null)
    .filter((document): document is ClientDocument => Boolean(document));

  if (!reviewSets.workspaceIds.length) {
    return {
      documents: dedupeDocuments([...pinnedDocuments, ...criterionTagged]).slice(0, 12),
      retrievalCostUsd: 0,
    };
  }

  const queryVector = await buildQueryVector(input.query);
  const matches = await searchDocumentsAcrossWorkspaces(queryVector, 24, reviewSets.workspaceIds);
  const semanticMatches = matches
    .map((match) => match.document)
    .filter(
      (document) =>
        reviewableById.has(document.id) &&
        document.criteriaTags.some((tag) => tag.code === input.criterionCode),
    );

  return {
    documents: dedupeDocuments([...pinnedDocuments, ...semanticMatches, ...criterionTagged]).slice(0, 12),
    retrievalCostUsd: 0,
  };
}

function buildPinnedExhibitsBlock(
  pinnedEntries: Array<{ exhibitLabel: string; documentId: string; workspaceId: string }>,
  documentLookup: Map<string, ClientDocument>,
) {
  if (!pinnedEntries.length) {
    return "No pinned exhibits are currently assigned to this criterion.";
  }

  return pinnedEntries
    .map((entry, index) => {
      const document = documentLookup.get(entry.documentId);
      return `${index + 1}. ${entry.exhibitLabel} :: ${document?.summary?.title || document?.fileName || entry.documentId}`;
    })
    .join("\n");
}

function buildCriterionStrategyBlock(clientId: string, criterionCode: string, strategyMemo: StrategyMemo | null) {
  const lockedStrategy = getLockedStrategy(clientId);
  const lockedEntry = [...(lockedStrategy?.primary ?? []), ...(lockedStrategy?.supporting ?? [])].find(
    (entry) => entry.criterionCode === criterionCode,
  );
  const memoEntry =
    strategyMemo?.recommendedMix.primary.find((entry) => entry.criterionCode === criterionCode) ??
    strategyMemo?.recommendedMix.supporting.find((entry) => entry.criterionCode === criterionCode) ??
    null;

  return JSON.stringify({
    criterionCode,
    lockedCriterion: lockedEntry
      ? {
          legalCode: lockedEntry.legalCode,
          criterionName: lockedEntry.criterionName,
          rationale: lockedEntry.rationale,
          anchorDocIds: lockedEntry.anchorDocIds,
          anchorExhibits: lockedEntry.anchorExhibits.map((assignment) => assignment.exhibitLabel),
        }
      : null,
    strategyMemoRecommendation: memoEntry,
    narrativeSpine: strategyMemo?.leadArgument?.criterionCode === criterionCode
      ? strategyMemo.leadArgument.narrativeSpine
      : lockedStrategy?.narrativeSpine ?? null,
  });
}

function formatSynthesisTitle(kind: SynthesisSectionKind) {
  return kind === "statement-of-eligibility"
    ? "Statement of Eligibility"
    : "Final Merits Determination";
}

function buildSynthesisChatCitations(
  artifact: SynthesisChatDraft,
  snapshot: LibrarySnapshot,
): ChatMessageCitation[] {
  const documentLookup = new Map(
    snapshot.clientDocuments.map((document) => [document.id, document]),
  );
  const seen = new Set<string>();

  return artifact.paragraphs.flatMap((paragraph) =>
    paragraph.citations.flatMap((citation) => {
      if (!citation.docId) {
        return [];
      }

      const document = documentLookup.get(citation.docId);
      if (!document) {
        return [];
      }

      const key = `${citation.docId}:${citation.supports}`;
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);

      return [
        {
          docId: citation.docId,
          workspaceId: document.jobId,
          excerpt: citation.excerpt || citation.supports,
          supports: citation.supports,
          label:
            paragraph.exhibitRefs[0] ||
            document.summary?.title ||
            document.fileName,
        },
      ];
    }),
  );
}

export async function generateClientBriefDraft(input: {
  clientId: string;
  criterionCode: string;
  message?: string;
  snapshot?: LibrarySnapshot;
  sectionKey?: string;
}) {
  const snapshot = input.snapshot ?? (await buildLibrarySnapshot({ clientId: input.clientId }));
  const readiness = getChatReadiness(snapshot);
  if (!readiness.ready) {
    throw new Error(readiness.reason || "This client is not ready for drafting yet.");
  }

  const lockedStrategy = getLockedStrategy(input.clientId);
  if (!lockedStrategy) {
    throw new Error("Drafting is only available after the case theory is locked.");
  }

  const lockedEntry = [...lockedStrategy.primary, ...lockedStrategy.supporting].find(
    (entry) => entry.criterionCode === input.criterionCode,
  );
  if (!lockedEntry) {
    throw new Error(`Criterion ${input.criterionCode} is not part of the locked case theory.`);
  }

  const strategyMemo = getLatestStrategyMemo(input.clientId);
  const pinboard = getCriterionPinboard(input.clientId, input.criterionCode);
  const pinnedDocIds = pinboard?.entries.map((entry) => entry.documentId) ?? [];
  const criterion = criterionMeta(input.criterionCode);
  const retrieval = await retrieveCriterionDocuments({
    snapshot,
    criterionCode: input.criterionCode,
    query:
      input.message ||
      `Draft an EB-1A criterion argument for ${criterion.name} using the strongest pinned exhibits and supporting evidence.`,
    pinnedDocIds,
  });

  if (!retrieval.documents.length) {
    throw new Error(
      `Criterion ${criterion.legalCode} has no kept or pending documents tagged. Draft is not possible until evidence is tagged for this criterion.`,
    );
  }

  const { client, settings } = getOpenAiContext();
  const { profile, exemplars } = selectStyleExemplars(
    settings.activeStyleProfileId,
    input.criterionCode,
  );
  const exhibitLookup = exhibitLabelLookup({
    lockedEntry,
    pinboardEntries: pinboard?.entries ?? [],
  });
  const documentLookup = new Map(
    snapshot.clientDocuments.map((document) => [document.id, document]),
  );
  let totalCostUsd = retrieval.retrievalCostUsd;
  let lastDraftError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const attemptMessage =
      attempt === 1
        ? input.message || `Draft the ${criterion.legalCode} ${criterion.name} argument for this client.`
        : `${input.message || `Redraft the ${criterion.legalCode} ${criterion.name} argument for this client.`}\n\nRevision instruction: stay closer to the cited source language, avoid exclusivity or superlatives unless they appear in evidence, and keep each paragraph tightly grounded in a specific exhibit.`;

    try {
      const response = await client.responses.create({
        model: settings.summaryModel,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: renderDraftPrompt({
                  template: settings.draftPrompt,
                  candidateName: candidateName(snapshot),
                  sectionKey:
                    input.sectionKey ||
                    "Open with the criterion standard, then make the claim, then develop it with 2-4 evidence-led paragraphs, and end with a concise criterion conclusion.",
                  criterionCode: input.criterionCode,
                  strategyMemo,
                  documents: retrieval.documents,
                  pinnedExhibitsBlock: buildPinnedExhibitsBlock(pinboard?.entries ?? [], documentLookup),
                  styleExemplars: exemplars,
                }),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: attemptMessage,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "setu_brief_draft",
            strict: true,
            schema: briefDraftJsonSchema,
          },
        },
      });

      const modelCostUsd = buildUsageCost(settings.summaryModel, response.usage);
      totalCostUsd += modelCostUsd;
      const parsed = briefDraftSchema.parse(parseOutputJson(response.output_text));
      const normalized = normalizeBriefDraft(parsed, retrieval.documents);
      const citationChecked = applyCitationContractToDraft(normalized, retrieval.documents);
      const proseCheck = runGenericProseCheck(
        citationChecked.draft.paragraphs.map((paragraph) => ({ text: paragraph.text })),
      );

      if (
        citationChecked.draft.paragraphs.some((paragraph) => paragraph.factCheckStatus === "drift-detected") &&
        citationChecked.draft.paragraphs.some(
          (paragraph) => paragraph.factCheckNotes?.toLowerCase().includes("significant"),
        )
      ) {
        throw new Error("Setu detected significant factual drift in the generated draft.");
      }

      const exhibitLabeledDraft = applyExhibitLabelsToDraft(citationChecked.draft, exhibitLookup);
      const enrichedDraft: BriefDraft = {
        ...exhibitLabeledDraft,
        targetCriterionCode: input.criterionCode,
        genericProseWarning: proseCheck.message,
        styleProfileId: profile.id,
        styleExemplarIds: exemplars.map((exemplar) => exemplar.id),
        retrievedDocIds: retrieval.documents.map((document) => document.id),
      };

      return {
        draft: enrichedDraft,
        citations: citationChecked.citations,
        droppedClaims: citationChecked.droppedClaims,
        costUsd: totalCostUsd,
        reasoning: `Retrieved ${retrieval.documents.length} criterion-scoped documents for ${criterion.legalCode} ${criterion.name}, plus ${pinnedDocIds.length} pinned exhibit(s), and applied the ${profile.displayName} style profile${attempt > 1 ? ` after ${attempt} drafting attempts` : ""}.`,
        pendingDisclosure:
          retrieval.documents.some((document) => document.reviewStatus === "pending")
            ? `This draft used ${retrieval.documents.filter((document) => document.reviewStatus === "pending").length} pending documents that have not yet been fully reviewed.`
            : null,
        documentLookup,
        draftVersionSeed: draftVersionFromBriefDraft(enrichedDraft, documentLookup, {
          source: "ai",
          costUsd: modelCostUsd,
          authorNotes: buildCriterionStrategyBlock(input.clientId, input.criterionCode, strategyMemo),
        }),
      };
    } catch (error) {
      lastDraftError = error instanceof Error ? error : new Error("Unable to generate a grounded draft.");
      if (attempt < 3) {
        continue;
      }
    }
  }

  const conservativeDraft = buildConservativeCriterionDraft({
    clientId: input.clientId,
    criterionCode: input.criterionCode,
    criterionName: criterion.name,
    lockedEntry,
    pinboardEntries: pinboard?.entries ?? [],
    documents: retrieval.documents,
  });
  const normalizedFallback = normalizeBriefDraft(conservativeDraft, retrieval.documents);
  const citationCheckedFallback = applyCitationContractToDraft(normalizedFallback, retrieval.documents);
  const proseCheckFallback = runGenericProseCheck(
    citationCheckedFallback.draft.paragraphs.map((paragraph) => ({ text: paragraph.text })),
  );

  const exhibitLabeledFallback = applyExhibitLabelsToDraft(citationCheckedFallback.draft, exhibitLookup);
  const enrichedFallback: BriefDraft = {
    ...exhibitLabeledFallback,
    targetCriterionCode: input.criterionCode,
    genericProseWarning: proseCheckFallback.message,
    styleProfileId: profile.id,
    styleExemplarIds: exemplars.map((exemplar) => exemplar.id),
    retrievedDocIds: retrieval.documents.map((document) => document.id),
  };

  return {
    draft: enrichedFallback,
    citations: citationCheckedFallback.citations,
    droppedClaims: citationCheckedFallback.droppedClaims,
    costUsd: totalCostUsd,
    reasoning: `Retrieved ${retrieval.documents.length} criterion-scoped documents for ${criterion.legalCode} ${criterion.name}, plus ${pinnedDocIds.length} pinned exhibit(s), and applied the ${profile.displayName} style profile. Setu fell back to a conservative evidence-led draft after stricter attempts triggered fact-check drift warnings${lastDraftError ? ` (${lastDraftError.message})` : ""}.`,
    pendingDisclosure:
      retrieval.documents.some((document) => document.reviewStatus === "pending")
        ? `This draft used ${retrieval.documents.filter((document) => document.reviewStatus === "pending").length} pending documents that have not yet been fully reviewed.`
        : null,
    documentLookup,
    draftVersionSeed: draftVersionFromBriefDraft(enrichedFallback, documentLookup, {
      source: "ai",
      costUsd: totalCostUsd,
      authorNotes: `${buildCriterionStrategyBlock(input.clientId, input.criterionCode, strategyMemo)}\n\nFallback note: conservative draft used after stronger generations triggered fact-check drift warnings.`,
    }),
  };
}

function deterministicNoEvidenceMemo(snapshot: LibrarySnapshot): StrategyMemo {
  return {
    schemaVersion: "strategy-memo/2.0",
    clientId: snapshot.activeClientId || "",
    workspaceIds: snapshot.clientWorkspaces.map((workspace) => workspace.id),
    createdAt: new Date().toISOString(),
    petitionType: "EB-1A",
    pendingDocsConsidered: 0,
    recommendedMix: {
      primary: [],
      supporting: [],
      decline: [],
    },
    leadArgument: {
      criterionCode: "none",
      narrativeSpine:
        "No evidence is currently tagged strongly enough to support a client-wide case theory yet. Continue review and tagging before strategizing.",
      anchorDocIds: [],
    },
    gaps: [
      {
        criterionCode: "none",
        type: "missing-context",
        description:
          "No evidence is tagged for any criterion strongly enough to recommend a strategy yet.",
        suggestedAdditions: ["Continue review and tagging in the client workspaces."],
      },
    ],
    risks: [],
    citations: [],
  };
}

async function callStructuredModel<T>(input: {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
}) {
  const { client, settings } = getOpenAiContext();
  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: input.systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: input.userPrompt }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        strict: true,
        schema: input.schema,
      },
    },
  });

  return {
    payload: parseOutputJson(response.output_text) as T,
    costUsd: buildUsageCost(settings.summaryModel, response.usage),
    model: settings.summaryModel,
  };
}

async function retrieveClientDocumentsByMeaning(
  snapshot: LibrarySnapshot,
  message: string,
) {
  const { reviewableDocuments, workspaceIds } = collectClientReviewSets(snapshot);

  if (!workspaceIds.length) {
    return {
      documents: [] as ClientDocument[],
      excludedReason: {} as Record<string, string>,
      retrievalCostUsd: 0,
    };
  }

  const queryVector = await buildQueryVector(message);
  const matches = await searchDocumentsAcrossWorkspaces(queryVector, 18, workspaceIds);
  const allowedIds = new Set(reviewableDocuments.map((document) => document.id));
  const excludedReason: Record<string, string> = {};

  const documents = matches
    .map((match) => match.document)
    .filter((document) => {
      if (allowedIds.has(document.id)) {
        return true;
      }

      excludedReason[document.id] =
        document.reviewStatus === "archived"
          ? "Archived documents are excluded from chat retrieval."
          : "Document is not eligible for review retrieval.";
      return false;
    });

  return {
    documents,
    excludedReason,
    retrievalCostUsd: 0,
  };
}

export async function generateClientStrategyMemo(clientId: string, snapshotInput?: LibrarySnapshot) {
  const snapshot = snapshotInput ?? (await buildLibrarySnapshot({ clientId }));
  const readiness = getChatReadiness(snapshot);

  if (!readiness.ready) {
    throw new Error(readiness.reason || "This client is not ready for strategy yet.");
  }

  const { settings } = getOpenAiContext();
  const reviewSets = collectClientReviewSets(snapshot);

  if (!reviewSets.documents.some((document) => document.criteriaTags.length > 0)) {
    const memo = deterministicNoEvidenceMemo(snapshot);
    saveLatestStrategyMemo(clientId, memo);
    return {
      memo,
      citations: [],
      droppedClaims: [],
      costUsd: 0,
      reasoning:
        "Setu did not find enough tagged evidence to recommend a case theory. Continue review before strategizing.",
      pendingDisclosure: null,
      snapshot,
    };
  }

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < 3) {
    attempts += 1;
    try {
      const response = await callStructuredModel<StrategyMemo>({
        systemPrompt: renderStrategyPrompt({
          template: settings.strategyPrompt,
          candidateName: candidateName(snapshot),
          snapshot,
          keptDocuments: reviewSets.keptDocuments,
          pendingDocuments: reviewSets.pendingDocuments,
        }),
        userPrompt: `Build a client-wide EB-1A strategy memo across ${workspaceScopeLabel(snapshot)}.`,
        schemaName: "setu_strategy_memo",
        schema: strategyMemoJsonSchema,
      });

      const parsed = strategyMemoSchema.parse(response.payload);
      const normalized = normalizeStrategyMemo(parsed, reviewSets.reviewableDocuments);
      const citationChecked = applyCitationContractToStrategy(
        normalized,
        reviewSets.reviewableDocuments,
      );

      if (
        citationChecked.memo.recommendedMix.primary.length === 0 &&
        attempts < 3 &&
        reviewSets.keptDocuments.length > 0
      ) {
        continue;
      }

      saveLatestStrategyMemo(clientId, citationChecked.memo);

      return {
        memo: citationChecked.memo,
        citations: citationChecked.citations,
        droppedClaims: citationChecked.droppedClaims,
        costUsd: response.costUsd,
        reasoning: `Coverage spans ${reviewSets.keptDocuments.length} kept and ${reviewSets.pendingDocuments.length} pending documents across ${snapshot.clientWorkspaces.length} workspaces.`,
        pendingDisclosure:
          reviewSets.pendingDocuments.length > 0
            ? `Considered ${reviewSets.pendingDocuments.length} pending docs across the client while forming this memo.`
            : null,
        snapshot,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to generate strategy memo.");
    }
  }

  throw lastError ?? new Error("Unable to generate strategy memo.");
}

export async function generateClientStressTest(input: {
  clientId: string;
  snapshot?: LibrarySnapshot;
  strategyMemo?: StrategyMemo | null;
  adHocScope?: string;
}) {
  const snapshot = input.snapshot ?? (await buildLibrarySnapshot({ clientId: input.clientId }));
  const readiness = getChatReadiness(snapshot);

  if (!readiness.ready) {
    throw new Error(readiness.reason || "This client is not ready for stress-test yet.");
  }

  const { settings } = getOpenAiContext();
  const reviewSets = collectClientReviewSets(snapshot);
  const strategyMemo =
    input.strategyMemo ??
    getLatestStrategyMemo(input.clientId) ??
    (await generateClientStrategyMemo(input.clientId, snapshot)).memo;
  const primaryCodes = strategyMemo.recommendedMix.primary.map((entry) => entry.criterionCode);
  const focusDocuments =
    primaryCodes.length > 0
      ? reviewSets.reviewableDocuments.filter((document) =>
          document.criteriaTags.some((tag) => primaryCodes.includes(tag.code)),
        )
      : reviewSets.reviewableDocuments;

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < 3) {
    attempts += 1;
    try {
      const response = await callStructuredModel<StressTestReport>({
        systemPrompt: renderStressTestPrompt({
          template: settings.stressTestPrompt,
          candidateName: candidateName(snapshot),
          strategyMemo,
          adHocScope: input.adHocScope || "full-petition",
          documents: focusDocuments.slice(0, 40),
        }),
        userPrompt:
          input.adHocScope && input.adHocScope !== "full-petition"
            ? `Stress-test only this scope: ${input.adHocScope}`
            : "Stress-test the full petition strategy and surface the strongest USCIS-style challenges.",
        schemaName: "setu_stress_test",
        schema: stressTestReportJsonSchema,
      });

      const parsed = stressTestReportSchema.parse(response.payload);
      const normalized = normalizeStressTestReport(parsed, focusDocuments);
      const citationChecked = applyCitationContractToStressTest(normalized, focusDocuments);

      if (!citationChecked.report.challenges.length && attempts < 3) {
        continue;
      }

      saveLatestStressTestReport(input.clientId, citationChecked.report);

      return {
        report: citationChecked.report,
        citations: citationChecked.citations,
        droppedClaims: citationChecked.droppedClaims,
        costUsd: response.costUsd,
        reasoning: `Setu stress-tested the recommended criteria mix using ${focusDocuments.length} reviewable documents across ${snapshot.clientWorkspaces.length} workspaces.`,
        pendingDisclosure:
          reviewSets.pendingDocuments.length > 0
            ? `Considered ${reviewSets.pendingDocuments.length} pending docs while stress-testing the current theory.`
            : null,
        snapshot,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to generate stress-test report.");
    }
  }

  throw lastError ?? new Error("Unable to generate stress-test report.");
}

export async function runClientChatTurn(input: {
  clientId: string;
  message: string;
  modeHint?: ChatMode | null;
  sessionMode: ChatMode;
  criterionCode?: string | null;
  synthesisKind?: SynthesisSectionKind | null;
}) {
  const snapshot = await buildLibrarySnapshot({ clientId: input.clientId });
  const readiness = getChatReadiness(snapshot);

  if (!readiness.ready) {
    throw new Error(readiness.reason || "This client is not ready for Ask Setu.");
  }

  const classificationResult = await classifyChatMode({
    message: input.message,
    modeHint: undefined,
  });

  const classification: ModeClassification = classificationResult.classification;
  const mode = input.modeHint ?? input.sessionMode;
  const reviewSets = collectClientReviewSets(snapshot);
  const now = new Date().toISOString();

  if (mode === "triage") {
    const retrieval = await retrieveClientDocumentsByMeaning(snapshot, input.message);
    const { settings } = getOpenAiContext();
    const response = await callStructuredModel<TriageAnswer>({
      systemPrompt: renderTriagePrompt({
        template: settings.triagePrompt,
        candidateName: candidateName(snapshot),
        documents: retrieval.documents,
      }),
      userPrompt: input.message,
      schemaName: "setu_triage_answer",
      schema: triageAnswerJsonSchema,
    });
    const parsed = triageAnswerSchema.parse(response.payload);
    const normalized = normalizeTriageAnswer(parsed, retrieval.documents);
    const citationChecked = applyCitationContractToTriage(normalized, retrieval.documents);
    const text = citationChecked.answer.answer.map((block) => block.text).join("\n\n");

    const turn: ChatTurn = {
      id: crypto.randomUUID(),
      sessionId: "",
      occurredAt: now,
      userMessage: input.message,
      mode,
      modeWasProposed: classification.mode !== mode,
      retrieval: {
        docIds: retrieval.documents.map((document) => document.id),
        scope: "client",
        excludedReason: retrieval.excludedReason,
      },
      response: {
        text:
          text ||
          normalized.insufficiencyNote ||
          "Setu could not find enough grounded evidence to answer that cleanly.",
        citations: citationChecked.citations,
        reasoning: `Retrieved ${retrieval.documents.length} completed documents across ${snapshot.clientWorkspaces.length} workspaces and answered from the grounded evidence that survived citation checks.`,
        droppedClaims: citationChecked.droppedClaims,
        pendingDisclosure:
          reviewSets.pendingDocuments.length > 0
            ? `Pending evidence remains in this client (${reviewSets.pendingDocuments.length} documents).`
            : null,
      },
      costUsd: response.costUsd + classificationResult.costUsd + retrieval.retrievalCostUsd,
      pendingDocsConsidered: reviewSets.pendingDocuments.length,
      classification,
    };

    return {
      turn,
      snapshot,
    };
  }

  if (mode === "strategy") {
    const strategy = await generateClientStrategyMemo(input.clientId, snapshot);
    const turn: ChatTurn = {
      id: crypto.randomUUID(),
      sessionId: "",
      occurredAt: now,
      userMessage: input.message,
      mode,
      modeWasProposed: classification.mode !== mode,
      retrieval: {
        docIds: strategy.memo.recommendedMix.primary.flatMap((entry) => entry.anchorDocIds),
        scope: "client",
      },
      response: {
        text: `Strategy memo prepared for EB-1A. Primary criteria: ${strategy.memo.recommendedMix.primary.map((entry) => entry.criterionCode).join(", ") || "none"}. Supporting criteria: ${strategy.memo.recommendedMix.supporting.map((entry) => entry.criterionCode).join(", ") || "none"}.`,
        artifact: strategy.memo,
        citations: strategy.citations,
        reasoning: strategy.reasoning,
        droppedClaims: strategy.droppedClaims,
        pendingDisclosure: strategy.pendingDisclosure,
      },
      costUsd: strategy.costUsd + classificationResult.costUsd,
      pendingDocsConsidered: strategy.memo.pendingDocsConsidered,
      classification,
    };

    return {
      turn,
      snapshot,
    };
  }

  if (mode === "stress-test") {
    const report = await generateClientStressTest({
      clientId: input.clientId,
      snapshot,
    });
    const turn: ChatTurn = {
      id: crypto.randomUUID(),
      sessionId: "",
      occurredAt: now,
      userMessage: input.message,
      mode,
      modeWasProposed: classification.mode !== mode,
      retrieval: {
        docIds: report.report.challenges.flatMap((challenge) => challenge.atRiskDocIds),
        scope: "client",
      },
      response: {
        text: `Stress-test completed. ${report.report.challenges.length} challenge(s) were surfaced across the current strategy.`,
        artifact: report.report,
        citations: report.citations,
        reasoning: report.reasoning,
        droppedClaims: report.droppedClaims,
        pendingDisclosure: report.pendingDisclosure,
      },
      costUsd: report.costUsd + classificationResult.costUsd,
      pendingDocsConsidered: report.report.pendingDocsConsidered,
      classification,
    };

    return {
      turn,
      snapshot,
    };
  }

  if (input.synthesisKind) {
    const synthesis = await generateSynthesisVersion({
      clientId: input.clientId,
      kind: input.synthesisKind,
      message: input.message,
      snapshot,
    });
    const artifact: SynthesisChatDraft = {
      schemaVersion: "synthesis-draft/1.0",
      clientId: input.clientId,
      createdAt: now,
      kind: input.synthesisKind,
      title: synthesis.title,
      paragraphs: synthesis.versionSeed.paragraphs,
      wordCount: synthesis.versionSeed.wordCount,
      genericProseWarning: synthesis.versionSeed.genericProseWarning ?? null,
      styleProfileId: synthesis.versionSeed.styleProfileId ?? null,
      styleExemplarIds: synthesis.versionSeed.styleExemplarIds ?? [],
      referencedCriteria: synthesis.versionSeed.referencedCriteria,
    };
    const citations = buildSynthesisChatCitations(artifact, snapshot);
    const turn: ChatTurn = {
      id: crypto.randomUUID(),
      sessionId: "",
      occurredAt: now,
      userMessage: input.message,
      mode,
      modeWasProposed: classification.mode !== mode,
      retrieval: {
        docIds: citations.map((citation) => citation.docId),
        scope: "client",
      },
      response: {
        text: `${formatSynthesisTitle(input.synthesisKind)} draft prepared. Review the section text, criterion references, and exhibit support before promoting it into the synthesis workspace.`,
        artifact,
        citations,
        reasoning: synthesis.reasoning,
        droppedClaims: [],
        pendingDisclosure:
          reviewSets.pendingDocuments.length > 0
            ? `Pending evidence remains in this client (${reviewSets.pendingDocuments.length} documents).`
            : null,
      } satisfies ChatResponse,
      costUsd: synthesis.costUsd + classificationResult.costUsd,
      pendingDocsConsidered: reviewSets.pendingDocuments.length,
      classification,
    };

    return {
      turn,
      snapshot,
    };
  }

  if (!input.criterionCode) {
    throw new Error("Draft mode requires a criterion-scoped drafting workspace.");
  }

  const draft = await generateClientBriefDraft({
    clientId: input.clientId,
    criterionCode: input.criterionCode,
    message: input.message,
    snapshot,
  });
  const criterion = criterionMeta(input.criterionCode);
  const turn: ChatTurn = {
    id: crypto.randomUUID(),
    sessionId: "",
    occurredAt: now,
    userMessage: input.message,
    mode,
    modeWasProposed: classification.mode !== mode,
    retrieval: {
      docIds: draft.draft.retrievedDocIds ?? [],
      scope: "criterion",
    },
    response: {
      text: `Draft prepared for ${criterion.legalCode} ${criterion.name}. Review the paragraphs, fact-check flags, and exhibit references before approving.`,
      artifact: draft.draft,
      citations: draft.citations,
      reasoning: draft.reasoning,
      droppedClaims: draft.droppedClaims,
      pendingDisclosure: draft.pendingDisclosure,
    },
    costUsd: draft.costUsd + classificationResult.costUsd,
    pendingDocsConsidered: reviewSets.pendingDocuments.length,
    classification,
  };

  return {
    turn,
    snapshot,
  };
}
