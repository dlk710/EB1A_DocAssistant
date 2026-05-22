import path from "node:path";
import { EB1A_CRITERIA_DEFINITIONS, getCriterionDisplayName } from "@/lib/constants";
import { buildDefaultLetterMap, renderExhibitLabel, renderExhibitNumber } from "@/lib/exhibit-numbering";
import { updateClient } from "@/lib/clients";
import {
  ensureCriterionDraft,
  getCriterionDraft,
  listCriterionDrafts,
  markCriterionDraftOutOfDate,
} from "@/lib/drafts";
import { getCriterionPinboard, upsertCriterionPinboard } from "@/lib/pinboards";
import { ensureClientStorage, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import { ensureClientTimelineEvent } from "@/lib/timeline";
import type {
  ClientDocument,
  CriterionDraft,
  ExhibitAssignment,
  ExhibitNumberingScheme,
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

function criterionMeta(code: string) {
  return (
    EB1A_CRITERIA_DEFINITIONS.find((criterion) => criterion.code === code) ?? {
      code,
      legalCode: code,
      name: code,
    }
  );
}

function buildDefaultNumberingScheme(strategyMemo: StrategyMemo): ExhibitNumberingScheme {
  return {
    kind: "letter-grouped",
    letterMap: buildDefaultLetterMap([
      ...strategyMemo.recommendedMix.primary.map((entry) => entry.criterionCode),
      ...strategyMemo.recommendedMix.supporting.map((entry) => entry.criterionCode),
    ]),
  };
}

function buildCriterionAssignments(
  recommendations: Array<StrategyMemo["recommendedMix"]["primary"][number]>,
  documents: ClientDocument[],
  scheme: ExhibitNumberingScheme,
  criterionOffset: number,
  role: LockedCriterionEntry["role"],
) {
  const documentLookup = new Map(documents.map((document) => [document.id, document]));

  const entries: LockedCriterionEntry[] = recommendations.map((recommendation, criterionIndex) => {
    const meta = criterionMeta(recommendation.criterionCode);
    const anchorDocIds = [...new Set(recommendation.anchorDocIds)].filter((docId) =>
      documentLookup.has(docId),
    );
    const criterionPosition = criterionOffset + criterionIndex;

    const anchorExhibits: ExhibitAssignment[] = anchorDocIds.map((documentId, index) => {
      const document = documentLookup.get(documentId)!;
      const position =
        scheme.kind === "flat"
          ? recommendations
              .slice(0, criterionIndex)
              .reduce((sum, entry) => sum + entry.anchorDocIds.length, criterionOffset) + index
          : criterionPosition;

      const exhibitNumber = renderExhibitNumber(
        scheme,
        {
          criterionCode: recommendation.criterionCode,
          order: index,
        },
        position,
      );
      const exhibitLabel = renderExhibitLabel(
        scheme,
        {
          criterionCode: recommendation.criterionCode,
          order: index,
        },
        position,
      );

      return {
        documentId,
        workspaceId: document.jobId,
        exhibitNumber,
        exhibitLabel,
        criterionCode: recommendation.criterionCode,
        anchoredToSubsectionId: undefined,
        bindingClaim: meta.name,
        order: index,
      };
    });

    return {
      criterionCode: recommendation.criterionCode,
      legalCode: meta.legalCode,
      criterionName: meta.name,
      role,
      rationale: recommendation.rationale,
      anchorDocIds,
      anchorExhibits,
    };
  });

  return {
    entries,
    nextOffset:
      criterionOffset +
      (scheme.kind === "flat"
        ? recommendations.reduce((sum, entry) => sum + entry.anchorDocIds.length, 0)
        : recommendations.length),
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

function ensureStructuredDraftSkeletons(clientId: string, lockedStrategy: LockedCaseStrategy) {
  [...lockedStrategy.primary, ...lockedStrategy.supporting].forEach((entry) => {
    const sectionUnits = entry.anchorExhibits.length
      ? entry.anchorExhibits.map(
          (assignment, index) => `${entry.criterionName} unit ${index + 1} · ${assignment.exhibitLabel}`,
        )
      : [`${getCriterionDisplayName(entry.criterionCode)} unit 1`];

    ensureCriterionDraft(clientId, entry.criterionCode, {
      kind: "standard",
      sectionUnits,
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
  exhibitNumberingScheme?: ExhibitNumberingScheme;
}) {
  const now = new Date().toISOString();
  const existing = getLockedStrategy(input.clientId);
  const exhibitNumberingScheme =
    input.exhibitNumberingScheme ?? buildDefaultNumberingScheme(input.strategyMemo);

  const primaryAssignments = buildCriterionAssignments(
    input.strategyMemo.recommendedMix.primary,
    input.clientDocuments,
    exhibitNumberingScheme,
    0,
    "primary",
  );
  const supportingAssignments = buildCriterionAssignments(
    input.strategyMemo.recommendedMix.supporting,
    input.clientDocuments,
    exhibitNumberingScheme,
    primaryAssignments.nextOffset,
    "supporting",
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
    exhibitNumberingScheme,
    totalExhibits:
      primaryAssignments.entries.reduce((sum, entry) => sum + entry.anchorExhibits.length, 0) +
      supportingAssignments.entries.reduce((sum, entry) => sum + entry.anchorExhibits.length, 0),
  };

  saveLockedStrategy(lockedStrategy);
  createPinboards(input.clientId, lockedStrategy);
  ensureStructuredDraftSkeletons(input.clientId, lockedStrategy);
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
      numberingScheme: lockedStrategy.exhibitNumberingScheme.kind,
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

  const historyPath = path.join(
    getLockHistoryDirectory(clientId),
    `${locked.updatedAt.replace(/[:.]/g, "-")}.json`,
  );
  writeAbsoluteStateFile(historyPath, locked);

  const affectedCodes = [...locked.primary, ...locked.supporting].map((entry) => entry.criterionCode);
  const affectedDrafts = affectedCodes
    .map((criterionCode) => markCriterionDraftOutOfDate(clientId, criterionCode))
    .filter(Boolean) as CriterionDraft[];

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

export { getCriterionDraft, listCriterionDrafts };
