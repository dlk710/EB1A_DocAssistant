import type {
  ClientDocument,
  CriterionDraft,
  DraftParagraph,
  SynthesisParagraph,
} from "@/lib/types";

export interface FactCheckAssessment {
  drift: boolean;
  severity: "none" | "subtle" | "significant";
  note?: string;
}

export interface DraftFactCheckResult {
  paragraphs: DraftParagraph[];
  subtleCount: number;
  blockingCount: number;
}

export interface SynthesisFactCheckResult {
  paragraphs: SynthesisParagraph[];
  subtleCount: number;
  blockingCount: number;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "have",
  "has",
  "had",
  "was",
  "were",
  "are",
  "is",
  "not",
  "but",
  "his",
  "her",
  "their",
  "they",
  "them",
  "which",
  "what",
  "when",
  "where",
  "will",
  "would",
  "could",
  "should",
  "been",
  "being",
  "there",
  "about",
  "under",
  "over",
  "after",
  "before",
]);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

export function buildFactCheckSupportText(document: ClientDocument) {
  return [
    document.summary?.title ?? document.fileName,
    document.summary?.shortSummary ?? "",
    document.summary?.detailedSummary ?? "",
    document.summary?.evidenceValue ?? "",
    document.summary?.recommendedUse ?? "",
    document.metadata?.preview ?? "",
    document.summary?.notableFacts.join(" ") ?? "",
    document.summary?.tags.join(" ") ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function overlapScore(claim: string, source: string) {
  const claimTokens = tokenize(claim);
  if (!claimTokens.length) {
    return 0;
  }
  const sourceTokens = new Set(tokenize(source));
  const matches = claimTokens.filter((token) => sourceTokens.has(token)).length;
  return matches / claimTokens.length;
}

function includesPhrase(source: string, phrase: string) {
  return normalize(source).includes(normalize(phrase));
}

export function factCheckClaimAgainstSource(claim: string, source: string): FactCheckAssessment {
  const normalizedClaim = normalize(claim);
  const normalizedSource = normalize(source);

  if (!normalizedSource.trim()) {
    return {
      drift: true,
      severity: "significant",
      note: "No source text was available for this citation.",
    };
  }

  if (normalizedSource.includes(normalizedClaim) || normalizedClaim.includes(normalizedSource.slice(0, 60))) {
    return {
      drift: false,
      severity: "none",
    };
  }

  if (/sole|only|exclusively/.test(normalizedClaim) && !/sole|only|exclusive/.test(normalizedSource)) {
    return {
      drift: true,
      severity: "significant",
      note: "The draft introduces exclusivity that the source text does not show.",
    };
  }

  if (/received|won|award|honor|prize/.test(normalizedClaim) && !/received|won|award|honor|prize/.test(normalizedSource)) {
    return {
      drift: true,
      severity: "significant",
      note: "The draft describes an award or honor not reflected in the cited source.",
    };
  }

  if (includesPhrase(claim, "the lead architect") && includesPhrase(source, "a lead architect")) {
    return {
      drift: true,
      severity: "subtle",
      note: "The source says 'a lead architect,' while the draft says 'the lead architect.'",
    };
  }

  const overlap = overlapScore(claim, source);
  if (overlap >= 0.52) {
    return {
      drift: false,
      severity: "none",
    };
  }

  if (overlap >= 0.3) {
    return {
      drift: true,
      severity: "subtle",
      note: "The draft is directionally supported but adds modifiers or emphasis beyond the source wording.",
    };
  }

  return {
    drift: true,
    severity: "significant",
    note: "The claim is not grounded closely enough in the cited source text.",
  };
}

export function runDraftFactCheck(
  paragraphs: DraftParagraph[],
  documentLookup: Map<string, ClientDocument>,
): DraftFactCheckResult {
  let subtleCount = 0;
  let blockingCount = 0;

  const nextParagraphs = paragraphs.map((paragraph) => {
    if (!paragraph.citations.length) {
      blockingCount += 1;
      return {
        ...paragraph,
        factCheckStatus: "uncited" as const,
        factCheckNotes: "No grounded citation backs this paragraph yet.",
      };
    }

    const primaryClaim =
      paragraph.citations[0]?.supports || paragraph.text.slice(0, 240);
    const assessments = paragraph.citations.map((citation) => {
      const source = citation.excerpt || buildFactCheckSupportText(documentLookup.get(citation.docId)!);
      return factCheckClaimAgainstSource(primaryClaim, source);
    });

    if (assessments.some((assessment) => assessment.severity === "significant")) {
      blockingCount += 1;
      return {
        ...paragraph,
        factCheckStatus: "drift-detected" as const,
        factCheckNotes:
          `Significant drift: ${
            assessments.find((assessment) => assessment.severity === "significant")?.note ||
            "the paragraph and its cited source materially diverge."
          }`,
      };
    }

    if (assessments.some((assessment) => assessment.severity === "subtle")) {
      subtleCount += 1;
      return {
        ...paragraph,
        factCheckStatus: "drift-detected" as const,
        factCheckNotes:
          `Subtle drift: ${
            assessments.find((assessment) => assessment.severity === "subtle")?.note ||
            "the paragraph and its cited source are directionally aligned but not exact."
          }`,
      };
    }

    return {
      ...paragraph,
      factCheckStatus: "verified" as const,
      factCheckNotes: undefined,
    };
  });

  return {
    paragraphs: nextParagraphs,
    subtleCount,
    blockingCount,
  };
}

function latestApprovedDraftParagraphs(draft: CriterionDraft | undefined | null) {
  if (!draft || draft.latestApprovedVersion === null) {
    return [];
  }
  return (
    draft.versions.find((version) => version.version === draft.latestApprovedVersion)?.paragraphs ?? []
  );
}

function synthesisCitationSupport(
  paragraph: SynthesisParagraph,
  approvedDraftLookup: Map<string, CriterionDraft>,
) {
  return paragraph.citations
    .map((citation) => {
      if (citation.docId) {
        return citation.excerpt || "";
      }

      if (citation.criterionDraftId) {
        const draft = approvedDraftLookup.get(citation.criterionDraftId);
        const matchedParagraph = latestApprovedDraftParagraphs(draft).find(
          (candidate) => candidate.id === citation.draftVersionParagraphId,
        );
        return citation.draftExcerpt || matchedParagraph?.text || "";
      }

      return "";
    })
    .filter(Boolean);
}

export function factCheckSynthesisParagraph(input: {
  paragraph: SynthesisParagraph;
  documentLookup: Map<string, ClientDocument>;
  approvedDraftLookup: Map<string, CriterionDraft>;
}) {
  const { paragraph, approvedDraftLookup } = input;

  if (!paragraph.citations.length) {
    return {
      paragraph: {
        ...paragraph,
        factCheckStatus: "uncited" as const,
        factCheckNotes: "No grounded citation backs this paragraph yet.",
      },
      subtle: false,
      blocking: true,
    };
  }

  const primaryClaim =
    paragraph.citations[0]?.supports || paragraph.text.slice(0, 320);
  const sources = synthesisCitationSupport(paragraph, approvedDraftLookup);
  const assessments = sources.map((source) => factCheckClaimAgainstSource(primaryClaim, source));

  if (!assessments.length || assessments.some((assessment) => assessment.severity === "significant")) {
    return {
      paragraph: {
        ...paragraph,
        factCheckStatus: "drift-detected" as const,
        factCheckNotes:
          `Significant drift: ${
            assessments.find((assessment) => assessment.severity === "significant")?.note ||
            "the paragraph and its cited support materially diverge."
          }`,
      },
      subtle: false,
      blocking: true,
    };
  }

  if (assessments.some((assessment) => assessment.severity === "subtle")) {
    return {
      paragraph: {
        ...paragraph,
        factCheckStatus: "drift-detected" as const,
        factCheckNotes:
          `Subtle drift: ${
            assessments.find((assessment) => assessment.severity === "subtle")?.note ||
            "the paragraph is directionally supported but slightly stronger than its source material."
          }`,
      },
      subtle: true,
      blocking: false,
    };
  }

  return {
    paragraph: {
      ...paragraph,
      factCheckStatus: "verified" as const,
      factCheckNotes: undefined,
    },
    subtle: false,
    blocking: false,
  };
}

export function runSynthesisFactCheck(
  paragraphs: SynthesisParagraph[],
  documentLookup: Map<string, ClientDocument>,
  approvedDraftLookup: Map<string, CriterionDraft>,
): SynthesisFactCheckResult {
  let subtleCount = 0;
  let blockingCount = 0;

  const nextParagraphs = paragraphs.map((paragraph) => {
    const result = factCheckSynthesisParagraph({
      paragraph,
      documentLookup,
      approvedDraftLookup,
    });

    if (result.subtle) {
      subtleCount += 1;
    }
    if (result.blocking) {
      blockingCount += 1;
    }

    return result.paragraph;
  });

  return {
    paragraphs: nextParagraphs,
    subtleCount,
    blockingCount,
  };
}
