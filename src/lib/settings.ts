import { EXPORT_ROOT, QDRANT_COLLECTION, QDRANT_URL } from "@/lib/constants";
import {
  DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
  DEFAULT_DRAFT_PROMPT_TEMPLATE,
  DEFAULT_SUMMARY_PROMPT_TEMPLATE,
  DEFAULT_TAGGING_PROMPT_TEMPLATE,
  DEFAULT_STRATEGY_PROMPT_TEMPLATE,
  DEFAULT_STRESS_TEST_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE,
  LEGACY_SUMMARY_PROMPT_TEMPLATE,
} from "@/lib/prompt-library";
import { debugQdrantStoragePath } from "@/lib/qdrant";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type { SettingsSnapshot } from "@/lib/types";

export interface RuntimeSettings {
  candidateName: string;
  summaryPrompt: string;
  classificationPrompt: string;
  taggingPrompt: string;
  triagePrompt: string;
  strategyPrompt: string;
  stressTestPrompt: string;
  draftPrompt: string;
  activeStyleProfileId: string;
  openAiApiKey: string | null;
  summaryModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  qdrantUrl: string;
  qdrantCollection: string;
  outputRootPath: string;
}

interface PersistedSettingsState {
  candidateName?: string | null;
  summaryPrompt?: string | null;
  classificationPrompt?: string | null;
  taggingPrompt?: string | null;
  triagePrompt?: string | null;
  strategyPrompt?: string | null;
  stressTestPrompt?: string | null;
  draftPrompt?: string | null;
  activeStyleProfileId?: string | null;
  openAiApiKey?: string | null;
  summaryModel?: string | null;
  embeddingModel?: string | null;
  embeddingDimensions?: number | null;
  outputRootPath?: string | null;
}

const SETTINGS_FILE = "settings.json";

function maskSecret(secret: string | null) {
  if (!secret) {
    return null;
  }

  if (secret.length <= 8) {
    return "configured";
  }

  return `${secret.slice(0, 7)}...${secret.slice(-4)}`;
}

function readPersistedSettings() {
  return readStateFile<PersistedSettingsState>(SETTINGS_FILE, {});
}

export function getRuntimeSettings(): RuntimeSettings {
  const persisted = readPersistedSettings();
  const normalizedSummaryPrompt =
    persisted.summaryPrompt?.trim() === LEGACY_SUMMARY_PROMPT_TEMPLATE
      ? DEFAULT_SUMMARY_PROMPT_TEMPLATE
      : persisted.summaryPrompt?.trim();

  return {
    candidateName:
      persisted.candidateName?.trim() || process.env.EB1A_CANDIDATE_NAME || "",
    summaryPrompt:
      normalizedSummaryPrompt ||
      process.env.EB1A_SUMMARY_PROMPT ||
      DEFAULT_SUMMARY_PROMPT_TEMPLATE,
    classificationPrompt:
      persisted.classificationPrompt?.trim() ||
      process.env.EB1A_CLASSIFICATION_PROMPT ||
      DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
    taggingPrompt:
      persisted.taggingPrompt?.trim() ||
      process.env.EB1A_TAGGING_PROMPT ||
      DEFAULT_TAGGING_PROMPT_TEMPLATE,
    triagePrompt:
      persisted.triagePrompt?.trim() ||
      process.env.EB1A_TRIAGE_PROMPT ||
      DEFAULT_TRIAGE_PROMPT_TEMPLATE,
    strategyPrompt:
      persisted.strategyPrompt?.trim() ||
      process.env.EB1A_STRATEGY_PROMPT ||
      DEFAULT_STRATEGY_PROMPT_TEMPLATE,
    stressTestPrompt:
      persisted.stressTestPrompt?.trim() ||
      process.env.EB1A_STRESS_TEST_PROMPT ||
      DEFAULT_STRESS_TEST_PROMPT_TEMPLATE,
    draftPrompt:
      persisted.draftPrompt?.trim() ||
      process.env.EB1A_DRAFT_PROMPT ||
      DEFAULT_DRAFT_PROMPT_TEMPLATE,
    activeStyleProfileId:
      persisted.activeStyleProfileId?.trim() ||
      process.env.EB1A_ACTIVE_STYLE_PROFILE_ID ||
      "default",
    openAiApiKey: persisted.openAiApiKey || process.env.OPENAI_API_KEY || null,
    summaryModel:
      persisted.summaryModel || process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini",
    embeddingModel:
      persisted.embeddingModel ||
      process.env.OPENAI_EMBEDDING_MODEL ||
      "text-embedding-3-small",
    embeddingDimensions: Number(
      persisted.embeddingDimensions ||
        process.env.OPENAI_EMBEDDING_DIMENSIONS ||
        "1024",
    ),
    qdrantUrl: QDRANT_URL,
    qdrantCollection: QDRANT_COLLECTION,
    outputRootPath:
      persisted.outputRootPath?.trim() || process.env.EB1A_OUTPUT_ROOT || EXPORT_ROOT,
  };
}

export function saveRuntimeSettings(input: {
  candidateName: string;
  summaryPrompt: string;
  classificationPrompt: string;
  taggingPrompt: string;
  triagePrompt: string;
  strategyPrompt: string;
  stressTestPrompt: string;
  draftPrompt: string;
  activeStyleProfileId?: string;
  apiKey?: string;
  summaryModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  outputRootPath: string;
}) {
  const current = readPersistedSettings();

  writeStateFile<PersistedSettingsState>(SETTINGS_FILE, {
    ...current,
    candidateName: input.candidateName.trim(),
    summaryPrompt: input.summaryPrompt.trim() || DEFAULT_SUMMARY_PROMPT_TEMPLATE,
    classificationPrompt:
      input.classificationPrompt.trim() || DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
    taggingPrompt: input.taggingPrompt.trim() || DEFAULT_TAGGING_PROMPT_TEMPLATE,
    triagePrompt: input.triagePrompt.trim() || DEFAULT_TRIAGE_PROMPT_TEMPLATE,
    strategyPrompt: input.strategyPrompt.trim() || DEFAULT_STRATEGY_PROMPT_TEMPLATE,
    stressTestPrompt:
      input.stressTestPrompt.trim() || DEFAULT_STRESS_TEST_PROMPT_TEMPLATE,
    draftPrompt: input.draftPrompt.trim() || DEFAULT_DRAFT_PROMPT_TEMPLATE,
    activeStyleProfileId: input.activeStyleProfileId?.trim() || current.activeStyleProfileId?.trim() || "default",
    openAiApiKey: input.apiKey?.trim() ? input.apiKey.trim() : current.openAiApiKey || null,
    summaryModel: input.summaryModel.trim(),
    embeddingModel: input.embeddingModel.trim(),
    embeddingDimensions: input.embeddingDimensions,
    outputRootPath: input.outputRootPath.trim() || EXPORT_ROOT,
  });
}

export function setActiveStyleProfileId(activeStyleProfileId: string) {
  const current = getRuntimeSettings();
  saveRuntimeSettings({
    candidateName: current.candidateName,
    summaryPrompt: current.summaryPrompt,
    classificationPrompt: current.classificationPrompt,
    taggingPrompt: current.taggingPrompt,
    triagePrompt: current.triagePrompt,
    strategyPrompt: current.strategyPrompt,
    stressTestPrompt: current.stressTestPrompt,
    draftPrompt: current.draftPrompt,
    activeStyleProfileId,
    summaryModel: current.summaryModel,
    embeddingModel: current.embeddingModel,
    embeddingDimensions: current.embeddingDimensions,
    outputRootPath: current.outputRootPath,
  });
}

export function getPublicSettings(): SettingsSnapshot {
  const settings = getRuntimeSettings();

  return {
    candidateName: settings.candidateName,
    summaryPrompt: settings.summaryPrompt,
    classificationPrompt: settings.classificationPrompt,
    taggingPrompt: settings.taggingPrompt,
    triagePrompt: settings.triagePrompt,
    strategyPrompt: settings.strategyPrompt,
    stressTestPrompt: settings.stressTestPrompt,
    draftPrompt: settings.draftPrompt,
    activeStyleProfileId: settings.activeStyleProfileId,
    hasApiKey: Boolean(settings.openAiApiKey),
    apiKeyMask: maskSecret(settings.openAiApiKey),
    summaryModel: settings.summaryModel,
    embeddingModel: settings.embeddingModel,
    embeddingDimensions: settings.embeddingDimensions,
    qdrantUrl: settings.qdrantUrl,
    qdrantCollection: settings.qdrantCollection,
    storagePath: debugQdrantStoragePath(),
    outputRootPath: settings.outputRootPath,
  };
}
