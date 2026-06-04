import { EXPORT_ROOT, QDRANT_COLLECTION, QDRANT_URL } from "@/lib/constants";
import {
  DEFAULT_FOLDER_SIGNAL_POLICY,
  isFolderSignalPolicy,
} from "@/lib/folder-context";
import {
  DEFAULT_BUNDLING_PROMPT_TEMPLATE,
  DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
  DEFAULT_DRAFT_PROMPT_TEMPLATE,
  DEFAULT_FINAL_MERITS_DETERMINATION_PROMPT_TEMPLATE,
  DEFAULT_STATEMENT_OF_ELIGIBILITY_PROMPT_TEMPLATE,
  DEFAULT_SUMMARY_PROMPT_TEMPLATE,
  DEFAULT_TAGGING_PROMPT_TEMPLATE,
  DEFAULT_STRATEGY_PROMPT_TEMPLATE,
  DEFAULT_STRESS_TEST_PROMPT_TEMPLATE,
  DEFAULT_TRIAGE_PROMPT_TEMPLATE,
  LEGACY_BUNDLING_PROMPT_TEMPLATE,
  LEGACY_CLASSIFICATION_PROMPT_TEMPLATE,
  LEGACY_SUMMARY_PROMPT_TEMPLATE,
  PRE_FOLDER_AWARE_BUNDLING_PROMPT_TEMPLATE,
  PRE_FOLDER_AWARE_CLASSIFICATION_PROMPT_TEMPLATE,
  PRE_FOLDER_AWARE_SUMMARY_PROMPT_TEMPLATE,
  PRE_FOLDER_AWARE_TAGGING_PROMPT_TEMPLATE,
  PHASED_CLASSIFICATION_PROMPT_TEMPLATE,
} from "@/lib/prompt-library";
import { debugQdrantStoragePath } from "@/lib/qdrant";
import { readStateFile, writeStateFile } from "@/lib/state-store";
import type { FolderSignalPolicy, SettingsSnapshot } from "@/lib/types";

export interface RuntimeSettings {
  candidateName: string;
  summaryPrompt: string;
  bundlingPrompt: string;
  classificationPrompt: string;
  taggingPrompt: string;
  folderSignalPolicy: FolderSignalPolicy;
  triagePrompt: string;
  strategyPrompt: string;
  stressTestPrompt: string;
  draftPrompt: string;
  statementOfEligibilityPrompt: string;
  finalMeritsDeterminationPrompt: string;
  activeStyleProfileId: string;
  openAiApiKey: string | null;
  summaryModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  qdrantUrl: string;
  qdrantCollection: string;
  outputRootPath: string;
  archiveConfidenceFloor: number;
  linkCheckTimeoutMs: number;
  researchRecencyDays: number;
  flagsDbVersion: string;
}

interface PersistedSettingsState {
  candidateName?: string | null;
  summaryPrompt?: string | null;
  bundlingPrompt?: string | null;
  classificationPrompt?: string | null;
  taggingPrompt?: string | null;
  folderSignalPolicy?: FolderSignalPolicy | null;
  triagePrompt?: string | null;
  strategyPrompt?: string | null;
  stressTestPrompt?: string | null;
  draftPrompt?: string | null;
  statementOfEligibilityPrompt?: string | null;
  finalMeritsDeterminationPrompt?: string | null;
  activeStyleProfileId?: string | null;
  openAiApiKey?: string | null;
  summaryModel?: string | null;
  embeddingModel?: string | null;
  embeddingDimensions?: number | null;
  outputRootPath?: string | null;
  archiveConfidenceFloor?: number | null;
  linkCheckTimeoutMs?: number | null;
  researchRecencyDays?: number | null;
  flagsDbVersion?: string | null;
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

function normalizeFolderSignalPolicy(
  value: PersistedSettingsState["folderSignalPolicy"],
): FolderSignalPolicy {
  return value && isFolderSignalPolicy(value) ? value : DEFAULT_FOLDER_SIGNAL_POLICY;
}

export function getRuntimeSettings(): RuntimeSettings {
  const persisted = readPersistedSettings();
  const normalizedSummaryPrompt =
    persisted.summaryPrompt?.trim() === LEGACY_SUMMARY_PROMPT_TEMPLATE ||
    persisted.summaryPrompt?.trim() === PRE_FOLDER_AWARE_SUMMARY_PROMPT_TEMPLATE
      ? DEFAULT_SUMMARY_PROMPT_TEMPLATE
      : persisted.summaryPrompt?.trim();
  const normalizedBundlingPrompt =
    persisted.bundlingPrompt?.trim() === LEGACY_BUNDLING_PROMPT_TEMPLATE ||
    persisted.bundlingPrompt?.trim() === PRE_FOLDER_AWARE_BUNDLING_PROMPT_TEMPLATE
      ? DEFAULT_BUNDLING_PROMPT_TEMPLATE
      : persisted.bundlingPrompt?.trim();
  const normalizedClassificationPrompt =
    persisted.classificationPrompt?.trim() === LEGACY_CLASSIFICATION_PROMPT_TEMPLATE ||
    persisted.classificationPrompt?.trim() === PHASED_CLASSIFICATION_PROMPT_TEMPLATE ||
    persisted.classificationPrompt?.trim() === PRE_FOLDER_AWARE_CLASSIFICATION_PROMPT_TEMPLATE
      ? DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE
      : persisted.classificationPrompt?.trim();
  const normalizedTaggingPrompt =
    persisted.taggingPrompt?.trim() === PRE_FOLDER_AWARE_TAGGING_PROMPT_TEMPLATE
      ? DEFAULT_TAGGING_PROMPT_TEMPLATE
      : persisted.taggingPrompt?.trim();
  const folderSignalPolicy = normalizeFolderSignalPolicy(persisted.folderSignalPolicy);

  return {
    candidateName:
      persisted.candidateName?.trim() || process.env.EB1A_CANDIDATE_NAME || "",
    summaryPrompt:
      normalizedSummaryPrompt ||
      process.env.EB1A_SUMMARY_PROMPT ||
      DEFAULT_SUMMARY_PROMPT_TEMPLATE,
    bundlingPrompt:
      normalizedBundlingPrompt ||
      process.env.EB1A_BUNDLING_PROMPT ||
      DEFAULT_BUNDLING_PROMPT_TEMPLATE,
    classificationPrompt:
      normalizedClassificationPrompt ||
      process.env.EB1A_CLASSIFICATION_PROMPT ||
      DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
    taggingPrompt:
      normalizedTaggingPrompt ||
      process.env.EB1A_TAGGING_PROMPT ||
      DEFAULT_TAGGING_PROMPT_TEMPLATE,
    folderSignalPolicy,
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
    statementOfEligibilityPrompt:
      persisted.statementOfEligibilityPrompt?.trim() ||
      process.env.EB1A_STATEMENT_OF_ELIGIBILITY_PROMPT ||
      DEFAULT_STATEMENT_OF_ELIGIBILITY_PROMPT_TEMPLATE,
    finalMeritsDeterminationPrompt:
      persisted.finalMeritsDeterminationPrompt?.trim() ||
      process.env.EB1A_FINAL_MERITS_DETERMINATION_PROMPT ||
      DEFAULT_FINAL_MERITS_DETERMINATION_PROMPT_TEMPLATE,
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
    archiveConfidenceFloor: Number(
      persisted.archiveConfidenceFloor ??
        process.env.SETU_ARCHIVE_CONFIDENCE_FLOOR ??
        "0.28",
    ),
    linkCheckTimeoutMs: Number(
      persisted.linkCheckTimeoutMs ?? process.env.SETU_LINK_CHECK_TIMEOUT_MS ?? "3500",
    ),
    researchRecencyDays: Number(
      persisted.researchRecencyDays ?? process.env.SETU_RESEARCH_RECENCY_DAYS ?? "180",
    ),
    flagsDbVersion:
      persisted.flagsDbVersion?.trim() || process.env.SETU_FLAGS_DB_VERSION || "2026-06-02",
  };
}

export function saveRuntimeSettings(input: {
  candidateName: string;
  summaryPrompt: string;
  bundlingPrompt: string;
  classificationPrompt: string;
  taggingPrompt: string;
  folderSignalPolicy: FolderSignalPolicy;
  triagePrompt: string;
  strategyPrompt: string;
  stressTestPrompt: string;
  draftPrompt: string;
  statementOfEligibilityPrompt: string;
  finalMeritsDeterminationPrompt: string;
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
    bundlingPrompt:
      input.bundlingPrompt.trim() || DEFAULT_BUNDLING_PROMPT_TEMPLATE,
    classificationPrompt:
      input.classificationPrompt.trim() || DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE,
    taggingPrompt: input.taggingPrompt.trim() || DEFAULT_TAGGING_PROMPT_TEMPLATE,
    folderSignalPolicy: input.folderSignalPolicy,
    triagePrompt: input.triagePrompt.trim() || DEFAULT_TRIAGE_PROMPT_TEMPLATE,
    strategyPrompt: input.strategyPrompt.trim() || DEFAULT_STRATEGY_PROMPT_TEMPLATE,
    stressTestPrompt:
      input.stressTestPrompt.trim() || DEFAULT_STRESS_TEST_PROMPT_TEMPLATE,
    draftPrompt: input.draftPrompt.trim() || DEFAULT_DRAFT_PROMPT_TEMPLATE,
    statementOfEligibilityPrompt:
      input.statementOfEligibilityPrompt.trim() ||
      DEFAULT_STATEMENT_OF_ELIGIBILITY_PROMPT_TEMPLATE,
    finalMeritsDeterminationPrompt:
      input.finalMeritsDeterminationPrompt.trim() ||
      DEFAULT_FINAL_MERITS_DETERMINATION_PROMPT_TEMPLATE,
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
    bundlingPrompt: current.bundlingPrompt,
    classificationPrompt: current.classificationPrompt,
    taggingPrompt: current.taggingPrompt,
    folderSignalPolicy: current.folderSignalPolicy,
    triagePrompt: current.triagePrompt,
    strategyPrompt: current.strategyPrompt,
    stressTestPrompt: current.stressTestPrompt,
    draftPrompt: current.draftPrompt,
    statementOfEligibilityPrompt: current.statementOfEligibilityPrompt,
    finalMeritsDeterminationPrompt: current.finalMeritsDeterminationPrompt,
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
    bundlingPrompt: settings.bundlingPrompt,
    classificationPrompt: settings.classificationPrompt,
    taggingPrompt: settings.taggingPrompt,
    folderSignalPolicy: settings.folderSignalPolicy,
    triagePrompt: settings.triagePrompt,
    strategyPrompt: settings.strategyPrompt,
    stressTestPrompt: settings.stressTestPrompt,
    draftPrompt: settings.draftPrompt,
    statementOfEligibilityPrompt: settings.statementOfEligibilityPrompt,
    finalMeritsDeterminationPrompt: settings.finalMeritsDeterminationPrompt,
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
