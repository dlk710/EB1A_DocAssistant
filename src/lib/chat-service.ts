import crypto from "node:crypto";
import { buildQueryVector } from "@/lib/ai";
import {
  applyCitationContractToStressTest,
  applyCitationContractToStrategy,
  applyCitationContractToTriage,
} from "@/lib/chat-citation";
import { classifyChatMode } from "@/lib/chat-classifier";
import {
  collectClientReviewSets,
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
import {
  getLatestStrategyMemo,
  saveLatestStrategyMemo,
  saveLatestStressTestReport,
} from "@/lib/chat-state";
import {
  renderStrategyPrompt,
  renderStressTestPrompt,
  renderTriagePrompt,
} from "@/lib/chat-prompts";
import { buildLibrarySnapshot } from "@/lib/library";
import { getChatReadiness } from "@/lib/chat-readiness";
import { getOpenAiContext } from "@/lib/openai";
import { calculateTextModelCost } from "@/lib/openai-pricing";
import { searchDocumentsAcrossWorkspaces } from "@/lib/qdrant";
import type {
  ChatMode,
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

  const turn: ChatTurn = {
    id: crypto.randomUUID(),
    sessionId: "",
    occurredAt: now,
    userMessage: input.message,
    mode,
    modeWasProposed: false,
    retrieval: {
      docIds: [],
      scope: "client",
    },
    response: {
      text: "Draft mode opens in Phase 3. Use Strategy or Stress-test for this stage of the client lifecycle.",
      citations: [],
      reasoning: "Draft mode is intentionally deferred until the dedicated drafting surface is built.",
      droppedClaims: [],
      pendingDisclosure: null,
    },
    costUsd: classificationResult.costUsd,
    pendingDocsConsidered: reviewSets.pendingDocuments.length,
    classification,
  };

  return {
    turn,
    snapshot,
  };
}
