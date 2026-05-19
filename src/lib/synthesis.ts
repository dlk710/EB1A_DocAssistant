import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureClientStorage, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import type {
  BriefDraft,
  ClientDocument,
  SynthesisCitation,
  SynthesisDraft,
  SynthesisParagraph,
  SynthesisSectionKind,
  SynthesisVersion,
} from "@/lib/types";

function getSynthesisDirectory(clientId: string) {
  return path.join(ensureClientStorage(clientId), "synthesis");
}

function getSynthesisIndexPath(clientId: string) {
  return path.join(getSynthesisDirectory(clientId), "__index__.json");
}

function getSynthesisPath(clientId: string, kind: SynthesisSectionKind) {
  return path.join(getSynthesisDirectory(clientId), `${kind}.json`);
}

function ensureSynthesisIndex(clientId: string) {
  const synthesisDirectory = getSynthesisDirectory(clientId);
  fs.mkdirSync(synthesisDirectory, { recursive: true });
  const index = readAbsoluteStateFile<SynthesisSectionKind[]>(getSynthesisIndexPath(clientId), []);
  return Array.isArray(index) ? index : [];
}

function saveSynthesisIndex(clientId: string, kinds: SynthesisSectionKind[]) {
  writeAbsoluteStateFile(getSynthesisIndexPath(clientId), [...new Set(kinds)].sort());
}

function wordCountFromParagraphs(paragraphs: Array<{ text: string }>) {
  return paragraphs.reduce(
    (sum, paragraph) => sum + paragraph.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
}

function normalizeSynthesisVersion(version: SynthesisVersion, index: number): SynthesisVersion {
  const paragraphs = Array.isArray(version.paragraphs)
    ? version.paragraphs.map((paragraph) => ({
        id: paragraph.id || crypto.randomUUID(),
        text: paragraph.text || "",
        exhibitRefs: Array.isArray(paragraph.exhibitRefs) ? paragraph.exhibitRefs : [],
        criterionRefs: Array.isArray(paragraph.criterionRefs) ? paragraph.criterionRefs : [],
        citations: Array.isArray(paragraph.citations) ? paragraph.citations : [],
        factCheckStatus: paragraph.factCheckStatus || "pending",
        factCheckNotes: paragraph.factCheckNotes,
      }))
    : [];

  const referencedCriteria = Array.isArray(version.referencedCriteria)
    ? [...new Set(version.referencedCriteria)]
    : [...new Set(paragraphs.flatMap((paragraph) => paragraph.criterionRefs))];

  return {
    version: version.version || index + 1,
    createdAt: version.createdAt || new Date().toISOString(),
    source: version.source || "manual",
    authorNotes: version.authorNotes || "",
    paragraphs,
    wordCount: version.wordCount || wordCountFromParagraphs(paragraphs),
    costUsd: Number.isFinite(version.costUsd) ? version.costUsd : 0,
    referencedCriteria,
    genericProseWarning: version.genericProseWarning ?? null,
    styleProfileId: version.styleProfileId ?? null,
    styleExemplarIds: Array.isArray(version.styleExemplarIds) ? version.styleExemplarIds : [],
  };
}

export function normalizeSynthesisDraft(
  raw: SynthesisDraft | null,
  clientId: string,
  kind: SynthesisSectionKind,
): SynthesisDraft | null {
  if (!raw) {
    return null;
  }

  const versions = (raw.versions || []).map((version, index) =>
    normalizeSynthesisVersion(version, index),
  );

  return {
    id: raw.id || `${clientId}:${kind}`,
    clientId,
    kind,
    status:
      raw.status === "approved"
        ? "approved"
        : raw.status === "out-of-date"
          ? "out-of-date"
          : "in-progress",
    versions,
    latestApprovedVersion:
      typeof raw.latestApprovedVersion === "number"
        ? raw.latestApprovedVersion
        : raw.status === "approved"
          ? versions.at(-1)?.version ?? null
          : null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

export function getSynthesisDraft(clientId: string, kind: SynthesisSectionKind) {
  return normalizeSynthesisDraft(
    readAbsoluteStateFile<SynthesisDraft | null>(getSynthesisPath(clientId, kind), null),
    clientId,
    kind,
  );
}

export function listSynthesisDrafts(clientId: string) {
  const kinds = ensureSynthesisIndex(clientId);
  return kinds
    .map((kind) => getSynthesisDraft(clientId, kind))
    .filter((draft): draft is SynthesisDraft => Boolean(draft));
}

export function saveSynthesisDraft(draft: SynthesisDraft) {
  const normalized = normalizeSynthesisDraft(draft, draft.clientId, draft.kind);
  if (!normalized) {
    return null;
  }
  const existing = ensureSynthesisIndex(draft.clientId);
  saveSynthesisIndex(draft.clientId, [...existing, draft.kind]);
  writeAbsoluteStateFile(getSynthesisPath(draft.clientId, draft.kind), normalized);
  return normalized;
}

export function ensureSynthesisDraft(clientId: string, kind: SynthesisSectionKind) {
  const existing = getSynthesisDraft(clientId, kind);
  if (existing) {
    return existing;
  }
  const now = new Date().toISOString();
  return saveSynthesisDraft({
    id: `${clientId}:${kind}`,
    clientId,
    kind,
    status: "in-progress",
    versions: [],
    latestApprovedVersion: null,
    createdAt: now,
    updatedAt: now,
  });
}

export function findSynthesisVersion(draft: SynthesisDraft, versionNumber?: number | null) {
  if (!draft.versions.length) {
    return null;
  }
  if (typeof versionNumber === "number") {
    return draft.versions.find((version) => version.version === versionNumber) ?? null;
  }
  return draft.versions.at(-1) ?? null;
}

export function appendSynthesisVersion(
  clientId: string,
  kind: SynthesisSectionKind,
  version: Omit<SynthesisVersion, "version" | "createdAt" | "wordCount" | "referencedCriteria"> & {
    createdAt?: string;
    wordCount?: number;
    referencedCriteria?: string[];
  },
) {
  const draft = ensureSynthesisDraft(clientId, kind);
  if (!draft) {
    return null;
  }
  const nextVersion = normalizeSynthesisVersion(
    {
      ...version,
      version: (draft.versions.at(-1)?.version ?? 0) + 1,
      createdAt: version.createdAt || new Date().toISOString(),
      wordCount: version.wordCount || wordCountFromParagraphs(version.paragraphs),
      referencedCriteria:
        version.referencedCriteria ||
        [...new Set(version.paragraphs.flatMap((paragraph) => paragraph.criterionRefs))],
    } as SynthesisVersion,
    draft.versions.length,
  );
  return saveSynthesisDraft({
    ...draft,
    updatedAt: new Date().toISOString(),
    status: "in-progress",
    latestApprovedVersion: draft.latestApprovedVersion,
    versions: [...draft.versions, nextVersion],
  });
}

export function saveSynthesisVersion(input: {
  clientId: string;
  kind: SynthesisSectionKind;
  versionNumber?: number | null;
  paragraphs: SynthesisParagraph[];
  authorNotes?: string;
  source?: SynthesisVersion["source"];
  createNewVersion?: boolean;
  costUsd?: number;
  genericProseWarning?: string | null;
  styleProfileId?: string | null;
  styleExemplarIds?: string[];
}) {
  const draft = ensureSynthesisDraft(input.clientId, input.kind);
  if (!draft) {
    return null;
  }

  const targetVersion = findSynthesisVersion(draft, input.versionNumber);
  const shouldFork =
    input.createNewVersion ||
    !targetVersion ||
    (draft.latestApprovedVersion !== null && targetVersion.version === draft.latestApprovedVersion);

  if (shouldFork) {
    return appendSynthesisVersion(input.clientId, input.kind, {
      source: input.source || (targetVersion ? "manual" : "manual"),
      authorNotes: input.authorNotes || targetVersion?.authorNotes || "",
      paragraphs: input.paragraphs,
      costUsd: input.costUsd ?? 0,
      genericProseWarning: input.genericProseWarning ?? null,
      styleProfileId: input.styleProfileId ?? null,
      styleExemplarIds: input.styleExemplarIds ?? [],
    });
  }

  const nextVersions = draft.versions.map((version) =>
    version.version === targetVersion.version
      ? normalizeSynthesisVersion(
          {
            ...version,
            source: input.source || version.source,
            authorNotes: input.authorNotes ?? version.authorNotes,
            paragraphs: input.paragraphs,
            wordCount: wordCountFromParagraphs(input.paragraphs),
            costUsd: input.costUsd ?? version.costUsd,
            genericProseWarning:
              input.genericProseWarning !== undefined
                ? input.genericProseWarning
                : version.genericProseWarning,
            styleProfileId: input.styleProfileId ?? version.styleProfileId,
            styleExemplarIds: input.styleExemplarIds ?? version.styleExemplarIds,
            referencedCriteria: [...new Set(input.paragraphs.flatMap((paragraph) => paragraph.criterionRefs))],
          },
          version.version - 1,
        )
      : version,
  );

  return saveSynthesisDraft({
    ...draft,
    updatedAt: new Date().toISOString(),
    status: "in-progress",
    versions: nextVersions,
  });
}

export function approveSynthesisVersion(
  clientId: string,
  kind: SynthesisSectionKind,
  versionNumber: number,
) {
  const draft = ensureSynthesisDraft(clientId, kind);
  if (!draft) {
    return null;
  }
  return saveSynthesisDraft({
    ...draft,
    updatedAt: new Date().toISOString(),
    status: "approved",
    latestApprovedVersion: versionNumber,
  });
}

export function flagSynthesisDraftsOutOfDate(clientId: string) {
  return listSynthesisDrafts(clientId).map((draft) =>
    saveSynthesisDraft({
      ...draft,
      updatedAt: new Date().toISOString(),
      status: "out-of-date",
    })!,
  );
}

export function synthesisVersionFromBriefDraft(
  briefDraft: BriefDraft,
  documentLookup: Map<string, ClientDocument>,
  input: {
    source: SynthesisVersion["source"];
    authorNotes?: string;
    costUsd?: number;
  },
) {
  const paragraphs: SynthesisParagraph[] = briefDraft.paragraphs.map((paragraph) => ({
    id: paragraph.id || crypto.randomUUID(),
    text: paragraph.text,
    exhibitRefs: paragraph.exhibitRefs,
    criterionRefs: [],
    citations: paragraph.citations.map((citation) => {
      const document = documentLookup.get(citation.docId);
      const normalized: SynthesisCitation = {
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
    referencedCriteria: [],
    genericProseWarning: briefDraft.genericProseWarning ?? null,
    styleProfileId: briefDraft.styleProfileId ?? null,
    styleExemplarIds: briefDraft.styleExemplarIds ?? [],
  };
}
