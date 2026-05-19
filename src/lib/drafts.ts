import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureClientStorage, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import type {
  BriefDraft,
  ClientDocument,
  CriterionDraft,
  DraftCitation,
  DraftParagraph,
  DraftVersion,
  LegacyCriterionDraftVersion,
} from "@/lib/types";

interface StoredCriterionDraft
  extends Omit<CriterionDraft, "versions"> {
  versions?: Array<DraftVersion | LegacyCriterionDraftVersion>;
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

export function normalizeCriterionDraft(
  raw: StoredCriterionDraft | null,
  clientId: string,
  criterionCode: string,
): CriterionDraft | null {
  if (!raw) {
    return null;
  }

  const versions = (raw.versions || []).map((version, index) =>
    "content" in version
      ? legacyVersionToDraftVersion(version as LegacyCriterionDraftVersion, index)
      : normalizeDraftVersion(version as DraftVersion, index),
  );
  const derivedStatus =
    raw.outOfDate || raw.status === "out-of-date"
      ? "out-of-date"
      : raw.status === "approved"
        ? "approved"
        : "in-progress";

  return {
    id: raw.id || `${clientId}:${criterionCode}`,
    clientId,
    criterionCode,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    status: derivedStatus,
    latestApprovedVersion:
      typeof raw.latestApprovedVersion === "number"
        ? raw.latestApprovedVersion
        : derivedStatus === "approved"
          ? versions.at(-1)?.version ?? null
          : null,
    outOfDate: derivedStatus === "out-of-date",
    versions,
  };
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
  const normalized = normalizeCriterionDraft(draft, draft.clientId, draft.criterionCode);
  if (!normalized) {
    return null;
  }
  const existing = ensureDraftIndex(draft.clientId);
  saveDraftIndex(draft.clientId, [...existing, draft.criterionCode]);
  writeAbsoluteStateFile(getDraftPath(draft.clientId, draft.criterionCode), {
    ...normalized,
    outOfDate: normalized.status === "out-of-date",
  });
  return normalized;
}

export function ensureCriterionDraft(clientId: string, criterionCode: string) {
  const existing = getCriterionDraft(clientId, criterionCode);
  if (existing) {
    return existing;
  }
  const now = new Date().toISOString();
  return saveCriterionDraft({
    id: `${clientId}:${criterionCode}`,
    clientId,
    criterionCode,
    createdAt: now,
    updatedAt: now,
    status: "in-progress",
    latestApprovedVersion: null,
    outOfDate: false,
    versions: [],
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
  const nextVersion = normalizeDraftVersion(
    {
      ...version,
      version: (draft.versions.at(-1)?.version ?? 0) + 1,
      createdAt: version.createdAt || new Date().toISOString(),
      wordCount: version.wordCount || wordCountFromParagraphs(version.paragraphs),
    } as DraftVersion,
    draft.versions.length,
  );
  return saveCriterionDraft({
    ...draft,
    updatedAt: new Date().toISOString(),
    status: "in-progress",
    latestApprovedVersion:
      draft.latestApprovedVersion && draft.latestApprovedVersion <= (draft.versions.at(-1)?.version ?? 0)
        ? draft.latestApprovedVersion
        : draft.latestApprovedVersion,
    outOfDate: false,
    versions: [...draft.versions, nextVersion],
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

  const targetVersion = findDraftVersion(draft, input.versionNumber);
  const shouldFork =
    input.createNewVersion ||
    !targetVersion ||
    (draft.latestApprovedVersion !== null && targetVersion.version === draft.latestApprovedVersion);

  if (shouldFork) {
    return appendDraftVersion(input.clientId, input.criterionCode, {
      source: input.source || (targetVersion ? "manual" : "manual"),
      authorNotes: input.authorNotes || targetVersion?.authorNotes || "",
      paragraphs: input.paragraphs,
      costUsd: input.costUsd ?? 0,
    });
  }

  const nextVersions = draft.versions.map((version) =>
    version.version === targetVersion.version
      ? normalizeDraftVersion(
          {
            ...version,
            source: input.source || version.source,
            authorNotes: input.authorNotes ?? version.authorNotes,
            paragraphs: input.paragraphs,
            wordCount: wordCountFromParagraphs(input.paragraphs),
            costUsd: input.costUsd ?? version.costUsd,
          },
          version.version - 1,
        )
      : version,
  );

  return saveCriterionDraft({
    ...draft,
    updatedAt: new Date().toISOString(),
    status: "in-progress",
    outOfDate: false,
    versions: nextVersions,
  });
}

export function approveDraftVersion(clientId: string, criterionCode: string, versionNumber: number) {
  const draft = ensureCriterionDraft(clientId, criterionCode);
  if (!draft) {
    return null;
  }
  return saveCriterionDraft({
    ...draft,
    updatedAt: new Date().toISOString(),
    status: "approved",
    outOfDate: false,
    latestApprovedVersion: versionNumber,
  });
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
