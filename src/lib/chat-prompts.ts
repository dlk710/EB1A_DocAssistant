import type { StyleExemplar } from "@/lib/types";
import { EB1A_CRITERIA_CATALOG } from "@/lib/constants";
import { buildClientCoverage } from "@/lib/coverage";
import { renderCriterionPromptTemplate } from "@/lib/criterion-prompts";
import { buildPreliminaryStrategyGuidance } from "@/lib/preliminary-strategy";
import { fillPromptTemplate } from "@/lib/prompt-library";
import type { ClientDocument, LibrarySnapshot, StrategyMemo } from "@/lib/types";
import {
  briefDraftJsonSchema,
  buildCoverageBlock,
  buildKeptDocsBlock,
  buildPendingDocsBlock,
  buildRetrievedDocsBlock,
  strategyMemoJsonSchema,
  stressTestReportJsonSchema,
} from "@/lib/chat-modes";

export function renderTriagePrompt(input: {
  template: string;
  candidateName: string;
  documents: ClientDocument[];
}) {
  return fillPromptTemplate(input.template, {
    candidateName: input.candidateName,
    retrievedDocsBlock: buildRetrievedDocsBlock(input.documents),
  });
}

function formatWeightedEvidence(
  entries: ReturnType<typeof buildPreliminaryStrategyGuidance>["evidencePlan"]["anchor"],
  limit: number,
) {
  if (!entries.length) {
    return "None.";
  }

  return entries
    .slice(0, limit)
    .map((entry) => {
      const criteria = entry.criterionCodes.length
        ? entry.criterionCodes.join(", ")
        : "no criterion";

      return `[doc:${entry.documentId}] ${entry.fileName} :: criteria ${criteria} :: confidence ${Math.round(entry.highestConfidence * 100)}% :: ${entry.reason}`;
    })
    .join("\n");
}

export function buildEvidenceWeightingBlock(documents: ClientDocument[]) {
  const guidance = buildPreliminaryStrategyGuidance(documents);
  const coverage = buildClientCoverage(documents);
  const likelyPrimary = guidance.primary.map((signal) => `${signal.code} ${signal.name}`);
  const likelySupporting = guidance.supporting.map((signal) => `${signal.code} ${signal.name}`);
  const recommendedCriteria =
    coverage.recommendations?.buildAround
      .map(
        (entry) =>
          `${entry.role.toUpperCase()} ${entry.criterionCode} ${entry.name}: ${entry.rationale} Anchor docs: ${entry.anchorDocIds.join(", ") || "none"}.`,
      )
      .join("\n") || "None yet.";
  const dropCriteria =
    coverage.recommendations?.drop
      .map((entry) => `${entry.criterionCode} ${entry.name}: ${entry.rationale}`)
      .join("\n") || "None yet.";

  return [
    "Prefer anchor and supporting evidence as StrategyMemo anchorDocIds.",
    "Do not use excluded documents as anchorDocIds unless there is no stronger alternative and the risk is disclosed.",
    "Use the deterministic Setu recommendation below as a starting point, but do not auto-drop any criterion; the attorney selects at Lock.",
    `Recommended build-around criteria:\n${recommendedCriteria}`,
    `Criteria to defer/drop unless attorney overrides:\n${dropCriteria}`,
    `Likely primary criteria: ${likelyPrimary.join(", ") || "none yet"}.`,
    `Likely supporting criteria: ${likelySupporting.join(", ") || "none yet"}.`,
    `Anchor candidates:\n${formatWeightedEvidence(guidance.evidencePlan.anchor, 15)}`,
    `Supporting candidates:\n${formatWeightedEvidence(guidance.evidencePlan.supporting, 15)}`,
    `Context-only candidates:\n${formatWeightedEvidence(guidance.evidencePlan.context, 10)}`,
    `Exclude from initial packet unless attorney overrides:\n${formatWeightedEvidence(guidance.evidencePlan.exclusions, 20)}`,
  ].join("\n");
}

export function renderStrategyPrompt(input: {
  template: string;
  candidateName: string;
  snapshot: LibrarySnapshot;
  keptDocuments: ClientDocument[];
  pendingDocuments: ClientDocument[];
}) {
  const evidenceWeightingBlock = buildEvidenceWeightingBlock(input.snapshot.clientDocuments);
  const coverageBlock = input.template.includes("{{evidenceWeightingBlock}}")
    ? buildCoverageBlock(input.snapshot)
    : `${buildCoverageBlock(input.snapshot)}\n\nAI evidence weighting guidance:\n${evidenceWeightingBlock}`;

  return fillPromptTemplate(input.template, {
    candidateName: input.candidateName,
    criteriaCatalog: EB1A_CRITERIA_CATALOG,
    coverageBlock,
    evidenceWeightingBlock,
    keptDocsBlock: buildKeptDocsBlock(input.keptDocuments),
    pendingDocsBlock: buildPendingDocsBlock(input.pendingDocuments),
    strategySchema: JSON.stringify(strategyMemoJsonSchema),
  });
}

export function renderStressTestPrompt(input: {
  template: string;
  candidateName: string;
  strategyMemo: StrategyMemo | null;
  adHocScope: string;
  documents: ClientDocument[];
}) {
  return fillPromptTemplate(input.template, {
    candidateName: input.candidateName,
    strategyMemoBlock: input.strategyMemo
      ? JSON.stringify(input.strategyMemo)
      : "No pinned strategy memo is currently available.",
    adHocScope: input.adHocScope,
    retrievedDocsBlock: buildRetrievedDocsBlock(input.documents),
    stressTestSchema: JSON.stringify(stressTestReportJsonSchema),
  });
}

export function renderDraftPrompt(input: {
  template: string;
  candidateName: string;
  sectionKey: string;
  criterionCode: string;
  criterionKind?: "standard" | "comparable-evidence";
  standardCriterionInvoked?: string;
  comparableEvidenceRationale?: string;
  focusedSubsectionTitle?: string;
  focusedSubsectionPath?: string;
  focusedSubsectionSupportsClaim?: string;
  strategyMemo: StrategyMemo | null;
  documents: ClientDocument[];
  pinnedExhibitsBlock: string;
  styleExemplars: StyleExemplar[];
}) {
  const stylebookExemplars = input.styleExemplars.length
    ? input.styleExemplars
        .map(
          (exemplar, index) =>
            `Exemplar ${index + 1} (${exemplar.criterionCode}) — ${exemplar.label}\n${exemplar.text}`,
        )
        .join("\n\n")
    : "No style exemplars are currently available. Stay declarative and evidence-led.";

  return fillPromptTemplate(input.template, {
    candidateName: input.candidateName,
    sectionKey: input.sectionKey,
    criterionCode: input.criterionCode,
    "petitioner.legalName": input.candidateName,
    "petitioner.honorific": "the petitioner",
    "petitioner.field":
      input.strategyMemo?.leadArgument.narrativeSpine.split(".")[0] || "the petitioner's field",
    strategyMemoBlock: input.strategyMemo ? JSON.stringify(input.strategyMemo) : "None",
    evidenceBlock: buildRetrievedDocsBlock(input.documents),
    pinnedExhibitsBlock: input.pinnedExhibitsBlock,
    stylebookExemplars,
    styleExemplars: stylebookExemplars,
    criterionStructureBlock: renderCriterionPromptTemplate({
      criterionCode: input.criterionCode,
      kind: input.criterionKind || "standard",
    }),
    standardCriterionInvoked: input.standardCriterionInvoked || "",
    comparableEvidenceRationale: input.comparableEvidenceRationale || "",
    focusedSubsectionTitle: input.focusedSubsectionTitle || "",
    focusedSubsectionPath: input.focusedSubsectionPath || "",
    focusedSubsectionSupportsClaim: input.focusedSubsectionSupportsClaim || "",
    briefDraftSchema: JSON.stringify(briefDraftJsonSchema),
  });
}
