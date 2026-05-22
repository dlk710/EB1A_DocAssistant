import type { StyleExemplar } from "@/lib/types";
import { EB1A_CRITERIA_CATALOG } from "@/lib/constants";
import { renderCriterionPromptTemplate } from "@/lib/criterion-prompts";
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

export function renderStrategyPrompt(input: {
  template: string;
  candidateName: string;
  snapshot: LibrarySnapshot;
  keptDocuments: ClientDocument[];
  pendingDocuments: ClientDocument[];
}) {
  return fillPromptTemplate(input.template, {
    candidateName: input.candidateName,
    criteriaCatalog: EB1A_CRITERIA_CATALOG,
    coverageBlock: buildCoverageBlock(input.snapshot),
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
