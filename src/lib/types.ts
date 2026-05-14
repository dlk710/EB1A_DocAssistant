export type JobStatus =
  | "queued"
  | "processing"
  | "canceling"
  | "canceled"
  | "completed"
  | "completed_with_errors"
  | "failed";

export type DocumentStatus = "queued" | "processing" | "completed" | "failed";
export type EventBundleStatus =
  | "idle"
  | "queued"
  | "processing"
  | "canceled"
  | "completed"
  | "failed";
export type CriteriaTaggingStatus =
  | "idle"
  | "queued"
  | "processing"
  | "canceled"
  | "completed"
  | "failed";
export type Eb1aClassificationStatus =
  | "idle"
  | "queued"
  | "processing"
  | "canceled"
  | "completed"
  | "failed";
export type EventBundleKind = "standard" | "archive" | "unwanted";
export type ReviewDisposition =
  | "classified"
  | "unclassified"
  | "archive"
  | "unwanted";
export type DocumentDispositionOverride = Extract<
  ReviewDisposition,
  "archive" | "unwanted"
>;
export type ReviewBucketKind =
  | "criterion"
  | "archive"
  | "unwanted"
  | "human_review";
export type EvidenceReviewStatus = "kept" | "pending" | "archived";
export type CriterionTagRole = "primary" | "supporting";
export type CriterionTagSource = "ai" | "manual";

export interface EvidenceCriterionTag {
  code: string;
  legalCode: string;
  name: string;
  role: CriterionTagRole;
  source: CriterionTagSource;
  confidence: number;
  reasoning: string;
  taggedAt: string;
}

export interface DocumentSummaryPayload {
  title: string;
  shortSummary: string;
  detailedSummary: string;
  evidenceValue: string;
  recommendedUse: string;
  documentType: string;
  confidence: number;
  primaryDate: string | null;
  primaryDateReason: string;
  notableFacts: string[];
  people: string[];
  organizations: string[];
  dates: string[];
  locations: string[];
  tags: string[];
  possibleCriteria: string[];
  missingContext: string[];
  riskFlags: string[];
}

export interface DocumentMetadata {
  extractionMethod: "text" | "vision" | "filename_only";
  sourceKind: string;
  preview: string;
  previewMode: "native" | "quicklook" | "text_extract" | "filename_only";
  pageCount: number | null;
  charCount: number;
  rootFolder: string;
  indexedAt: string;
  relativePath: string;
}

export interface TextModelUsage {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

export interface EmbeddingModelUsage {
  model: string;
  inputTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

export interface DocumentUsage {
  summary: TextModelUsage | null;
  embedding: EmbeddingModelUsage | null;
  totalCostUsd: number | null;
  currency: "USD";
  calculatedAt: string;
}

export interface StoredDocument {
  id: string;
  jobId: string;
  candidateName: string;
  folderLabel: string;
  fileName: string;
  relativePath: string;
  absolutePath: string;
  extension: string;
  mimeType: string;
  bytes: number;
  checksum: string;
  pageCount: number | null;
  extractedCharCount: number;
  sourceKind: string;
  processingStatus: DocumentStatus;
  summary: DocumentSummaryPayload | null;
  metadata: DocumentMetadata | null;
  usage: DocumentUsage | null;
  criteriaTags: EvidenceCriterionTag[];
  reviewStatus: EvidenceReviewStatus;
  reviewStatusSource: "ai" | "manual" | "rule";
  reviewStatusReason: string | null;
  notes: string;
  isPinned: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClientDocument = Omit<StoredDocument, "absolutePath" | "checksum">;

export interface SearchResult extends ClientDocument {
  score: number;
}

export interface JobRecord {
  id: string;
  candidateName: string;
  folderLabel: string;
  status: JobStatus;
  cancellationRequestedAt: string | null;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface SettingsSnapshot {
  candidateName: string;
  summaryPrompt: string;
  classificationPrompt: string;
  taggingPrompt: string;
  hasApiKey: boolean;
  apiKeyMask: string | null;
  summaryModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  qdrantUrl: string;
  qdrantCollection: string;
  storagePath: string;
  outputRootPath: string;
}

export interface LibraryOverview {
  totalDocuments: number;
  completedDocuments: number;
  failedDocuments: number;
  processingDocuments: number;
  latestCompletionAt: string | null;
  totalOpenAiCostUsd: number;
}

export interface EventBundle {
  id: string;
  jobId: string;
  bundleKind: EventBundleKind;
  name: string;
  shortSummary: string;
  detailedSummary: string;
  eventType: string;
  latestRelevantDate: string | null;
  timeframeLabel: string;
  location: string;
  organizations: string[];
  people: string[];
  keywords: string[];
  confidence: number;
  leadDocumentId: string | null;
  evidenceDocumentIds: string[];
}

export interface SubBundle {
  id: string;
  jobId: string;
  parentBundleId: string;
  name: string;
  evidenceDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Eb1aCriterionDecision {
  bundleId: string;
  bucketCode: string;
  bucketName: string;
  bucketKind: ReviewBucketKind;
  primaryCriterionCode: string | null;
  primaryCriterionName: string | null;
  secondaryCriterionCodes: string[];
  secondaryCriterionNames: string[];
  confidence: number;
  rationale: string;
  reviewDisposition: ReviewDisposition;
  unclassifiedReason: string | null;
  suggestedExhibitTitle: string;
}

export interface Eb1aCriterionBucket {
  bucketKind: ReviewBucketKind;
  criterionCode: string;
  criterionName: string;
  folderName: string;
  bundleIds: string[];
}

export interface OutputArtifactReference {
  label: string;
  relativePath: string;
}

export interface WorkspaceEb1aClassificationState {
  version: number;
  jobId: string;
  status: Eb1aClassificationStatus;
  message: string;
  decisions: Eb1aCriterionDecision[];
  buckets: Eb1aCriterionBucket[];
  unclassifiedBundleIds: string[];
  sourceBundleCount: number;
  sourceBundleUpdatedAt: string | null;
  sourceBundleVersion: number;
  promptFingerprint: string;
  outputRootPath: string;
  outputFolderPath: string | null;
  outputArtifacts: OutputArtifactReference[];
  totalCostUsd: number;
  updatedAt: string;
  error: string | null;
}

export interface WorkspaceEventBundleState {
  version: number;
  jobId: string;
  status: EventBundleStatus;
  message: string;
  bundles: EventBundle[];
  sourceDocumentCount: number;
  sourceLatestDocumentUpdateAt: string | null;
  totalCostUsd: number;
  updatedAt: string;
  error: string | null;
}

export interface WorkspaceCriteriaTaggingState {
  version: number;
  jobId: string;
  status: CriteriaTaggingStatus;
  message: string;
  taggedDocuments: number;
  failedDocumentIds: string[];
  sourceDocumentCount: number;
  sourceLatestDocumentUpdateAt: string | null;
  sourceBundleVersion: number;
  sourceClassificationVersion: number;
  sourceBundleUpdatedAt: string | null;
  sourceClassificationUpdatedAt: string | null;
  promptFingerprint: string;
  totalCostUsd: number;
  updatedAt: string;
  error: string | null;
}

export interface WorkspaceCoverageCriterion {
  code: string;
  legalCode: string;
  name: string;
  state: "strong" | "partial" | "empty";
  keptCount: number;
  primaryCount: number;
  supportingCount: number;
}

export interface WorkspaceCoverage {
  strongCount: number;
  meetsMinimum: boolean;
  criteria: WorkspaceCoverageCriterion[];
}

export interface WorkspaceManualOverrideState {
  version: number;
  jobId: string;
  updatedAt: string;
  categoryOverrides: Record<string, string>;
  documentEventOverrides: Record<string, string>;
  documentDispositionOverrides: Record<string, DocumentDispositionOverride>;
  outputRootPath: string;
  outputFolderPath: string | null;
  outputArtifacts: OutputArtifactReference[];
}

export interface WorkspaceReviewState {
  version: number;
  jobId: string;
  updatedAt: string;
  bannerDismissedAt: string | null;
  subBundles: SubBundle[];
}

export interface LibrarySnapshot {
  activeJobId: string | null;
  activeJob: JobRecord | null;
  overview: LibraryOverview;
  jobs: JobRecord[];
  documents: ClientDocument[];
  eventBundles: WorkspaceEventBundleState | null;
  eb1aClassification: WorkspaceEb1aClassificationState | null;
  criteriaTagging: WorkspaceCriteriaTaggingState | null;
  coverage: WorkspaceCoverage | null;
  manualOverrides: WorkspaceManualOverrideState | null;
  reviewState: WorkspaceReviewState | null;
  settings: SettingsSnapshot;
}
