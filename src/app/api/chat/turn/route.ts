import crypto from "node:crypto";
import { z } from "zod";
import { semanticSearch } from "@/lib/ai";
import { classifyChatMode } from "@/lib/chat-classifier";
import {
  buildChatCitations,
  buildCoverageBlock,
  briefDraftJsonSchema,
  briefDraftSchema,
  buildKeptDocsBlock,
  buildPendingDisclosure,
  buildPendingDocsBlock,
  buildRetrievedDocsBlock,
  normalizeBriefDraft,
  normalizeStressTestReport,
  normalizeStrategyMemo,
  normalizeTriageAnswer,
  stressTestReportJsonSchema,
  stressTestReportSchema,
  strategyMemoJsonSchema,
  strategyMemoSchema,
  triageAnswerJsonSchema,
  triageAnswerSchema,
} from "@/lib/chat-modes";
import {
  appendChatTurns,
  createChatSession,
  getChatSession,
  listChatArtifacts,
} from "@/lib/chat-state";
import {
  EB1A_CRITERIA_CATALOG,
  EB1A_CRITERIA_DEFINITIONS,
} from "@/lib/constants";
import { buildLibrarySnapshot } from "@/lib/library";
import { getChatReadiness } from "@/lib/chat-readiness";
import { getOpenAiContext } from "@/lib/openai";
import { calculateTextModelCost } from "@/lib/openai-pricing";
import { fillPromptTemplate } from "@/lib/prompt-library";
import type {
  ChatMode,
  ChatTurn,
  BriefDraft,
  ClientDocument,
  StressTestReport,
  StrategyMemo,
  TriageAnswer,
} from "@/lib/types";

const turnInputSchema = z.object({
  jobId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  modeHint: z.enum(["triage", "strategy", "stress-test", "draft"]).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function canonicalizeCriterionCode(value: unknown, fallback = "") {
  const normalized = clampString(value, 80).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  const numericMatch = normalized.match(/\b(0[1-9]|1[01])\b/);

  if (numericMatch?.[1]) {
    return numericMatch[1];
  }

  for (const criterion of EB1A_CRITERIA_DEFINITIONS) {
    const aliases = [
      criterion.code,
      criterion.legalCode.toLowerCase(),
      criterion.legalCode.replace(/[()]/g, "").toLowerCase(),
      criterion.name.toLowerCase(),
      criterion.name.toLowerCase().replace(/\s+or\s+/g, " "),
      criterion.name.toLowerCase().replace(/\s*&\s*/g, " and "),
    ];

    if (criterion.code === "08") {
      aliases.push("critical role", "leading role");
    }

    if (aliases.some((alias) => alias && normalized.includes(alias))) {
      return criterion.code;
    }
  }

  return fallback;
}

function parseOutputJson(outputText: string) {
  try {
    return JSON.parse(outputText) as Record<string, unknown>;
  } catch {
    throw new Error("Setu received a malformed model response and could not parse it.");
  }
}

function sanitizeTriageCandidate(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    schemaVersion: "triage-answer/1.0" as const,
    answer: Array.isArray(value.answer)
      ? value.answer
          .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
          .map((entry) => ({
            text: clampString(entry.text, 600, "Setu could not safely summarize this answer block."),
            docIds: clampStringArray(entry.docIds, 6, 80),
          }))
      : [],
    insufficiencyNote:
      value.insufficiencyNote === null
        ? null
        : clampString(value.insufficiencyNote, 500) || null,
  };
}

function sanitizeStrategyCandidate(raw: unknown, jobId: string) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const normalizeRecommendation = (entry: unknown) => {
    const candidate =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};

    return {
      criterionCode: canonicalizeCriterionCode(candidate.criterionCode),
      rationale: clampString(candidate.rationale, 700, "Rationale unavailable."),
      anchorDocIds: clampStringArray(candidate.anchorDocIds, 4, 80),
    };
  };

  const normalizeGap = (entry: unknown) => {
    const candidate =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const type = clampString(candidate.type, 40);

    return {
      criterionCode: canonicalizeCriterionCode(candidate.criterionCode),
      type:
        type === "insufficient-quantity" ||
        type === "lack-of-independence" ||
        type === "lack-of-significance" ||
        type === "missing-context"
          ? type
          : "missing-context",
      description: clampString(candidate.description, 600, "Gap description unavailable."),
      suggestedAdditions: clampStringArray(candidate.suggestedAdditions, 6, 260),
    };
  };

  const normalizeRisk = (entry: unknown) => {
    const candidate =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const severity = clampString(candidate.severity, 20);

    return {
      type: clampString(candidate.type, 120, "general-risk"),
      description: clampString(candidate.description, 600, "Risk description unavailable."),
      severity:
        severity === "low" || severity === "medium" || severity === "high"
          ? severity
          : "medium",
      affectedDocIds: clampStringArray(candidate.affectedDocIds, 6, 80),
    };
  };

  const normalizeCitation = (entry: unknown) => {
    const candidate =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};

    return {
      docId: clampString(candidate.docId, 80),
      claim: clampString(candidate.claim, 500, "Claim citation unavailable."),
    };
  };

  return {
    schemaVersion: "strategy-memo/1.0" as const,
    jobId,
    createdAt: new Date().toISOString(),
    petitionType: "EB-1A" as const,
    pendingDocsConsidered:
      typeof value.pendingDocsConsidered === "number"
        ? Math.max(0, Math.round(value.pendingDocsConsidered))
        : 0,
    recommendedMix: {
      primary: Array.isArray(value.recommendedMix && (value.recommendedMix as Record<string, unknown>).primary)
        ? ((value.recommendedMix as Record<string, unknown>).primary as unknown[]).map(normalizeRecommendation)
        : [],
      supporting: Array.isArray(value.recommendedMix && (value.recommendedMix as Record<string, unknown>).supporting)
        ? ((value.recommendedMix as Record<string, unknown>).supporting as unknown[]).map(normalizeRecommendation)
        : [],
      decline: Array.isArray(value.recommendedMix && (value.recommendedMix as Record<string, unknown>).decline)
        ? ((value.recommendedMix as Record<string, unknown>).decline as unknown[])
            .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
            .map((entry) => ({
              criterionCode: canonicalizeCriterionCode(entry.criterionCode),
              rationale: clampString(entry.rationale, 500, "Decline rationale unavailable."),
            }))
        : [],
    },
    leadArgument: {
      criterionCode: canonicalizeCriterionCode(
        value.leadArgument && typeof value.leadArgument === "object"
          ? (value.leadArgument as Record<string, unknown>).criterionCode
          : "",
        "08",
      ),
      narrativeSpine: clampString(
        value.leadArgument && typeof value.leadArgument === "object"
          ? (value.leadArgument as Record<string, unknown>).narrativeSpine
          : "",
        1400,
        "Narrative spine unavailable.",
      ),
      anchorDocIds: clampStringArray(
        value.leadArgument && typeof value.leadArgument === "object"
          ? (value.leadArgument as Record<string, unknown>).anchorDocIds
          : [],
        5,
        80,
      ),
    },
    gaps: Array.isArray(value.gaps) ? value.gaps.map(normalizeGap) : [],
    risks: Array.isArray(value.risks) ? value.risks.map(normalizeRisk) : [],
    citations: Array.isArray(value.citations) ? value.citations.map(normalizeCitation) : [],
  };
}

function sanitizeStressTestCandidate(raw: unknown, jobId: string, strategyMemoVersion: string | null) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    schemaVersion: "stress-test/1.0" as const,
    jobId,
    createdAt: new Date().toISOString(),
    scope:
      value.scope === "full-petition"
        ? "full-petition"
        : {
            criterionCode: clampString(
              value.scope && typeof value.scope === "object"
                ? (value.scope as Record<string, unknown>).criterionCode
                : "",
              8,
              "08",
            ),
          },
    strategyMemoVersion,
    pendingDocsConsidered:
      typeof value.pendingDocsConsidered === "number"
        ? Math.max(0, Math.round(value.pendingDocsConsidered))
        : 0,
    challenges: Array.isArray(value.challenges)
      ? value.challenges
          .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
          .map((entry) => {
            const challengeType = clampString(entry.challengeType, 40);
            const severity = clampString(entry.severity, 20);
            const suggestedAction = clampString(entry.suggestedAction, 30);

            return {
              criterionCode: canonicalizeCriterionCode(entry.criterionCode, "08"),
              challengeType:
                challengeType === "insufficiency" ||
                challengeType === "lack-of-independence" ||
                challengeType === "lack-of-significance" ||
                challengeType === "comparability" ||
                challengeType === "sustained-acclaim"
                  ? challengeType
                  : "insufficiency",
              uscisStance: clampString(entry.uscisStance, 900, "Challenge unavailable."),
              atRiskDocIds: clampStringArray(entry.atRiskDocIds, 8, 80),
              currentMitigation: clampString(
                entry.currentMitigation,
                700,
                "Current mitigation unavailable.",
              ),
              suggestedAction:
                suggestedAction === "add-evidence" ||
                suggestedAction === "rewrite-brief" ||
                suggestedAction === "reorganize" ||
                suggestedAction === "accept-risk"
                  ? suggestedAction
                  : "add-evidence",
              suggestedActionDetail: clampString(
                entry.suggestedActionDetail,
                700,
                "Suggested action detail unavailable.",
              ),
              severity:
                severity === "low" || severity === "medium" || severity === "high"
                  ? severity
                  : "medium",
            };
          })
      : [],
  };
}

function sanitizeBriefDraftCandidate(
  raw: unknown,
  jobId: string,
  section: BriefDraft["section"],
  targetCriterionCode: string | null,
) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    schemaVersion: "brief-draft/1.0" as const,
    jobId,
    createdAt: new Date().toISOString(),
    section,
    targetCriterionCode,
    title: clampString(value.title, 240, "Draft section"),
    paragraphs: Array.isArray(value.paragraphs)
      ? value.paragraphs
          .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
          .map((entry) => ({
            text: clampString(entry.text, 1800, "Draft paragraph unavailable."),
            exhibitRefs: clampStringArray(entry.exhibitRefs, 6, 80),
            citations: Array.isArray(entry.citations)
              ? entry.citations
                  .filter((citation): citation is Record<string, unknown> => Boolean(citation) && typeof citation === "object")
                  .map((citation) => ({
                    docId: clampString(citation.docId, 80),
                    supports: clampString(citation.supports, 320, "Support note unavailable."),
                  }))
              : [],
          }))
      : [],
    wordCount:
      typeof value.wordCount === "number" ? Math.max(1, Math.round(value.wordCount)) : 1,
  };
}

function buildTriageMessage(answer: TriageAnswer, documents: ClientDocument[]) {
  const labelLookup = new Map(
    documents.map((document) => [document.id, document.summary?.title || document.fileName]),
  );

  const lines = answer.answer.map((block) => {
    const chips = block.docIds
      .map((docId) => `[doc:${docId}] ${labelLookup.get(docId) || docId}`)
      .join(", ");
    return `${block.text} (${chips})`;
  });

  if (answer.insufficiencyNote) {
    lines.push(answer.insufficiencyNote);
  }

  return lines.join("\n\n");
}

function buildStrategyMessage(memo: StrategyMemo) {
  const primary = memo.recommendedMix.primary.map((entry) => entry.criterionCode).join(", ");
  const supporting = memo.recommendedMix.supporting.map((entry) => entry.criterionCode).join(", ");

  return [
    `Strategy memo prepared for ${memo.petitionType}.`,
    primary ? `Primary criteria: ${primary}.` : "No primary criteria recommended yet.",
    supporting ? `Supporting criteria: ${supporting}.` : "No supporting criteria recommended yet.",
  ].join(" ");
}

function buildStressTestMessage(report: StressTestReport) {
  const highestSeverity = report.challenges.some((challenge) => challenge.severity === "high")
    ? "high"
    : report.challenges.some((challenge) => challenge.severity === "medium")
      ? "medium"
      : "low";

  return `Stress-test prepared with ${report.challenges.length} challenge(s). Highest severity: ${highestSeverity}.`;
}

function buildBriefDraftMessage(draft: BriefDraft) {
  return `Drafted ${draft.section} with ${draft.paragraphs.length} paragraph(s) and ${draft.wordCount} words.`;
}

function buildStrategyMemoBlock(memo: StrategyMemo) {
  return [
    `Lead criterion: ${memo.leadArgument.criterionCode}`,
    `Lead narrative: ${memo.leadArgument.narrativeSpine}`,
    `Primary criteria: ${memo.recommendedMix.primary.map((item) => item.criterionCode).join(", ") || "none"}`,
    `Supporting criteria: ${memo.recommendedMix.supporting.map((item) => item.criterionCode).join(", ") || "none"}`,
    `Risks: ${memo.risks.map((risk) => `${risk.severity} ${risk.type}`).join("; ") || "none"}`,
  ].join("\n");
}

function resolveCriterionCodeFromMessage(message: string) {
  const normalized = message.toLowerCase();
  const numericMatch = normalized.match(/\b(0[1-9]|1[01])\b/);

  if (numericMatch?.[1]) {
    return numericMatch[1];
  }

  for (const criterion of EB1A_CRITERIA_DEFINITIONS) {
    const aliases = [
      criterion.name.toLowerCase(),
      criterion.name.toLowerCase().replace(/\s+or\s+/g, " "),
      criterion.name.toLowerCase().replace(/\s*&\s*/g, " and "),
    ];

    if (criterion.code === "08") {
      aliases.push("critical role", "leading role");
    }

    if (
      normalized.includes(criterion.legalCode.toLowerCase()) ||
      aliases.some((alias) => normalized.includes(alias))
    ) {
      return criterion.code;
    }
  }

  return null;
}

function resolveDraftIntent(message: string, strategyMemo: StrategyMemo) {
  const normalized = message.toLowerCase();
  const criterionCode = resolveCriterionCodeFromMessage(message);

  let section: BriefDraft["section"] = "criterion-argument";

  if (normalized.includes("final merits")) {
    section = "final-merits-determination";
  } else if (normalized.includes("eligibility")) {
    section = "statement-of-eligibility";
  } else if (normalized.includes("intro")) {
    section = "introduction";
  } else if (normalized.includes("conclusion")) {
    section = "conclusion";
  }

  const targetCriterionCode =
    section === "criterion-argument"
      ? criterionCode || strategyMemo.leadArgument.criterionCode
      : null;

  return { section, targetCriterionCode };
}

function buildCriterionEvidenceBlock(
  documents: ClientDocument[],
  criterionCode: string,
  strategyMemo?: StrategyMemo | null,
) {
  const anchorSet = new Set(
    strategyMemo
      ? [
          ...strategyMemo.recommendedMix.primary.flatMap((entry) => entry.anchorDocIds),
          ...strategyMemo.recommendedMix.supporting.flatMap((entry) => entry.anchorDocIds),
          ...strategyMemo.leadArgument.anchorDocIds,
        ]
      : [],
  );

  return documents
    .filter(
      (document) =>
        document.criteriaTags.some((tag) => tag.code === criterionCode) || anchorSet.has(document.id),
    )
    .slice(0, 14);
}

function getLatestPinnedStrategyMemo(jobId: string) {
  return listChatArtifacts(jobId)
    .filter((artifact) => artifact.kind === "strategy-memo" && artifact.strategyMemo)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.strategyMemo ?? null;
}

function buildRefusalTurn(input: {
  mode: ChatMode;
  classification: Awaited<ReturnType<typeof classifyChatMode>>["classification"];
  usageCostUsd: number;
  message: string;
  refusalMessage: string;
}) {
  return {
    id: crypto.randomUUID(),
    role: "assistant" as const,
    mode: input.mode,
    createdAt: new Date().toISOString(),
    message: input.message,
    classification: input.classification,
    usageCostUsd: input.usageCostUsd,
    assistantPayload: {
      kind: "refusal" as const,
      triageAnswer: null,
      strategyMemo: null,
      stressTestReport: null,
      briefDraft: null,
      refusalMessage: input.refusalMessage,
      pendingDocsDisclosure: null,
      citations: [],
    },
  };
}

async function generateTriageAnswer(input: {
  message: string;
  candidateName: string;
  documents: ClientDocument[];
}) {
  const { client, settings } = getOpenAiContext();
  const prompt = fillPromptTemplate(settings.triagePrompt, {
    candidateName: input.candidateName || "the candidate",
    retrievedDocsBlock: buildRetrievedDocsBlock(input.documents),
  });

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: `${prompt} Return strict JSON only.` }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: input.message }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "setu_chat_triage_answer",
        strict: true,
        schema: triageAnswerJsonSchema,
      },
    },
  });

  const parsed = triageAnswerSchema.parse(sanitizeTriageCandidate(parseOutputJson(response.output_text)));
  const normalized = normalizeTriageAnswer(parsed, input.documents);
  const citations = buildChatCitations(
    normalized.answer.flatMap((block) => block.docIds),
    input.documents,
  );

  return {
    answer: normalized,
    citations,
    costUsd: buildUsageCost(settings.summaryModel, response.usage),
  };
}

async function generateStrategyMemo(input: {
  jobId: string;
  message: string;
  candidateName: string;
  documents: ClientDocument[];
  coverageBlock: string;
}) {
  const { client, settings } = getOpenAiContext();
  const prompt = fillPromptTemplate(settings.strategyPrompt, {
    candidateName: input.candidateName || "the candidate",
    criteriaCatalog: EB1A_CRITERIA_CATALOG,
    coverageBlock: input.coverageBlock,
    keptDocsBlock: buildKeptDocsBlock(input.documents),
    pendingDocsBlock: buildPendingDocsBlock(input.documents) || "None.",
    strategySchema:
      "strategy-memo/1.0 with recommendedMix, leadArgument, gaps, risks, and citations.",
  });

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: `${prompt} Return strict JSON only.` }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: input.message }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "setu_strategy_memo",
        strict: true,
        schema: strategyMemoJsonSchema,
      },
    },
  });

  const parsed = strategyMemoSchema.parse(
    sanitizeStrategyCandidate(parseOutputJson(response.output_text), input.jobId),
  );
  const normalized = normalizeStrategyMemo(
    parsed,
    input.documents,
  );

  const citations = buildChatCitations(
    [
      ...normalized.citations.map((entry) => entry.docId),
      ...normalized.recommendedMix.primary.flatMap((entry) => entry.anchorDocIds),
      ...normalized.recommendedMix.supporting.flatMap((entry) => entry.anchorDocIds),
      ...normalized.leadArgument.anchorDocIds,
      ...normalized.risks.flatMap((entry) => entry.affectedDocIds),
    ],
    input.documents,
  );

  return {
    memo: normalized,
    citations,
    costUsd: buildUsageCost(settings.summaryModel, response.usage),
  };
}

async function generateStressTestReport(input: {
  jobId: string;
  message: string;
  candidateName: string;
  documents: ClientDocument[];
  strategyMemo: StrategyMemo;
}) {
  const { client, settings } = getOpenAiContext();
  const prompt = fillPromptTemplate(settings.stressTestPrompt, {
    candidateName: input.candidateName || "the candidate",
    strategyMemoBlock: buildStrategyMemoBlock(input.strategyMemo),
    adHocScope: "Strategy memo required for this mode.",
    retrievedDocsBlock: buildRetrievedDocsBlock(input.documents),
    stressTestSchema: "stress-test/1.0 with challenges and atRiskDocIds.",
  });

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: `${prompt} Return strict JSON only.` }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: input.message }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "setu_stress_test_report",
        strict: true,
        schema: stressTestReportJsonSchema,
      },
    },
  });

  const parsed = stressTestReportSchema.parse(
    sanitizeStressTestCandidate(
      parseOutputJson(response.output_text),
      input.jobId,
      input.strategyMemo.createdAt,
    ),
  );
  const normalized = normalizeStressTestReport(
    parsed,
    input.documents,
  );

  const citations = buildChatCitations(
    normalized.challenges.flatMap((challenge) => challenge.atRiskDocIds),
    input.documents,
  );

  return {
    report: normalized,
    citations,
    costUsd: buildUsageCost(settings.summaryModel, response.usage),
  };
}

async function generateBriefDraft(input: {
  jobId: string;
  message: string;
  candidateName: string;
  documents: ClientDocument[];
  strategyMemo: StrategyMemo;
}) {
  const { client, settings } = getOpenAiContext();
  const draftIntent = resolveDraftIntent(input.message, input.strategyMemo);
  const evidenceDocuments =
    draftIntent.targetCriterionCode
      ? buildCriterionEvidenceBlock(input.documents, draftIntent.targetCriterionCode, input.strategyMemo)
      : input.documents.slice(0, 12);

  const prompt = fillPromptTemplate(settings.draftPrompt, {
    candidateName: input.candidateName || "the candidate",
    sectionKey: draftIntent.section,
    criterionCode: draftIntent.targetCriterionCode ?? "none",
    strategyMemoBlock: buildStrategyMemoBlock(input.strategyMemo),
    evidenceBlock: buildRetrievedDocsBlock(evidenceDocuments),
    briefDraftSchema:
      "brief-draft/1.0 with paragraphs, exhibitRefs, citations, and wordCount.",
  });

  const response = await client.responses.create({
    model: settings.summaryModel,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: `${prompt} Return strict JSON only.` }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: input.message }],
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

  const parsed = briefDraftSchema.parse(
    sanitizeBriefDraftCandidate(
      parseOutputJson(response.output_text),
      input.jobId,
      draftIntent.section,
      draftIntent.targetCriterionCode,
    ),
  );
  const normalized = normalizeBriefDraft(
    parsed,
    evidenceDocuments,
  );

  const citations = buildChatCitations(
    normalized.paragraphs.flatMap((paragraph) =>
      paragraph.citations.map((citation) => citation.docId),
    ),
    evidenceDocuments,
  );

  return {
    draft: normalized,
    citations,
    costUsd: buildUsageCost(settings.summaryModel, response.usage),
  };
}

export async function POST(request: Request) {
  try {
    const parsed = turnInputSchema.safeParse(await request.json());

    if (!parsed.success) {
      return Response.json({ error: "Invalid chat turn payload." }, { status: 400 });
    }

    const snapshot = await buildLibrarySnapshot({ jobId: parsed.data.jobId });
    const readiness = getChatReadiness(snapshot);

    if (!readiness.ready) {
      return Response.json(
        {
          error: readiness.reason || "This workspace is not ready for Ask the Studio yet.",
        },
        { status: 409 },
      );
    }

    const session =
      parsed.data.sessionId && parsed.data.sessionId.trim()
        ? getChatSession(parsed.data.jobId, parsed.data.sessionId)
        : createChatSession(parsed.data.jobId);

    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      mode: parsed.data.modeHint ?? null,
      createdAt: new Date().toISOString(),
      message: parsed.data.message.trim(),
      classification: null,
      assistantPayload: null,
      usageCostUsd: 0,
    };

    const classificationResult = await classifyChatMode({
      message: parsed.data.message,
      modeHint: parsed.data.modeHint as ChatMode | undefined,
    });

    const completedDocuments = snapshot.documents.filter(
      (document) => document.processingStatus === "completed",
    );
    const chatDocuments = completedDocuments.filter(
      (document) => document.reviewStatus === "kept" || document.reviewStatus === "pending",
    );
    const pinnedStrategyMemo = getLatestPinnedStrategyMemo(parsed.data.jobId);

    let assistantTurn: ChatTurn;

  if (classificationResult.classification.mode === "triage") {
    const matches = (await semanticSearch(parsed.data.message, 18, parsed.data.jobId)).filter(
      (document) => document.reviewStatus === "kept" || document.reviewStatus === "pending",
    );
    const triage = await generateTriageAnswer({
      message: parsed.data.message,
      candidateName: snapshot.activeJob?.candidateName || snapshot.settings.candidateName,
      documents: matches,
    });

    assistantTurn = {
      id: crypto.randomUUID(),
      role: "assistant",
      mode: "triage",
      createdAt: new Date().toISOString(),
      message: buildTriageMessage(triage.answer, matches),
      classification: classificationResult.classification,
      usageCostUsd: classificationResult.costUsd + triage.costUsd,
      assistantPayload: {
        kind: "triage",
        triageAnswer: triage.answer,
        strategyMemo: null,
        stressTestReport: null,
        briefDraft: null,
        refusalMessage: null,
        pendingDocsDisclosure: null,
        citations: triage.citations,
      },
    };
  } else if (classificationResult.classification.mode === "strategy") {
    const strategy = await generateStrategyMemo({
      jobId: parsed.data.jobId,
      message: parsed.data.message,
      candidateName: snapshot.activeJob?.candidateName || snapshot.settings.candidateName,
      documents: chatDocuments,
      coverageBlock: buildCoverageBlock(snapshot),
    });

    assistantTurn = {
      id: crypto.randomUUID(),
      role: "assistant",
      mode: "strategy",
      createdAt: new Date().toISOString(),
      message: buildStrategyMessage(strategy.memo),
      classification: classificationResult.classification,
      usageCostUsd: classificationResult.costUsd + strategy.costUsd,
      assistantPayload: {
        kind: "strategy",
        triageAnswer: null,
        strategyMemo: strategy.memo,
        stressTestReport: null,
        briefDraft: null,
        refusalMessage: null,
        pendingDocsDisclosure: buildPendingDisclosure(chatDocuments),
        citations: strategy.citations,
      },
    };
  } else if (classificationResult.classification.mode === "stress-test") {
    if (!pinnedStrategyMemo) {
      assistantTurn = buildRefusalTurn({
        mode: "stress-test",
        classification: classificationResult.classification,
        usageCostUsd: classificationResult.costUsd,
        message:
          "Stress-test mode needs a pinned strategy memo first. Run Strategy, review it, then pin it into the workspace before asking Setu to challenge the case.",
        refusalMessage:
          "Stress-test mode needs a pinned strategy memo before it can run safely.",
      });
    } else {
      const primaryCodes = new Set(
        pinnedStrategyMemo.recommendedMix.primary.map((entry) => entry.criterionCode),
      );
      const stressDocuments = chatDocuments.filter(
        (document) =>
          document.criteriaTags.some((tag) => primaryCodes.has(tag.code)) ||
          pinnedStrategyMemo.leadArgument.anchorDocIds.includes(document.id),
      );

      if (!stressDocuments.length && !chatDocuments.length) {
        assistantTurn = buildRefusalTurn({
          mode: "stress-test",
          classification: classificationResult.classification,
          usageCostUsd: classificationResult.costUsd,
          message:
            "Setu could not find completed kept or pending evidence to stress-test in this workspace.",
          refusalMessage:
            "No completed kept or pending evidence is available yet for stress-test mode.",
        });
      } else {
        const stressTest = await generateStressTestReport({
          jobId: parsed.data.jobId,
          message: parsed.data.message,
          candidateName: snapshot.activeJob?.candidateName || snapshot.settings.candidateName,
          documents: stressDocuments.length ? stressDocuments : chatDocuments.slice(0, 18),
          strategyMemo: pinnedStrategyMemo,
        });

        if (!stressTest.report.challenges.length) {
          assistantTurn = buildRefusalTurn({
            mode: "stress-test",
            classification: classificationResult.classification,
            usageCostUsd: classificationResult.costUsd + stressTest.costUsd,
            message:
              "Setu could not produce citable stress-test challenges from the currently retrieved evidence. Try pinning a different strategy memo or narrowing the question to a specific criterion.",
            refusalMessage:
              "No citable stress-test challenges were produced from the available evidence.",
          });
        } else {
          assistantTurn = {
            id: crypto.randomUUID(),
            role: "assistant",
            mode: "stress-test",
            createdAt: new Date().toISOString(),
            message: buildStressTestMessage(stressTest.report),
            classification: classificationResult.classification,
            usageCostUsd: classificationResult.costUsd + stressTest.costUsd,
            assistantPayload: {
              kind: "stress-test",
              triageAnswer: null,
              strategyMemo: null,
              stressTestReport: stressTest.report,
              briefDraft: null,
              refusalMessage: null,
              pendingDocsDisclosure: buildPendingDisclosure(chatDocuments),
              citations: stressTest.citations,
            },
          };
        }
      }
    }
  } else {
    if (!pinnedStrategyMemo) {
      assistantTurn = buildRefusalTurn({
        mode: "draft",
        classification: classificationResult.classification,
        usageCostUsd: classificationResult.costUsd,
        message:
          "Draft mode needs a pinned strategy memo first so Setu can draft from an agreed case theory. Run Strategy and pin the memo before asking for prose.",
        refusalMessage:
          "Draft mode needs a pinned strategy memo before it can draft safely.",
      });
    } else {
      const keptDocuments = chatDocuments.filter((document) => document.reviewStatus === "kept");

      if (!keptDocuments.length) {
        assistantTurn = buildRefusalTurn({
          mode: "draft",
          classification: classificationResult.classification,
          usageCostUsd: classificationResult.costUsd,
          message:
            "Draft mode needs at least one kept evidence file before Setu can draft citable petition prose.",
          refusalMessage:
            "No kept evidence is available yet for draft mode.",
        });
      } else {
        const draft = await generateBriefDraft({
          jobId: parsed.data.jobId,
          message: parsed.data.message,
          candidateName: snapshot.activeJob?.candidateName || snapshot.settings.candidateName,
          documents: keptDocuments,
          strategyMemo: pinnedStrategyMemo,
        });

        if (!draft.draft.paragraphs.length) {
          assistantTurn = buildRefusalTurn({
            mode: "draft",
            classification: classificationResult.classification,
            usageCostUsd: classificationResult.costUsd + draft.costUsd,
            message:
              "Setu could not produce a citable draft section from the currently retrieved evidence. Try asking for a specific criterion argument or pin a stronger strategy memo first.",
            refusalMessage:
              "No citable draft paragraphs were produced from the available evidence.",
          });
        } else {
          assistantTurn = {
            id: crypto.randomUUID(),
            role: "assistant",
            mode: "draft",
            createdAt: new Date().toISOString(),
            message: buildBriefDraftMessage(draft.draft),
            classification: classificationResult.classification,
            usageCostUsd: classificationResult.costUsd + draft.costUsd,
            assistantPayload: {
              kind: "draft",
              triageAnswer: null,
              strategyMemo: null,
              stressTestReport: null,
              briefDraft: draft.draft,
              refusalMessage: null,
              pendingDocsDisclosure: null,
              citations: draft.citations,
            },
          };
        }
      }
    }
  }

    const nextSession = appendChatTurns(parsed.data.jobId, session.id, [userTurn, assistantTurn]);

    return Response.json({
      session: nextSession,
      userTurn,
      assistantTurn,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Setu could not complete that chat turn. Please try again.",
      },
      { status: 500 },
    );
  }
}
