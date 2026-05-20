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
export type EvidenceReviewStatus = "kept" | "pending" | "reference" | "archived";
export type CriterionTagRole = "primary" | "supporting";
export type CriterionTagSource = "ai" | "manual";
export type PetitionType = "EB-1A";
export type ClientStatus =
  | "onboarding"
  | "reviewing"
  | "strategizing"
  | "locked"
  | "drafting"
  | "synthesizing"
  | "stitching"
  | "filed"
  | "rfe-response"
  | "decided"
  | "archived";

export interface Client {
  id: string;
  displayName: string;
  petitionType: PetitionType;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  filingTargetDate: string | null;
  filedAt: string | null;
  decidedAt: string | null;
  decision: "approved" | "denied" | "rfe" | "withdrawn" | null;
  notes: string;
  lockedStrategyVersion: number | null;
  lockedAt: string | null;
}

export interface ClientSummary {
  id: string;
  displayName: string;
  petitionType: PetitionType;
  status: ClientStatus;
  updatedAt: string;
  lockedStrategyVersion: number | null;
  lockedAt: string | null;
}

export interface ClientWorkspace {
  id: string;
  clientId: string;
  candidateName: string;
  folderLabel: string;
  status: JobStatus;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
  ready: boolean;
  failedFiles: number;
}

export interface ClientTimelineEvent {
  id: string;
  clientId: string;
  occurredAt: string;
  kind:
    | "client-created"
    | "workspace-added"
    | "pipeline-completed"
    | "review-action-taken"
    | "review-completed"
    | "manual-override"
    | string;
  workspaceId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
}

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
  clientId: string;
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
  bundlingPrompt: string;
  classificationPrompt: string;
  taggingPrompt: string;
  triagePrompt: string;
  strategyPrompt: string;
  stressTestPrompt: string;
  draftPrompt: string;
  statementOfEligibilityPrompt: string;
  finalMeritsDeterminationPrompt: string;
  activeStyleProfileId: string;
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
  documentBundleDecisions: Record<
    string,
    {
      status: "accepted" | "other";
      updatedAt: string;
    }
  >;
  bundleCriterionDecisions: Record<
    string,
    {
      status: "accepted" | "other";
      criterionCode: string | null;
      updatedAt: string;
    }
  >;
}

export interface LibrarySnapshot {
  activeClientId: string | null;
  activeClient: Client | null;
  clients: ClientSummary[];
  activeJobId: string | null;
  activeJob: JobRecord | null;
  overview: LibraryOverview;
  clientOverview: LibraryOverview;
  jobs: JobRecord[];
  clientWorkspaces: ClientWorkspace[];
  documents: ClientDocument[];
  clientDocuments: ClientDocument[];
  eventBundles: WorkspaceEventBundleState | null;
  eb1aClassification: WorkspaceEb1aClassificationState | null;
  criteriaTagging: WorkspaceCriteriaTaggingState | null;
  coverage: WorkspaceCoverage | null;
  clientCoverage: WorkspaceCoverage | null;
  manualOverrides: WorkspaceManualOverrideState | null;
  reviewState: WorkspaceReviewState | null;
  settings: SettingsSnapshot;
}

export type ChatMode = "triage" | "strategy" | "stress-test" | "draft";
export type ChatArtifactKind = "strategy-memo" | "stress-test-report" | "brief-draft";

export interface ModeClassification {
  mode: ChatMode;
  confidence: number;
  alternateMode: ChatMode | null;
  reasoning: string;
}

export interface TriageAnswerBlock {
  text: string;
  docIds: string[];
}

export interface TriageAnswer {
  schemaVersion: "triage-answer/1.0";
  answer: TriageAnswerBlock[];
  insufficiencyNote: string | null;
}

export interface StrategyCriterionRecommendation {
  criterionCode: string;
  rationale: string;
  anchorDocIds: string[];
}

export interface StrategyMemo {
  schemaVersion: "strategy-memo/2.0";
  clientId: string;
  workspaceIds: string[];
  createdAt: string;
  petitionType: "EB-1A";
  pendingDocsConsidered: number;
  recommendedMix: {
    primary: StrategyCriterionRecommendation[];
    supporting: StrategyCriterionRecommendation[];
    decline: Array<{
      criterionCode: string;
      rationale: string;
    }>;
  };
  leadArgument: {
    criterionCode: string;
    narrativeSpine: string;
    anchorDocIds: string[];
  };
  gaps: Array<{
    criterionCode: string;
    type:
      | "insufficient-quantity"
      | "lack-of-independence"
      | "lack-of-significance"
      | "missing-context";
    description: string;
    suggestedAdditions: string[];
  }>;
  risks: Array<{
    type: string;
    description: string;
    severity: "low" | "medium" | "high";
    affectedDocIds: string[];
  }>;
  citations: Array<{
    docId: string;
    claim: string;
  }>;
}

export interface StressTestReport {
  schemaVersion: "stress-test/2.0";
  clientId: string;
  workspaceIds: string[];
  createdAt: string;
  scope: "full-petition" | { criterionCode: string };
  strategyMemoVersion: string | null;
  pendingDocsConsidered: number;
  challenges: Array<{
    criterionCode: string;
    challengeType:
      | "insufficiency"
      | "lack-of-independence"
      | "lack-of-significance"
      | "comparability"
      | "sustained-acclaim";
    uscisStance: string;
    atRiskDocIds: string[];
    currentMitigation: string;
    suggestedAction: "add-evidence" | "rewrite-brief" | "reorganize" | "accept-risk";
    suggestedActionDetail: string;
    severity: "low" | "medium" | "high";
  }>;
}

export interface BriefDraftParagraph {
  id?: string;
  text: string;
  exhibitRefs: string[];
  citations: Array<{
    docId: string;
    supports: string;
  }>;
  factCheckStatus?: "verified" | "drift-detected" | "uncited" | "pending";
  factCheckNotes?: string;
}

export interface BriefDraft {
  schemaVersion: "brief-draft/2.0";
  clientId: string;
  createdAt: string;
  section:
    | "statement-of-eligibility"
    | "criterion-argument"
    | "final-merits-determination"
    | "introduction"
    | "conclusion";
  targetCriterionCode: string | null;
  title: string;
  paragraphs: BriefDraftParagraph[];
  wordCount: number;
  genericProseWarning?: string | null;
  styleProfileId?: string | null;
  styleExemplarIds?: string[];
  retrievedDocIds?: string[];
}

export interface SynthesisChatDraft {
  schemaVersion: "synthesis-draft/1.0";
  clientId: string;
  createdAt: string;
  kind: SynthesisSectionKind;
  title: string;
  paragraphs: SynthesisParagraph[];
  wordCount: number;
  genericProseWarning?: string | null;
  styleProfileId?: string | null;
  styleExemplarIds?: string[];
  referencedCriteria?: string[];
}

export interface ChatMessageCitation {
  docId: string;
  workspaceId: string;
  excerpt: string;
  supports: string;
  label: string;
}

export interface RetrievalResult {
  docIds: string[];
  scope: "workspace" | "client" | "criterion";
  excludedReason?: Record<string, string>;
}

export interface ChatResponse {
  text: string;
  artifact?: StrategyMemo | StressTestReport | BriefDraft | SynthesisChatDraft;
  citations: ChatMessageCitation[];
  reasoning: string;
  droppedClaims: string[];
  pendingDisclosure: string | null;
}

export interface ChatTurn {
  id: string;
  sessionId: string;
  occurredAt: string;
  userMessage: string;
  mode: ChatMode;
  modeWasProposed: boolean;
  retrieval: RetrievalResult;
  response: ChatResponse;
  costUsd: number;
  pendingDocsConsidered: number;
  classification: ModeClassification | null;
}

export interface ChatSession {
  id: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  mode: ChatMode;
  turns: ChatTurn[];
}

export interface ChatArtifactRecord {
  id: string;
  clientId: string;
  kind: ChatArtifactKind;
  createdAt: string;
  sessionId: string;
  turnId: string;
  version: number;
  title: string;
  workspaceIds: string[];
  strategyMemo?: StrategyMemo | null;
  stressTestReport?: StressTestReport | null;
  briefDraft?: BriefDraft | null;
}

export interface ExhibitAssignment {
  documentId: string;
  workspaceId: string;
  exhibitNumber: number;
  exhibitLabel: string;
  order: number;
}

export interface LockedCriterionEntry {
  criterionCode: string;
  legalCode: string;
  criterionName: string;
  role: CriterionTagRole;
  rationale: string;
  anchorDocIds: string[];
  anchorExhibits: ExhibitAssignment[];
}

export interface LockedDeclinedCriterion {
  criterionCode: string;
  legalCode: string;
  criterionName: string;
  rationale: string;
}

export interface LockedDocumentSnapshot {
  documentId: string;
  workspaceId: string;
  reviewStatus: EvidenceReviewStatus;
  updatedAt: string;
}

export interface LockedCaseStrategy {
  version: number;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  sourceStrategyMemoArtifactId: string | null;
  sourceStressTestArtifactId: string | null;
  narrativeSpine: string;
  primary: LockedCriterionEntry[];
  supporting: LockedCriterionEntry[];
  declined: LockedDeclinedCriterion[];
  documentsSnapshot: LockedDocumentSnapshot[];
  totalExhibits: number;
}

export interface PinboardEntry {
  documentId: string;
  workspaceId: string;
  exhibitLabel: string;
  addedAt: string;
}

export interface CriterionPinboard {
  clientId: string;
  criterionCode: string;
  createdAt: string;
  updatedAt: string;
  entries: PinboardEntry[];
}

export interface LegacyCriterionDraftVersion {
  id: string;
  createdAt: string;
  title: string;
  content: string;
}

export interface DraftCitation {
  docId: string;
  workspaceId: string;
  excerpt: string;
  supports: string;
  characterRange?: [number, number];
}

export interface DraftParagraph {
  id: string;
  text: string;
  exhibitRefs: string[];
  citations: DraftCitation[];
  factCheckStatus: "verified" | "drift-detected" | "uncited" | "pending";
  factCheckNotes?: string;
}

export interface DraftVersion {
  version: number;
  createdAt: string;
  source: "ai" | "manual" | "ai-edited";
  authorNotes: string;
  paragraphs: DraftParagraph[];
  wordCount: number;
  costUsd: number;
}

export interface CriterionDraft {
  id?: string;
  clientId: string;
  criterionCode: string;
  createdAt: string;
  updatedAt: string;
  status: "in-progress" | "approved" | "out-of-date";
  versions: DraftVersion[];
  latestApprovedVersion?: number | null;
  outOfDate?: boolean;
}

export type SynthesisSectionKind =
  | "statement-of-eligibility"
  | "final-merits-determination";

export interface SynthesisCitation {
  docId?: string;
  workspaceId?: string;
  excerpt?: string;
  criterionDraftId?: string;
  draftVersionParagraphId?: string;
  draftExcerpt?: string;
  supports: string;
}

export interface SynthesisParagraph {
  id: string;
  text: string;
  exhibitRefs: string[];
  criterionRefs: string[];
  citations: SynthesisCitation[];
  factCheckStatus: "verified" | "drift-detected" | "uncited" | "pending";
  factCheckNotes?: string;
}

export interface SynthesisVersion {
  version: number;
  createdAt: string;
  source: "ai" | "manual" | "ai-edited";
  authorNotes: string;
  paragraphs: SynthesisParagraph[];
  wordCount: number;
  costUsd: number;
  referencedCriteria: string[];
  genericProseWarning?: string | null;
  styleProfileId?: string | null;
  styleExemplarIds?: string[];
}

export interface SynthesisDraft {
  id: string;
  clientId: string;
  kind: SynthesisSectionKind;
  status: "in-progress" | "approved" | "out-of-date";
  versions: SynthesisVersion[];
  latestApprovedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleExemplar {
  id: string;
  label: string;
  criterionCode: string;
  kind?: SynthesisSectionKind | null;
  text: string;
  approvedOutcome: boolean;
  notes: string;
}

export interface StyleProfile {
  id: string;
  attorneyId: string;
  displayName: string;
  exemplars: StyleExemplar[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BatesRange {
  start: string;
  end: string;
}

export interface ExhibitIndexEntry {
  exhibitNumber: string;
  title: string;
  workspaceId: string;
  docId: string;
  pageRange: { start: number; end: number };
  bates: BatesRange;
}

export interface AuditFinding {
  id: string;
  severity: "blocking" | "warning" | "info";
  kind:
    | "pinned-exhibit-uncited"
    | "cited-exhibit-missing"
    | "criterion-reference-out-of-sync"
    | "draft-source-out-of-date"
    | "exhibit-numbering-gap"
    | "bates-pagination-error"
    | "unsupported-exhibit-type"
    | string;
  description: string;
  affectedSection?: string;
  affectedExhibit?: string;
  suggestedActions: Array<{ label: string; action: string }>;
}

export interface CoverSheetContent {
  candidateName: string;
  petitionType: string;
  filedDate: string | null;
  attorneyName: string | null;
  firmName: string | null;
  preparedBy: "Setu";
}

export interface TocEntry {
  sectionTitle: string;
  startingBates: string;
  startingPage: number;
}

export type PetitionSection =
  | { kind: "cover"; content: CoverSheetContent; bates: BatesRange; pageCount: number }
  | { kind: "table-of-contents"; entries: TocEntry[]; bates: BatesRange; pageCount: number }
  | {
      kind: "statement-of-eligibility";
      sourceSynthesisVersion: number;
      content: string;
      bates: BatesRange;
      pageCount: number;
    }
  | {
      kind: "criterion-argument";
      criterionCode: string;
      sourceDraftVersion: number;
      content: string;
      bates: BatesRange;
      pageCount: number;
    }
  | {
      kind: "final-merits-determination";
      sourceSynthesisVersion: number;
      content: string;
      bates: BatesRange;
      pageCount: number;
    }
  | {
      kind: "exhibit-index";
      entries: ExhibitIndexEntry[];
      bates: BatesRange;
      pageCount: number;
    }
  | {
      kind: "exhibit";
      exhibitNumber: string;
      sourceDocId: string;
      workspaceId: string;
      title: string;
      sourcePath: string;
      sourceMimeType: string;
      bates: BatesRange;
      pageCount: number;
    };

export interface AssembledPetition {
  id: string;
  clientId: string;
  generatedAt: string;
  generatedBy: string;
  status: "draft" | "ready" | "exported";
  sections: PetitionSection[];
  exhibitIndex: ExhibitIndexEntry[];
  batesRange: { start: string; end: string };
  totalPages: number;
  findings: AuditFinding[];
  invalidatedAt: string | null;
  invalidationReason: string | null;
  pdfPath: string | null;
}
