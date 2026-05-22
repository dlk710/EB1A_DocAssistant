import crypto from "node:crypto";
import {
  buildCriterionTreeBlueprint,
  getCriterionPromptDefinition,
} from "@/lib/criterion-prompts";
import type {
  CriterionDraft,
  DraftParagraph,
  DraftVersion,
  EndorsementQuote,
  SubsectionDraft,
  SubsectionVersion,
} from "@/lib/types";

function wordCountFromParagraphs(paragraphs: DraftParagraph[]) {
  return paragraphs.reduce(
    (sum, paragraph) => sum + paragraph.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
}

function normalizeParagraph(paragraph: DraftParagraph): DraftParagraph {
  return {
    id: paragraph.id || crypto.randomUUID(),
    text: paragraph.text || "",
    exhibitRefs: Array.isArray(paragraph.exhibitRefs) ? paragraph.exhibitRefs : [],
    citations: Array.isArray(paragraph.citations) ? paragraph.citations : [],
    factCheckStatus: paragraph.factCheckStatus || "pending",
    factCheckNotes: paragraph.factCheckNotes,
  };
}

function normalizeQuote(quote: EndorsementQuote, subsectionId: string): EndorsementQuote {
  return {
    id: quote.id || crypto.randomUUID(),
    expertName: quote.expertName || "Unnamed expert",
    expertTitleAtLetter: quote.expertTitleAtLetter || "Title not parsed",
    expertCurrentRole: quote.expertCurrentRole ?? null,
    expertAffiliation: quote.expertAffiliation || "Affiliation not parsed",
    sourceExhibitNumber: quote.sourceExhibitNumber || "Exhibit pending",
    sourceDocId: quote.sourceDocId,
    quoteText: quote.quoteText,
    anchoredToSubsectionId: quote.anchoredToSubsectionId || subsectionId,
    supportsClaim: quote.supportsClaim || "",
    isIndependent:
      typeof quote.isIndependent === "boolean" ? quote.isIndependent : null,
  };
}

function normalizeSubsectionVersion(
  version: SubsectionVersion,
  index: number,
  subsectionId: string,
): SubsectionVersion {
  const paragraphs = Array.isArray(version.paragraphs)
    ? version.paragraphs.map(normalizeParagraph)
    : [];
  const endorsementQuotes = Array.isArray(version.endorsementQuotes)
    ? version.endorsementQuotes.map((quote) => normalizeQuote(quote, subsectionId))
    : [];

  return {
    version: version.version || index + 1,
    createdAt: version.createdAt || new Date().toISOString(),
    source: version.source || "manual",
    paragraphs,
    endorsementQuotes,
    wordCount:
      version.wordCount ||
      wordCountFromParagraphs(paragraphs) +
        endorsementQuotes.reduce((sum, quote) => sum + wordCountFromParagraphs([
          {
            id: quote.id,
            text: quote.quoteText,
            exhibitRefs: [quote.sourceExhibitNumber],
            citations: [],
            factCheckStatus: "verified",
          },
        ]), 0),
    costUsd: Number.isFinite(version.costUsd) ? version.costUsd : 0,
  };
}

export function normalizeSubsectionDraft(
  subsection: SubsectionDraft,
  parentId: string | null = null,
  level = 0,
): SubsectionDraft {
  const id = subsection.id || crypto.randomUUID();
  const paragraphs = Array.isArray(subsection.paragraphs)
    ? subsection.paragraphs.map(normalizeParagraph)
    : [];
  const endorsementQuotes = Array.isArray(subsection.endorsementQuotes)
    ? subsection.endorsementQuotes.map((quote) => normalizeQuote(quote, id))
    : [];
  const versions = Array.isArray(subsection.versions)
    ? subsection.versions.map((version, index) =>
        normalizeSubsectionVersion(version, index, id),
      )
    : [];
  const children = Array.isArray(subsection.children)
    ? subsection.children.map((child) => normalizeSubsectionDraft(child, id, level + 1))
    : [];

  return {
    id,
    parentId,
    title: subsection.title || "Untitled subsection",
    level: typeof subsection.level === "number" ? subsection.level : level,
    paragraphs,
    endorsementQuotes,
    children,
    status: subsection.status || "in-progress",
    versions,
    latestApprovedVersion:
      typeof subsection.latestApprovedVersion === "number"
        ? subsection.latestApprovedVersion
        : subsection.status === "approved"
          ? versions.at(-1)?.version ?? null
          : null,
    gapNotes: Array.isArray(subsection.gapNotes) ? subsection.gapNotes : [],
    supportsClaim: subsection.supportsClaim,
  };
}

function createSubsectionNode(input: {
  parentId: string | null;
  level: number;
  title: string;
  supportsClaim?: string;
  children?: SubsectionDraft[];
}) {
  return {
    id: crypto.randomUUID(),
    parentId: input.parentId,
    title: input.title,
    level: input.level,
    paragraphs: [],
    endorsementQuotes: [],
    children: input.children ?? [],
    status: "in-progress",
    versions: [],
    latestApprovedVersion: null,
    gapNotes: [],
    supportsClaim: input.supportsClaim,
  } satisfies SubsectionDraft;
}

export function createCriterionRoot(input: {
  criterionCode: string;
  kind: CriterionDraft["kind"];
  sectionUnits: string[];
}) {
  const blueprint = buildCriterionTreeBlueprint({
    criterionCode: input.criterionCode,
    kind: input.kind,
    sectionUnits: input.sectionUnits,
  });
  const root = createSubsectionNode({
    parentId: null,
    level: 0,
    title: blueprint.rootTitle,
    supportsClaim: getCriterionPromptDefinition(input.kind === "comparable-evidence" ? "11" : input.criterionCode)
      .structuralRequirement,
  });

  root.children = blueprint.sections.map((section) => {
    const sectionNode = createSubsectionNode({
      parentId: root.id,
      level: 1,
      title: section.title,
      supportsClaim: section.supportsClaim,
    });
    sectionNode.children = section.children.map((child) =>
      createSubsectionNode({
        parentId: sectionNode.id,
        level: 2,
        title: child.title,
        supportsClaim: child.supportsClaim,
      }),
    );
    return sectionNode;
  });

  return root;
}

export function listSubsections(root: SubsectionDraft) {
  const items: SubsectionDraft[] = [];

  function visit(node: SubsectionDraft) {
    items.push(node);
    node.children.forEach(visit);
  }

  visit(root);
  return items;
}

export function findSubsection(root: SubsectionDraft, subsectionId: string) {
  return listSubsections(root).find((node) => node.id === subsectionId) ?? null;
}

export function updateSubsection(
  root: SubsectionDraft,
  subsectionId: string,
  updater: (subsection: SubsectionDraft) => SubsectionDraft,
): SubsectionDraft {
  if (root.id === subsectionId) {
    return normalizeSubsectionDraft(updater(root), root.parentId, root.level);
  }

  return {
    ...root,
    children: root.children.map((child) => updateSubsection(child, subsectionId, updater)),
  };
}

export function collectRenderedParagraphs(root: SubsectionDraft): DraftParagraph[] {
  const paragraphs: DraftParagraph[] = [];

  function visit(node: SubsectionDraft) {
    node.paragraphs.forEach((paragraph) => {
      paragraphs.push(normalizeParagraph(paragraph));
    });
    node.endorsementQuotes.forEach((quote) => {
      paragraphs.push({
        id: `quote:${quote.id}`,
        text: `“${quote.quoteText}” — ${quote.expertName}, ${quote.expertTitleAtLetter}${quote.expertAffiliation ? `, ${quote.expertAffiliation}` : ""}`,
        exhibitRefs: quote.sourceExhibitNumber ? [quote.sourceExhibitNumber] : [],
        citations: [
          {
            docId: quote.sourceDocId,
            workspaceId: "",
            excerpt: quote.quoteText,
            supports: quote.supportsClaim || node.supportsClaim || node.title,
          },
        ],
        factCheckStatus: "verified",
      });
    });
    node.children.forEach(visit);
  }

  visit(root);
  return paragraphs;
}

export function criterionStatusFromRoot(root: SubsectionDraft): CriterionDraft["status"] {
  const items = listSubsections(root);

  if (items.some((item) => item.status === "out-of-date")) {
    return "out-of-date";
  }

  if (
    items.length > 0 &&
    items.every(
      (item) => item.latestApprovedVersion !== null && item.status === "approved",
    )
  ) {
    return "approved";
  }

  return "in-progress";
}

export function subsectionVersionFromContent(input: {
  existingCount: number;
  source: SubsectionVersion["source"];
  paragraphs: DraftParagraph[];
  endorsementQuotes?: EndorsementQuote[];
  costUsd?: number;
}) {
  const paragraphs = input.paragraphs.map(normalizeParagraph);
  const endorsementQuotes = (input.endorsementQuotes ?? []).map((quote) =>
    normalizeQuote(quote, quote.anchoredToSubsectionId),
  );

  return {
    version: input.existingCount + 1,
    createdAt: new Date().toISOString(),
    source: input.source,
    paragraphs,
    endorsementQuotes,
    wordCount:
      wordCountFromParagraphs(paragraphs) +
      endorsementQuotes.reduce(
        (sum, quote) => sum + quote.quoteText.trim().split(/\s+/).filter(Boolean).length,
        0,
      ),
    costUsd: input.costUsd ?? 0,
  } satisfies SubsectionVersion;
}

export function buildAggregateCriterionVersion(input: {
  draft: CriterionDraft;
  source: DraftVersion["source"];
  authorNotes?: string;
  costUsd?: number;
  versionNumber?: number;
}) {
  const paragraphs = collectRenderedParagraphs(input.draft.root);
  return {
    version: input.versionNumber ?? (input.draft.versions.at(-1)?.version ?? 0) + 1,
    createdAt: new Date().toISOString(),
    source: input.source,
    authorNotes: input.authorNotes || "",
    paragraphs,
    wordCount: wordCountFromParagraphs(paragraphs),
    costUsd: input.costUsd ?? 0,
  } satisfies DraftVersion;
}

export function markTreeOutOfDate(root: SubsectionDraft): SubsectionDraft {
  return {
    ...root,
    status: "out-of-date",
    children: root.children.map(markTreeOutOfDate),
  };
}
