import { EXPORT_ROOT, QDRANT_COLLECTION, QDRANT_URL } from "@/lib/constants";
import {
  DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
  DEFAULT_SUMMARY_PROMPT_TEMPLATE,
  LEGACY_SUMMARY_PROMPT_TEMPLATE,
} from "@/lib/prompt-library";
import { debugQdrantStoragePath } from "@/lib/qdrant";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type { SettingsSnapshot } from "@/lib/types";

export interface RuntimeSettings {
  candidateName: string;
  summaryPrompt: string;
  classificationPrompt: string;
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
    openAiApiKey: input.apiKey?.trim() ? input.apiKey.trim() : current.openAiApiKey || null,
    summaryModel: input.summaryModel.trim(),
    embeddingModel: input.embeddingModel.trim(),
    embeddingDimensions: input.embeddingDimensions,
    outputRootPath: input.outputRootPath.trim() || EXPORT_ROOT,
  });
}

export function getPublicSettings(): SettingsSnapshot {
  const settings = getRuntimeSettings();

  return {
    candidateName: settings.candidateName,
    summaryPrompt: settings.summaryPrompt,
    classificationPrompt: settings.classificationPrompt,
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
