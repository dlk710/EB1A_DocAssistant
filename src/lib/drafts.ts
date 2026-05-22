import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getCriterionDisplayName } from "@/lib/constants";
import { ensureClientStorage, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import {
  buildAggregateCriterionVersion,
  createCriterionRoot,
  criterionStatusFromRoot,
  findSubsection,
  listSubsections,
  markTreeOutOfDate,
  normalizeSubsectionDraft,
  subsectionVersionFromContent,
  updateSubsection,
} from "@/lib/subsection-drafts";
import type {
  BriefDraft,
  ClientDocument,
  CriterionDraft,
  DraftCitation,
  DraftParagraph,
  DraftVersion,
  EndorsementQuote,
  LegacyCriterionDraftVersion,
  SubsectionDraft,
  SubsectionVersion,
} from "@/lib/types";

interface StoredCriterionDraft
  extends Omit<CriterionDraft, "versions" | "root"> {
  versions?: Array<DraftVersion | LegacyCriterionDraftVersion>;
  root?: SubsectionDraft | null;
}

function getDraftDirectory(clientId: string) {
  return path.join(ensureClientStorage(clientId), "drafts");
}

function getDraftIndexPath(clientId: string) {
  return path.join(getDraftDirectory(clientId), "__index__.json");
}

function getDraftPath(clientId: string, criterionCode: string) {
  return path.join(getDraftDirectory(clientId), `${criterionCode}.json`);
}

function ensureDraftIndex(clientId: string) {
  const draftDirectory = getDraftDirectory(clientId);
  fs.mkdirSync(draftDirectory, { recursive: true });
  const draftIndex = readAbsoluteStateFile<string[]>(getDraftIndexPath(clientId), []);
  return Array.isArray(draftIndex) ? draftIndex : [];
}

function saveDraftIndex(clientId: string, criterionCodes: string[]) {
  writeAbsoluteStateFile(getDraftIndexPath(clientId), [...new Set(criterionCodes)].sort());
}

function wordCountFromParagraphs(paragraphs: DraftParagraph[]) {
  return paragraphs.reduce(
    (sum, paragraph) => sum + paragraph.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
}

function normalizeDraftVersion(version: DraftVersion, index: number): DraftVersion {
  const paragraphs = Array.isArray(version.paragraphs)
    ? version.paragraphs.map((paragraph) => ({
        id: paragraph.id || crypto.randomUUID(),
        text: paragraph.text || "",
        exhibitRefs: Array.isArray(paragraph.exhibitRefs) ? paragraph.exhibitRefs : [],
        citations: Array.isArray(paragraph.citations) ? paragraph.citations : [],
        factCheckStatus: paragraph.factCheckStatus || "pending",
        factCheckNotes: paragraph.factCheckNotes,
      }))
    : [];

  return {
    version: version.version || index + 1,
    createdAt: version.createdAt || new Date().toISOString(),
    source: version.source || "manual",
    authorNotes: version.authorNotes || "",
    paragraphs,
    wordCount: version.wordCount || wordCountFromParagraphs(paragraphs),
    costUsd: Number.isFinite(version.costUsd) ? version.costUsd : 0,
  };
}

function legacyVersionToDraftVersion(
  version: LegacyCriterionDraftVersion,
  index: number,
): DraftVersion {
  return {
    version: index + 1,
    createdAt: version.createdAt,
    source: "manual",
    authorNotes: version.title || "",
    paragraphs: [
      {
        id: version.id || crypto.randomUUID(),
        text: version.content || "",
        exhibitRefs: [],
        citations: [],
        factCheckStatus: "pending",
      },
    ],
    wordCount: version.content ? version.content.trim().split(/\s+/).filter(Boolean).length : 0,
    costUsd: 0,
  };
}

function buildMigratedRoot(
  criterionCode: string,
  versions: DraftVersion[],
  status: CriterionDraft["status"],
  latestApprovedVersion: number | null,
) {
  const root = createCriterionRoot({
    criterionCode,
    kind: "standard",
    sectionUnits: [`${getCriterionDisplayName(criterionCode, criterionCode)} introduction`],
  });
  const rootVersions: SubsectionVersion[] = versions.map((version) => ({
    version: version.version,
    createdAt: version.createdAt,
    source: version.source,
    paragraphs: version.paragraphs,
    endorsementQuotes: [],
    wordCount: version.wordCount,
    costUsd: version.costUsd,
  }));

  return normalizeSubsectionDraft({
    ...root,
    paragraphs: versions.at(-1)?.paragraphs ?? [],
    versions: rootVersions,
    status,
    latestApprovedVersion,
  });
}

function normalizeStoredVersions(raw?: Array<DraftVersion | LegacyCriterionDraftVersion>) {
  return (raw || []).map((version, index) =>
    "content" in version
      ? legacyVersionToDraftVersion(version as LegacyCriterionDraftVersion, index)
      : normalizeDraftVersion(version as DraftVersion, index),
  );
}

function finalizeCriterionDraft(draft: CriterionDraft) {
  const root = normalizeSubsectionDraft(draft.root);
  const status = criterionStatusFromRoot(root);
  const versions = (draft.versions || []).map((version, index) =>
    normalizeDraftVersion(version, index),
  );
  const latestApprovedVersion =
    typeof draft.latestApprovedVersion === "number"
      ? draft.latestApprovedVersion
      : status === "approved"
        ? versions.at(-1)?.version ?? null
        : null;

  return {
    id: draft.id || `${draft.clientId}:${draft.criterionCode}`,
    clientId: draft.clientId,
    criterionCode: draft.criterionCode,
    kind: draft.kind || "standard",
    standardCriterionInvoked: draft.standardCriterionInvoked,
    comparableEvidenceRationale: draft.comparableEvidenceRationale,
    createdAt: draft.createdAt || new Date().toISOString(),
    updatedAt: draft.updatedAt || draft.createdAt || new Date().toISOString(),
    status,
    root,
    versions,
    latestApprovedVersion,
    outOfDate: status === "out-of-date",
  } satisfies CriterionDraft;
}

export function normalizeCriterionDraft(
  raw: StoredCriterionDraft | null,
  clientId: string,
  criterionCode: string,
): CriterionDraft | null {
  if (!raw) {
    return null;
  }

  const versions = normalizeStoredVersions(raw.versions);
  const derivedStatus =
    raw.outOfDate || raw.status === "out-of-date"
      ? "out-of-date"
      : raw.status === "approved"
        ? "approved"
        : "in-progress";
  const latestApprovedVersion =
    typeof raw.latestApprovedVersion === "number"
      ? raw.latestApprovedVersion
      : derivedStatus === "approved"
        ? versions.at(-1)?.version ?? null
        : null;
  const root = raw.root
    ? normalizeSubsectionDraft(raw.root)
    : buildMigratedRoot(criterionCode, versions, derivedStatus, latestApprovedVersion);

  return finalizeCriterionDraft({
    id: raw.id || `${clientId}:${criterionCode}`,
    clientId,
    criterionCode,
    kind: raw.kind || "standard",
    standardCriterionInvoked: raw.standardCriterionInvoked,
    comparableEvidenceRationale: raw.comparableEvidenceRationale,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    status: derivedStatus,
    root,
    versions:
      versions.length ||
      root.versions.length
        ? versions
        : [
            buildAggregateCriterionVersion({
              draft: {
                id: raw.id || `${clientId}:${criterionCode}`,
                clientId,
                criterionCode,
                kind: raw.kind || "standard",
                createdAt: raw.createdAt || new Date().toISOString(),
                updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
                status: derivedStatus,
                root,
                versions: [],
                latestApprovedVersion,
                standardCriterionInvoked: raw.standardCriterionInvoked,
                comparableEvidenceRationale: raw.comparableEvidenceRationale,
              },
              source: "manual",
            }),
          ],
    latestApprovedVersion,
    outOfDate: derivedStatus === "out-of-date",
  });
}

export function getCriterionDraft(clientId: string, criterionCode: string) {
  return normalizeCriterionDraft(
    readAbsoluteStateFile<StoredCriterionDraft | null>(getDraftPath(clientId, criterionCode), null),
    clientId,
    criterionCode,
  );
}

export function listCriterionDrafts(clientId: string, criterionCodes?: string[]) {
  const index = criterionCodes?.length ? criterionCodes : ensureDraftIndex(clientId);
  return index
    .map((criterionCode) => getCriterionDraft(clientId, criterionCode))
    .filter((draft): draft is CriterionDraft => Boolean(draft));
}

export function saveCriterionDraft(draft: CriterionDraft) {
  const normalized = finalizeCriterionDraft(draft);
  const existing = ensureDraftIndex(draft.clientId);
  saveDraftIndex(draft.clientId, [...existing, draft.criterionCode]);
  writeAbsoluteStateFile(getDraftPath(draft.clientId, draft.criterionCode), normalized);
  return normalized;
}

export function ensureCriterionDraft(
  clientId: string,
  criterionCode: string,
  seed?: {
    kind?: CriterionDraft["kind"];
    sectionUnits?: string[];
    standardCriterionInvoked?: string;
    comparableEvidenceRationale?: string;
  },
) {
  const existing = getCriterionDraft(clientId, criterionCode);
  if (existing) {
    return existing;
  }
  const now = new Date().toISOString();
  const kind = seed?.kind || "standard";
  return saveCriterionDraft({
    id: `${clientId}:${criterionCode}`,
    clientId,
    criterionCode,
    kind,
    standardCriterionInvoked: seed?.standardCriterionInvoked,
    comparableEvidenceRationale: seed?.comparableEvidenceRationale,
    createdAt: now,
    updatedAt: now,
    status: "in-progress",
    root: createCriterionRoot({
      criterionCode,
      kind,
      sectionUnits:
        seed?.sectionUnits?.length
          ? seed.sectionUnits
          : [`${getCriterionDisplayName(criterionCode, criterionCode)} unit`],
    }),
    versions: [],
    latestApprovedVersion: null,
    outOfDate: false,
  });
}

export function findDraftVersion(draft: CriterionDraft, versionNumber?: number | null) {
  if (!draft.versions.length) {
    return null;
  }
  if (typeof versionNumber === "number") {
    return draft.versions.find((version) => version.version === versionNumber) ?? null;
  }
  return draft.versions.at(-1) ?? null;
}

export function findSubsectionVersion(subsection: SubsectionDraft, versionNumber?: number | null) {
  if (!subsection.versions.length) {
    return null;
  }
  if (typeof versionNumber === "number") {
    return subsection.versions.find((version) => version.version === versionNumber) ?? null;
  }
  return subsection.versions.at(-1) ?? null;
}

function nextAggregateVersions(
  draft: CriterionDraft,
  source: DraftVersion["source"],
  authorNotes: string,
  costUsd: number,
  createNewVersion = false,
) {
  const latestVersion = draft.versions.at(-1) ?? null;
  const shouldAppend =
    createNewVersion ||
    !latestVersion ||
    (draft.latestApprovedVersion !== null &&
      latestVersion.version === draft.latestApprovedVersion);
  const snapshot = buildAggregateCriterionVersion({
    draft,
    source,
    authorNotes,
    costUsd,
    versionNumber: shouldAppend ? undefined : latestVersion.version,
  });

  if (shouldAppend) {
    return [...draft.versions, snapshot];
  }

  return draft.versions.map((version) =>
    version.version === latestVersion.version
      ? {
          ...snapshot,
          version: latestVersion.version,
          createdAt: latestVersion.createdAt,
        }
      : version,
  );
}

export function saveSubsectionVersion(input: {
  clientId: string;
  criterionCode: string;
  subsectionId: string;
  versionNumber?: number | null;
  paragraphs: DraftParagraph[];
  endorsementQuotes?: EndorsementQuote[];
  source?: SubsectionVersion["source"];
  createNewVersion?: boolean;
  authorNotes?: string;
  costUsd?: number;
}) {
  const draft = ensureCriterionDraft(input.clientId, input.criterionCode);
  if (!draft) {
    return null;
  }

  const subsection = findSubsection(draft.root, input.subsectionId);
  if (!subsection) {
    return null;
  }
  const targetVersion = findSubsectionVersion(subsection, input.versionNumber);
  const shouldFork =
    input.createNewVersion ||
    !targetVersion ||
    (subsection.latestApprovedVersion !== null &&
      targetVersion.version === subsection.latestApprovedVersion);

  const nextRoot = updateSubsection(draft.root, input.subsectionId, (node) => {
    if (shouldFork) {
      const nextVersion = subsectionVersionFromContent({
        existingCount: node.versions.length,
        source: input.source || "manual",
        paragraphs: input.paragraphs,
        endorsementQuotes: input.endorsementQuotes,
        costUsd: input.costUsd,
      });

      return {
        ...node,
        paragraphs: nextVersion.paragraphs,
        endorsementQuotes: nextVersion.endorsementQuotes,
        versions: [...node.versions, nextVersion],
        status: "in-progress",
        gapNotes:
          nextVersion.endorsementQuotes.length || node.level < 2
            ? []
            : ["No endorsement quote is currently attached to this sub-claim."],
      };
    }

    const nextVersions = node.versions.map((version) =>
      version.version === targetVersion?.version
        ? {
            ...version,
            source: input.source || version.source,
            paragraphs: input.paragraphs.map((paragraph) => ({
              ...paragraph,
              id: paragraph.id || crypto.randomUUID(),
              factCheckStatus: paragraph.factCheckStatus || "pending",
            })),
            endorsementQuotes: (input.endorsementQuotes ?? []).map((quote) => ({
              ...quote,
              id: quote.id || crypto.randomUUID(),
              anchoredToSubsectionId: input.subsectionId,
              isIndependent:
                typeof quote.isIndependent === "boolean" ? quote.isIndependent : null,
            })),
            wordCount: wordCountFromParagraphs(input.paragraphs),
            costUsd: input.costUsd ?? version.costUsd,
          }
        : version,
    );
    const latest = nextVersions.find((version) => version.version === targetVersion?.version);

    return {
      ...node,
      paragraphs: latest?.paragraphs ?? node.paragraphs,
      endorsementQuotes: latest?.endorsementQuotes ?? node.endorsementQuotes,
      versions: nextVersions,
      status: "in-progress",
      gapNotes:
        (latest?.endorsementQuotes.length ?? 0) || node.level < 2
          ? []
          : ["No endorsement quote is currently attached to this sub-claim."],
    };
  });

  const nextDraft = finalizeCriterionDraft({
    ...draft,
    root: nextRoot,
    updatedAt: new Date().toISOString(),
    versions: nextAggregateVersions(
      { ...draft, root: nextRoot },
      input.source === "ai" ? "ai" : input.source || "manual",
      input.authorNotes || "",
      input.costUsd ?? 0,
      Boolean(input.createNewVersion),
    ),
  });

  return saveCriterionDraft(nextDraft);
}

export function approveSubsectionVersion(
  clientId: string,
  criterionCode: string,
  subsectionId: string,
  versionNumber: number,
) {
  const draft = ensureCriterionDraft(clientId, criterionCode);
  if (!draft) {
    return null;
  }

  const nextRoot = updateSubsection(draft.root, subsectionId, (node) => ({
    ...node,
    status: "approved",
    latestApprovedVersion: versionNumber,
    gapNotes: node.gapNotes ?? [],
  }));

  const nextDraft = finalizeCriterionDraft({
    ...draft,
    root: nextRoot,
    updatedAt: new Date().toISOString(),
    versions: nextAggregateVersions(
      { ...draft, root: nextRoot },
      "manual",
      `Approved subsection ${subsectionId}`,
      0,
      true,
    ),
  });

  const fullyApproved = nextDraft.status === "approved";
  return saveCriterionDraft({
    ...nextDraft,
    latestApprovedVersion: fullyApproved ? nextDraft.versions.at(-1)?.version ?? null : draft.latestApprovedVersion,
  });
}

export function updateCriterionDraftMeta(input: {
  clientId: string;
  criterionCode: string;
  kind: CriterionDraft["kind"];
  standardCriterionInvoked?: string;
  comparableEvidenceRationale?: string;
}) {
  const draft = ensureCriterionDraft(input.clientId, input.criterionCode, {
    kind: input.kind,
  });
  if (!draft) {
    return null;
  }

  const root =
    draft.kind === input.kind
      ? draft.root
      : createCriterionRoot({
          criterionCode: input.criterionCode,
          kind: input.kind,
          sectionUnits:
            draft.root.children.map((child) => child.title) || [
              `${getCriterionDisplayName(input.criterionCode, input.criterionCode)} unit`,
            ],
        });

  return saveCriterionDraft({
    ...draft,
    kind: input.kind,
    standardCriterionInvoked: input.standardCriterionInvoked,
    comparableEvidenceRationale: input.comparableEvidenceRationale,
    root,
    updatedAt: new Date().toISOString(),
    versions: nextAggregateVersions(
      { ...draft, root, kind: input.kind },
      "manual",
      "Updated criterion draft mode",
      0,
      true,
    ),
  });
}

export function markCriterionDraftOutOfDate(clientId: string, criterionCode: string) {
  const draft = getCriterionDraft(clientId, criterionCode);
  if (!draft) {
    return null;
  }

  return saveCriterionDraft({
    ...draft,
    status: "out-of-date",
    outOfDate: true,
    updatedAt: new Date().toISOString(),
    root: markTreeOutOfDate(draft.root),
  });
}

export function appendDraftVersion(
  clientId: string,
  criterionCode: string,
  version: Omit<DraftVersion, "version" | "createdAt" | "wordCount"> & {
    createdAt?: string;
    wordCount?: number;
  },
) {
  const draft = ensureCriterionDraft(clientId, criterionCode);
  if (!draft) {
    return null;
  }

  return saveSubsectionVersion({
    clientId,
    criterionCode,
    subsectionId: draft.root.id,
    paragraphs: version.paragraphs,
    source: version.source,
    createNewVersion: true,
    authorNotes: version.authorNotes,
    costUsd: version.costUsd,
  });
}

export function saveDraftVersion(input: {
  clientId: string;
  criterionCode: string;
  versionNumber?: number | null;
  paragraphs: DraftParagraph[];
  authorNotes?: string;
  source?: DraftVersion["source"];
  createNewVersion?: boolean;
  costUsd?: number;
}) {
  const draft = ensureCriterionDraft(input.clientId, input.criterionCode);
  if (!draft) {
    return null;
  }

  return saveSubsectionVersion({
    clientId: input.clientId,
    criterionCode: input.criterionCode,
    subsectionId: draft.root.id,
    versionNumber: input.versionNumber,
    paragraphs: input.paragraphs,
    source: input.source,
    createNewVersion: input.createNewVersion,
    authorNotes: input.authorNotes,
    costUsd: input.costUsd,
  });
}

export function approveDraftVersion(clientId: string, criterionCode: string, versionNumber: number) {
  const draft = ensureCriterionDraft(clientId, criterionCode);
  if (!draft) {
    return null;
  }

  return approveSubsectionVersion(clientId, criterionCode, draft.root.id, versionNumber);
}

export function draftVersionFromBriefDraft(
  briefDraft: BriefDraft,
  documentLookup: Map<string, ClientDocument>,
  input: {
    source: DraftVersion["source"];
    authorNotes?: string;
    costUsd?: number;
  },
) {
  const paragraphs: DraftParagraph[] = briefDraft.paragraphs.map((paragraph) => ({
    id: paragraph.id || crypto.randomUUID(),
    text: paragraph.text,
    exhibitRefs: paragraph.exhibitRefs,
    citations: paragraph.citations.map((citation) => {
      const document = documentLookup.get(citation.docId);
      const normalized: DraftCitation = {
        docId: citation.docId,
        workspaceId: document?.jobId || "",
        excerpt:
          document?.metadata?.preview ||
          document?.summary?.shortSummary ||
          document?.summary?.detailedSummary ||
          document?.fileName ||
          "",
        supports: citation.supports,
      };
      return normalized;
    }),
    factCheckStatus: paragraph.factCheckStatus || "pending",
    factCheckNotes: paragraph.factCheckNotes,
  }));

  return {
    source: input.source,
    authorNotes: input.authorNotes || "",
    paragraphs,
    wordCount: briefDraft.wordCount || wordCountFromParagraphs(paragraphs),
    costUsd: input.costUsd ?? 0,
  };
}

export function listDraftSubsections(clientId: string, criterionCode: string) {
  const draft = getCriterionDraft(clientId, criterionCode);
  return draft ? listSubsections(draft.root) : [];
}
