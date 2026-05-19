import path from "node:path";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import { ensureClientTimelineEvent } from "@/lib/timeline";
import { ensureClientStorage, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import { updateClient } from "@/lib/clients";
import { getCriterionPinboard, upsertCriterionPinboard } from "@/lib/pinboards";
import type {
  ClientDocument,
  CriterionDraft,
  ExhibitAssignment,
  LockedCaseStrategy,
  LockedCriterionEntry,
  LockedDeclinedCriterion,
  PinboardEntry,
  StrategyMemo,
} from "@/lib/types";

function getLockedStrategyPath(clientId: string) {
  return path.join(ensureClientStorage(clientId), "locked-strategy.json");
}

function getLockHistoryDirectory(clientId: string) {
  return path.join(ensureClientStorage(clientId), "locked-strategy-history");
}

function getCriterionDraftPath(clientId: string, criterionCode: string) {
  return path.join(ensureClientStorage(clientId), "drafts", `${criterionCode}.json`);
}

function criterionMeta(code: string) {
  return (
    EB1A_CRITERIA_DEFINITIONS.find((criterion) => criterion.code === code) ?? {
      code,
      legalCode: code,
      name: code,
    }
  );
}

function buildExhibitAssignments(
  recommendations: StrategyMemo["recommendedMix"]["primary"],
  documents: ClientDocument[],
  startingNumber: number,
) {
  const documentLookup = new Map(documents.map((document) => [document.id, document]));
  let nextNumber = startingNumber;

  const entries: LockedCriterionEntry[] = recommendations.map((recommendation) => {
    const meta = criterionMeta(recommendation.criterionCode);
    const anchorDocIds = [...new Set(recommendation.anchorDocIds)].filter((docId) =>
      documentLookup.has(docId),
    );

    const anchorExhibits: ExhibitAssignment[] = anchorDocIds.map((documentId, index) => {
      const document = documentLookup.get(documentId)!;
      const exhibitLabel =
        anchorDocIds.length > 1
          ? `Ex. ${nextNumber}${String.fromCharCode(65 + index)}`
          : `Ex. ${nextNumber}`;

      return {
        documentId,
        workspaceId: document.jobId,
        exhibitNumber: nextNumber,
        exhibitLabel,
        order: index,
      };
    });

    nextNumber += 1;

    return {
      criterionCode: recommendation.criterionCode,
      legalCode: meta.legalCode,
      criterionName: meta.name,
      role: "primary",
      rationale: recommendation.rationale,
      anchorDocIds,
      anchorExhibits,
    };
  });

  return {
    entries,
    nextNumber,
  };
}

function buildSupportingAssignments(
  recommendations: StrategyMemo["recommendedMix"]["supporting"],
  documents: ClientDocument[],
  startingNumber: number,
) {
  const documentLookup = new Map(documents.map((document) => [document.id, document]));
  let nextNumber = startingNumber;

  const entries: LockedCriterionEntry[] = recommendations.map((recommendation) => {
    const meta = criterionMeta(recommendation.criterionCode);
    const anchorDocIds = [...new Set(recommendation.anchorDocIds)].filter((docId) =>
      documentLookup.has(docId),
    );

    const anchorExhibits: ExhibitAssignment[] = anchorDocIds.map((documentId, index) => {
      const document = documentLookup.get(documentId)!;
      const exhibitLabel =
        anchorDocIds.length > 1
          ? `Ex. ${nextNumber}${String.fromCharCode(65 + index)}`
          : `Ex. ${nextNumber}`;

      return {
        documentId,
        workspaceId: document.jobId,
        exhibitNumber: nextNumber,
        exhibitLabel,
        order: index,
      };
    });

    nextNumber += 1;

    return {
      criterionCode: recommendation.criterionCode,
      legalCode: meta.legalCode,
      criterionName: meta.name,
      role: "supporting",
      rationale: recommendation.rationale,
      anchorDocIds,
      anchorExhibits,
    };
  });

  return {
    entries,
    nextNumber,
  };
}

function buildDeclinedEntries(
  decline: StrategyMemo["recommendedMix"]["decline"],
): LockedDeclinedCriterion[] {
  return decline.map((entry) => {
    const meta = criterionMeta(entry.criterionCode);

    return {
      criterionCode: entry.criterionCode,
      legalCode: meta.legalCode,
      criterionName: meta.name,
      rationale: entry.rationale,
    };
  });
}

export function getLockedStrategy(clientId: string) {
  return readAbsoluteStateFile<LockedCaseStrategy | null>(getLockedStrategyPath(clientId), null);
}

export function saveLockedStrategy(strategy: LockedCaseStrategy) {
  writeAbsoluteStateFile(getLockedStrategyPath(strategy.clientId), strategy);
}

export function getCriterionDraft(clientId: string, criterionCode: string) {
  return readAbsoluteStateFile<CriterionDraft | null>(getCriterionDraftPath(clientId, criterionCode), null);
}

export function listCriterionDrafts(clientId: string, criterionCodes?: string[]) {
  if (criterionCodes?.length) {
    return criterionCodes
      .map((criterionCode) => getCriterionDraft(clientId, criterionCode))
      .filter((draft): draft is CriterionDraft => Boolean(draft));
  }

  const directory = path.join(ensureClientStorage(clientId), "drafts");
  return readAbsoluteStateFile<string[]>(path.join(directory, "__index__.json"), [])
    .map((criterionCode) => getCriterionDraft(clientId, criterionCode))
    .filter((draft): draft is CriterionDraft => Boolean(draft));
}

function saveDraftIndex(clientId: string, criterionCodes: string[]) {
  const directory = path.join(ensureClientStorage(clientId), "drafts");
  writeAbsoluteStateFile(path.join(directory, "__index__.json"), [...new Set(criterionCodes)]);
}

export function saveCriterionDraft(draft: CriterionDraft) {
  const existingCodes = listCriterionDrafts(draft.clientId).map((entry) => entry.criterionCode);
  saveDraftIndex(draft.clientId, [...existingCodes, draft.criterionCode]);
  writeAbsoluteStateFile(getCriterionDraftPath(draft.clientId, draft.criterionCode), draft);
}

function ensureDraftSkeletons(clientId: string, criterionCodes: string[]) {
  criterionCodes.forEach((criterionCode) => {
    const existing = getCriterionDraft(clientId, criterionCode);

    if (existing) {
      return;
    }

    const now = new Date().toISOString();
    saveCriterionDraft({
      clientId,
      criterionCode,
      createdAt: now,
      updatedAt: now,
      status: "in-progress",
      outOfDate: false,
      versions: [],
    });
  });
}

function createPinboards(clientId: string, lockedStrategy: LockedCaseStrategy) {
  [...lockedStrategy.primary, ...lockedStrategy.supporting].forEach((entry) => {
    const existing = getCriterionPinboard(clientId, entry.criterionCode);
    const entries: PinboardEntry[] = entry.anchorExhibits.map((assignment) => ({
      documentId: assignment.documentId,
      workspaceId: assignment.workspaceId,
      exhibitLabel: assignment.exhibitLabel,
      addedAt: new Date().toISOString(),
    }));

    upsertCriterionPinboard({
      clientId,
      criterionCode: entry.criterionCode,
      entries: existing?.entries?.length ? existing.entries : entries,
    });
  });
}

export function lockClientStrategy(input: {
  clientId: string;
  memoArtifactId: string | null;
  stressTestArtifactId: string | null;
  strategyMemo: StrategyMemo;
  clientDocuments: ClientDocument[];
  narrativeSpine: string;
}) {
  const now = new Date().toISOString();
  const existing = getLockedStrategy(input.clientId);
  const primaryAssignments = buildExhibitAssignments(
    input.strategyMemo.recommendedMix.primary,
    input.clientDocuments,
    1,
  );
  const supportingAssignments = buildSupportingAssignments(
    input.strategyMemo.recommendedMix.supporting,
    input.clientDocuments,
    primaryAssignments.nextNumber,
  );

  const lockedStrategy: LockedCaseStrategy = {
    version: (existing?.version ?? 0) + 1,
    clientId: input.clientId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sourceStrategyMemoArtifactId: input.memoArtifactId,
    sourceStressTestArtifactId: input.stressTestArtifactId,
    narrativeSpine: input.narrativeSpine,
    primary: primaryAssignments.entries,
    supporting: supportingAssignments.entries,
    declined: buildDeclinedEntries(input.strategyMemo.recommendedMix.decline),
    documentsSnapshot: input.clientDocuments.map((document) => ({
      documentId: document.id,
      workspaceId: document.jobId,
      reviewStatus: document.reviewStatus,
      updatedAt: document.updatedAt,
    })),
    totalExhibits:
      primaryAssignments.entries.reduce((sum, entry) => sum + entry.anchorExhibits.length, 0) +
      supportingAssignments.entries.reduce((sum, entry) => sum + entry.anchorExhibits.length, 0),
  };

  saveLockedStrategy(lockedStrategy);
  createPinboards(input.clientId, lockedStrategy);
  ensureDraftSkeletons(
    input.clientId,
    [...lockedStrategy.primary, ...lockedStrategy.supporting].map((entry) => entry.criterionCode),
  );
  updateClient(input.clientId, {
    status: "locked",
    lockedStrategyVersion: lockedStrategy.version,
    lockedAt: now,
  });
  ensureClientTimelineEvent({
    id: `${input.clientId}:case-locked:${lockedStrategy.version}`,
    clientId: input.clientId,
    occurredAt: now,
    kind: "case-locked",
    workspaceId: null,
    summary: "Case strategy locked and exhibit numbers assigned.",
    metadata: {
      version: lockedStrategy.version,
      totalExhibits: lockedStrategy.totalExhibits,
      primaryCriteria: lockedStrategy.primary.map((entry) => entry.criterionCode),
      supportingCriteria: lockedStrategy.supporting.map((entry) => entry.criterionCode),
    },
  });

  return lockedStrategy;
}

export function unlockClientStrategy(clientId: string) {
  const locked = getLockedStrategy(clientId);

  if (!locked) {
    return {
      lockedStrategy: null,
      affectedDrafts: [] as CriterionDraft[],
    };
  }

  const historyPath = path.join(getLockHistoryDirectory(clientId), `${locked.updatedAt.replace(/[:.]/g, "-")}.json`);
  writeAbsoluteStateFile(historyPath, locked);

  const affectedCodes = [...locked.primary, ...locked.supporting].map((entry) => entry.criterionCode);
  const affectedDrafts = listCriterionDrafts(clientId, affectedCodes).map((draft) => {
    const nextDraft: CriterionDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
      outOfDate: true,
    };
    saveCriterionDraft(nextDraft);
    return nextDraft;
  });

  writeAbsoluteStateFile(getLockedStrategyPath(clientId), null);
  updateClient(clientId, {
    status: "strategizing",
    lockedStrategyVersion: null,
    lockedAt: null,
  });
  ensureClientTimelineEvent({
    id: `${clientId}:case-unlocked:${new Date().toISOString()}`,
    clientId,
    occurredAt: new Date().toISOString(),
    kind: "case-unlocked",
    workspaceId: null,
    summary: "Case strategy unlocked; dependent drafts were flagged out-of-date.",
    metadata: {
      affectedDrafts: affectedDrafts.map((draft) => draft.criterionCode),
    },
  });

  return {
    lockedStrategy: locked,
    affectedDrafts,
  };
}
