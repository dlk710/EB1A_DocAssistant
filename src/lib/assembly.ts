import crypto from "node:crypto";
import path from "node:path";
import { applyBatesRanges, totalPagesFromSections } from "@/lib/bates";
import { buildAuditFindings } from "@/lib/audit";
import { normalizeExhibitReferences, extractCriterionRefs } from "@/lib/cross-reference";
import { listClientJobs, getClient } from "@/lib/clients";
import { listCriterionDrafts } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";
import { getCriterionPinboard } from "@/lib/pinboards";
import { renderExhibitPdf } from "@/lib/pdf/embed-exhibits";
import { renderHtmlToPdf } from "@/lib/pdf/render-body";
import { getDocument, getDocumentsForJobs } from "@/lib/qdrant";
import { ensurePacketStorage, ensureClientStorage, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import { getSynthesisDraft } from "@/lib/synthesis";
import {
  buildCoverHtml,
  buildExhibitIndexHtml,
  buildTextSectionHtml,
  buildTocHtml,
} from "@/templates/petition-body.html";
import type {
  AssembledPetition,
  ExhibitIndexEntry,
  PetitionSection,
  StoredDocument,
  SynthesisDraft,
} from "@/lib/types";

interface RenderedPacketSection {
  section: PetitionSection;
  pdfBytes: Uint8Array;
}

export interface PacketBuildResult {
  petition: AssembledPetition;
  renderedSections: RenderedPacketSection[];
}

function packetStatePath(clientId: string) {
  return path.join(ensureClientStorage(clientId), "assembled-packet.json");
}

export function getSavedPacket(clientId: string) {
  return readAbsoluteStateFile<AssembledPetition | null>(packetStatePath(clientId), null);
}

export function savePacketState(packet: AssembledPetition) {
  writeAbsoluteStateFile(packetStatePath(packet.clientId), packet);
  return packet;
}

function parseExhibitNumber(label: string) {
  const match = label.match(/Ex\.\s*(\d+)([A-Z]?)/i);
  if (!match) {
    return { major: Number.MAX_SAFE_INTEGER, minor: "Z" };
  }
  return {
    major: Number(match[1]),
    minor: match[2] || "",
  };
}

function sortExhibitLabels(labels: string[]) {
  return [...labels].sort((left, right) => {
    const a = parseExhibitNumber(left);
    const b = parseExhibitNumber(right);
    if (a.major !== b.major) {
      return a.major - b.major;
    }
    return a.minor.localeCompare(b.minor);
  });
}

function approvedSynthesisText(draft: SynthesisDraft) {
  const version = draft.versions.find((candidate) => candidate.version === draft.latestApprovedVersion);
  return version?.paragraphs.map((paragraph) => paragraph.text).join("\n\n") ?? "";
}

async function renderTextSection(
  kind: PetitionSection["kind"],
  input: {
    title: string;
    subtitle?: string | null;
    paragraphs?: string[];
    entries?: Array<{ title: string; page: number; bates: string }>;
    exhibitEntries?: Array<{ exhibitNumber: string; title: string; pageRange: string; bates: string }>;
    sourceVersion?: number;
    criterionCode?: string;
  },
) {
  const html =
    kind === "cover"
      ? buildCoverHtml({
          candidateName: input.title,
          petitionType: input.subtitle || "EB-1A",
          attorneyName: null,
          firmName: null,
          filedDate: null,
        })
      : kind === "table-of-contents"
        ? buildTocHtml({ entries: input.entries ?? [] })
        : kind === "exhibit-index"
          ? buildExhibitIndexHtml({ entries: input.exhibitEntries ?? [] })
          : buildTextSectionHtml({
              title: input.title,
              subtitle: input.subtitle,
              paragraphs: input.paragraphs ?? [],
            });

  const rendered = await renderHtmlToPdf(html);

  if (kind === "cover") {
    return {
      section: {
        kind,
        content: {
          candidateName: input.title,
          petitionType: input.subtitle || "EB-1A",
          filedDate: null,
          attorneyName: null,
          firmName: null,
          preparedBy: "Setu",
        },
        bates: { start: "", end: "" },
        pageCount: rendered.pageCount,
      } satisfies PetitionSection,
      pdfBytes: rendered.pdfBytes,
    };
  }

  if (kind === "table-of-contents") {
    return {
      section: {
        kind,
        entries: (input.entries ?? []).map((entry) => ({
          sectionTitle: entry.title,
          startingBates: entry.bates,
          startingPage: entry.page,
        })),
        bates: { start: "", end: "" },
        pageCount: rendered.pageCount,
      } satisfies PetitionSection,
      pdfBytes: rendered.pdfBytes,
    };
  }

  if (kind === "statement-of-eligibility") {
    return {
      section: {
        kind,
        sourceSynthesisVersion: input.sourceVersion ?? 1,
        content: (input.paragraphs ?? []).join("\n\n"),
        bates: { start: "", end: "" },
        pageCount: rendered.pageCount,
      } satisfies PetitionSection,
      pdfBytes: rendered.pdfBytes,
    };
  }

  if (kind === "final-merits-determination") {
    return {
      section: {
        kind,
        sourceSynthesisVersion: input.sourceVersion ?? 1,
        content: (input.paragraphs ?? []).join("\n\n"),
        bates: { start: "", end: "" },
        pageCount: rendered.pageCount,
      } satisfies PetitionSection,
      pdfBytes: rendered.pdfBytes,
    };
  }

  if (kind === "criterion-argument") {
    return {
      section: {
        kind,
        criterionCode: input.criterionCode ?? "",
        sourceDraftVersion: input.sourceVersion ?? 1,
        content: (input.paragraphs ?? []).join("\n\n"),
        bates: { start: "", end: "" },
        pageCount: rendered.pageCount,
      } satisfies PetitionSection,
      pdfBytes: rendered.pdfBytes,
    };
  }

  return {
    section: {
      kind: "exhibit-index",
      entries: [],
      bates: { start: "", end: "" },
      pageCount: rendered.pageCount,
    } satisfies PetitionSection,
    pdfBytes: rendered.pdfBytes,
  };
}

function buildTocEntryTitle(section: PetitionSection) {
  switch (section.kind) {
    case "cover":
      return "Cover sheet";
    case "table-of-contents":
      return "Table of contents";
    case "statement-of-eligibility":
      return "Statement of Eligibility";
    case "final-merits-determination":
      return "Final Merits Determination";
    case "criterion-argument":
      return `Criterion ${section.criterionCode}`;
    case "exhibit-index":
      return "Exhibit index";
    case "exhibit":
      return section.exhibitNumber;
    default:
      return "Section";
  }
}

export async function buildPacketAssembly(clientId: string): Promise<PacketBuildResult> {
  const client = getClient(clientId);
  if (!client) {
    throw new Error("Client not found.");
  }
  const lockedStrategy = getLockedStrategy(clientId);
  if (!lockedStrategy) {
    throw new Error("The client must be locked before packet assembly can begin.");
  }

  const claimedCriteria = [...lockedStrategy.primary, ...lockedStrategy.supporting];
  const criterionDrafts = listCriterionDrafts(
    clientId,
    claimedCriteria.map((entry) => entry.criterionCode),
  );
  const draftLookup = new Map(criterionDrafts.map((draft) => [draft.criterionCode, draft]));

  if (criterionDrafts.some((draft) => draft.latestApprovedVersion === null)) {
    throw new Error("Every claimed criterion needs an approved draft before packet assembly can begin.");
  }

  const statementDraft = getSynthesisDraft(clientId, "statement-of-eligibility");
  const fmdDraft = getSynthesisDraft(clientId, "final-merits-determination");
  if (!statementDraft?.latestApprovedVersion || !fmdDraft?.latestApprovedVersion) {
    throw new Error("Both synthesis sections must be approved before packet assembly can begin.");
  }

  const jobIds = listClientJobs(clientId).map((job) => job.id);
  const allDocuments = await getDocumentsForJobs(jobIds);
  const documentLookup = new Map(allDocuments.map((document) => [document.id, document]));
  const exhibitAssignments = claimedCriteria.flatMap((entry) => entry.anchorExhibits);
  const canonicalExhibitLabels = sortExhibitLabels([...new Set(exhibitAssignments.map((assignment) => assignment.exhibitLabel))]);

  const criterionSectionsSource = claimedCriteria.map((entry) => {
    const draft = draftLookup.get(entry.criterionCode)!;
    const approvedVersion = draft.versions.find((version) => version.version === draft.latestApprovedVersion)!;
    const normalized = normalizeExhibitReferences(
      approvedVersion.paragraphs.map((paragraph) => paragraph.text).join("\n\n"),
      canonicalExhibitLabels,
    );
    return {
      entry,
      draft,
      approvedVersion,
      normalizedText: normalized.text,
    };
  });

  const normalizedSoe = normalizeExhibitReferences(
    approvedSynthesisText(statementDraft),
    canonicalExhibitLabels,
  );
  const normalizedFmd = normalizeExhibitReferences(
    approvedSynthesisText(fmdDraft),
    canonicalExhibitLabels,
  );

  const coverRendered = await renderTextSection("cover", {
    title: client.displayName,
    subtitle: client.petitionType,
  });
  const soeRendered = await renderTextSection("statement-of-eligibility", {
    title: "Statement of Eligibility",
    subtitle: "8 CFR §204.5(h)(3)",
    paragraphs: normalizedSoe.text.split(/\n{2,}/).filter(Boolean),
    sourceVersion: statementDraft.latestApprovedVersion ?? 1,
  });
  const criterionRendered = await Promise.all(
    criterionSectionsSource.map((source) =>
      renderTextSection("criterion-argument", {
        title: `${source.entry.legalCode} ${source.entry.criterionName}`,
        subtitle: source.entry.role === "primary" ? "Primary criterion" : "Supporting criterion",
        paragraphs: source.normalizedText.split(/\n{2,}/).filter(Boolean),
        sourceVersion: source.draft.latestApprovedVersion ?? 1,
        criterionCode: source.entry.criterionCode,
      }),
    ),
  );
  const fmdRendered = await renderTextSection("final-merits-determination", {
    title: "Final Merits Determination",
    subtitle: "Threshold and totality analysis",
    paragraphs: normalizedFmd.text.split(/\n{2,}/).filter(Boolean),
    sourceVersion: fmdDraft.latestApprovedVersion ?? 1,
  });

  const renderedExhibits: Array<RenderedPacketSection & { document: StoredDocument; exhibitNumber: string }> = [];
  const unsupportedExhibits: Array<{ exhibitLabel: string; reason: string }> = [];

  for (const exhibitLabel of canonicalExhibitLabels) {
    const assignment = exhibitAssignments.find((entry) => entry.exhibitLabel === exhibitLabel);
    if (!assignment) {
      continue;
    }
    const document = documentLookup.get(assignment.documentId) ?? (await getDocument(assignment.documentId));
    if (!document) {
      unsupportedExhibits.push({
        exhibitLabel,
        reason: "The source document is missing from the workspace store.",
      });
      continue;
    }
    try {
      const rendered = await renderExhibitPdf(document);
      renderedExhibits.push({
        document,
        exhibitNumber: exhibitLabel,
        section: {
          kind: "exhibit",
          exhibitNumber: exhibitLabel,
          sourceDocId: document.id,
          workspaceId: document.jobId,
          title: document.summary?.title || document.fileName,
          sourcePath: document.relativePath,
          sourceMimeType: document.mimeType,
          bates: { start: "", end: "" },
          pageCount: rendered.pageCount,
        },
        pdfBytes: rendered.pdfBytes,
      });
    } catch (error) {
      unsupportedExhibits.push({
        exhibitLabel,
        reason: error instanceof Error ? error.message : "Unsupported exhibit type.",
      });
    }
  }

  let tocPageCountGuess = 1;
  let tocRendered: RenderedPacketSection | null = null;
  let finalBodySections: PetitionSection[] = [];
  let tocEntries: Array<{ title: string; page: number; bates: string }> = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const provisionalSections = [
      coverRendered.section,
      { kind: "table-of-contents", entries: [], bates: { start: "", end: "" }, pageCount: tocPageCountGuess } as PetitionSection,
      soeRendered.section,
      ...criterionRendered.map((entry) => entry.section),
      fmdRendered.section,
      { kind: "exhibit-index", entries: [], bates: { start: "", end: "" }, pageCount: 1 } as PetitionSection,
      ...renderedExhibits.map((entry) => entry.section),
    ];
    const withBates = applyBatesRanges(provisionalSections);
    const exhibitIndexEntries: ExhibitIndexEntry[] = renderedExhibits.map((entry) => {
      const section = withBates.find(
        (candidate) => candidate.kind === "exhibit" && candidate.sourceDocId === entry.document.id,
      ) as PetitionSection & { kind: "exhibit" };
      return {
        exhibitNumber: entry.exhibitNumber.replace(/^Ex\.\s*/i, ""),
        title: entry.document.summary?.title || entry.document.fileName,
        workspaceId: entry.document.jobId,
        docId: entry.document.id,
        pageRange: {
          start: section ? Number(section.bates.start.replace("PET-", "")) : 0,
          end: section ? Number(section.bates.end.replace("PET-", "")) : 0,
        },
        bates: section?.bates ?? { start: "", end: "" },
      };
    });
    const exhibitIndexRendered = await renderTextSection("exhibit-index", {
      title: "Exhibit Index",
      exhibitEntries: exhibitIndexEntries.map((entry) => ({
        exhibitNumber: entry.exhibitNumber,
        title: entry.title,
        pageRange: `${entry.pageRange.start}-${entry.pageRange.end}`,
        bates: `${entry.bates.start}–${entry.bates.end}`,
      })),
    });
    const sectionsWithRealIndex = [
      coverRendered.section,
      { kind: "table-of-contents", entries: [], bates: { start: "", end: "" }, pageCount: tocPageCountGuess } as PetitionSection,
      soeRendered.section,
      ...criterionRendered.map((entry) => entry.section),
      fmdRendered.section,
      exhibitIndexRendered.section,
      ...renderedExhibits.map((entry) => entry.section),
    ];
    const withRealBates = applyBatesRanges(sectionsWithRealIndex);
    tocEntries = withRealBates
      .filter((section) => section.kind !== "table-of-contents")
      .map((section) => ({
        title: buildTocEntryTitle(section),
        page: Number(section.bates.start.replace("PET-", "")),
        bates: section.bates.start,
      }));
    tocRendered = await renderTextSection("table-of-contents", {
      title: "Table of Contents",
      entries: tocEntries,
    });
    if (tocRendered.section.pageCount === tocPageCountGuess) {
      finalBodySections = [
        coverRendered.section,
        tocRendered.section,
        soeRendered.section,
        ...criterionRendered.map((entry) => entry.section),
        fmdRendered.section,
        exhibitIndexRendered.section,
        ...renderedExhibits.map((entry) => entry.section),
      ];
      break;
    }
    tocPageCountGuess = tocRendered.section.pageCount;
  }

  if (!tocRendered || !finalBodySections.length) {
    throw new Error("Unable to build the table of contents for this packet.");
  }

  const sections = applyBatesRanges(finalBodySections);
  const exhibitIndexEntries: ExhibitIndexEntry[] = renderedExhibits.map((entry) => {
    const section = sections.find(
      (candidate) => candidate.kind === "exhibit" && candidate.sourceDocId === entry.document.id,
    ) as Extract<PetitionSection, { kind: "exhibit" }>;
    return {
      exhibitNumber: entry.exhibitNumber.replace(/^Ex\.\s*/i, ""),
      title: entry.document.summary?.title || entry.document.fileName,
      workspaceId: entry.document.jobId,
      docId: entry.document.id,
      pageRange: {
        start: Number(section.bates.start.replace("PET-", "")),
        end: Number(section.bates.end.replace("PET-", "")),
      },
      bates: section.bates,
    };
  });

  const normalizedSections = sections.map((section) =>
    section.kind === "exhibit-index"
      ? {
          ...section,
          entries: exhibitIndexEntries,
        }
      : section,
  );

  const sectionTexts = [
    { sectionId: "statement-of-eligibility", text: normalizedSoe.text },
    ...criterionSectionsSource.map((source) => ({
      sectionId: source.entry.criterionCode,
      text: source.normalizedText,
    })),
    { sectionId: "final-merits-determination", text: normalizedFmd.text },
  ];

  const pinboardEntries = claimedCriteria.flatMap((entry) =>
    (getCriterionPinboard(clientId, entry.criterionCode)?.entries ?? []).map((pinboardEntry) => ({
      exhibitLabel: pinboardEntry.exhibitLabel,
      criterionCode: entry.criterionCode,
    })),
  );

  const findings = buildAuditFindings({
    pinnedEntries: pinboardEntries,
    sectionTexts,
    exhibitLabels: canonicalExhibitLabels,
    criterionDrafts,
    synthesisDrafts: [statementDraft, fmdDraft],
    criterionReferences: [
      {
        sectionId: "statement-of-eligibility",
        references: extractCriterionRefs(normalizedSoe.text),
      },
      {
        sectionId: "final-merits-determination",
        references: extractCriterionRefs(normalizedFmd.text),
      },
    ],
    totalPages: totalPagesFromSections(normalizedSections),
    sections: normalizedSections,
    unsupportedExhibits,
  });

  const packetId = crypto.randomUUID();
  const packetPdfPath = path.join(ensurePacketStorage(clientId), `${packetId}.pdf`);
  const petition: AssembledPetition = {
    id: packetId,
    clientId,
    generatedAt: new Date().toISOString(),
    generatedBy: "Setu",
    status: findings.some((finding) => finding.severity === "blocking") ? "draft" : "ready",
    sections: normalizedSections,
    exhibitIndex: exhibitIndexEntries,
    batesRange: {
      start: normalizedSections[0]?.bates.start ?? "PET-000001",
      end: normalizedSections.at(-1)?.bates.end ?? "PET-000001",
    },
    totalPages: totalPagesFromSections(normalizedSections),
    findings,
    invalidatedAt: null,
    invalidationReason: null,
    pdfPath: packetPdfPath,
  };

  const tocSection = normalizedSections.find(
    (section) => section.kind === "table-of-contents",
  ) as Extract<PetitionSection, { kind: "table-of-contents" }>;
  tocSection.entries = tocEntries.map((entry) => ({
    sectionTitle: entry.title,
    startingBates: entry.bates,
    startingPage: entry.page,
  }));
  const exhibitIndexSection = normalizedSections.find(
    (section) => section.kind === "exhibit-index",
  ) as Extract<PetitionSection, { kind: "exhibit-index" }>;
  exhibitIndexSection.entries = exhibitIndexEntries;

  const renderedSections: RenderedPacketSection[] = [
    { section: normalizedSections[0], pdfBytes: coverRendered.pdfBytes },
    { section: tocSection, pdfBytes: tocRendered.pdfBytes },
    { section: normalizedSections[2], pdfBytes: soeRendered.pdfBytes },
    ...criterionRendered.map((entry, index) => ({
      section: normalizedSections[3 + index],
      pdfBytes: entry.pdfBytes,
    })),
    {
      section: normalizedSections[3 + criterionRendered.length],
      pdfBytes: fmdRendered.pdfBytes,
    },
    {
      section: exhibitIndexSection,
      pdfBytes: (
        await renderTextSection("exhibit-index", {
          title: "Exhibit Index",
          exhibitEntries: exhibitIndexEntries.map((entry) => ({
            exhibitNumber: entry.exhibitNumber,
            title: entry.title,
            pageRange: `${entry.pageRange.start}-${entry.pageRange.end}`,
            bates: `${entry.bates.start}–${entry.bates.end}`,
          })),
        })
      ).pdfBytes,
    },
    ...renderedExhibits.map((entry) => ({
      section: normalizedSections.find(
        (section) => section.kind === "exhibit" && section.sourceDocId === entry.document.id,
      )!,
      pdfBytes: entry.pdfBytes,
    })),
  ];

  return {
    petition,
    renderedSections,
  };
}
