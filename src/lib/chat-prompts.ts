import { EB1A_CRITERIA_CATALOG } from "@/lib/constants";
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
  strategyMemo: StrategyMemo | null;
  documents: ClientDocument[];
}) {
  return fillPromptTemplate(input.template, {
    candidateName: input.candidateName,
    sectionKey: input.sectionKey,
    criterionCode: input.criterionCode,
    strategyMemoBlock: input.strategyMemo ? JSON.stringify(input.strategyMemo) : "None",
    evidenceBlock: buildRetrievedDocsBlock(input.documents),
    briefDraftSchema: JSON.stringify(briefDraftJsonSchema),
  });
}
