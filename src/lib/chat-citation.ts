import type {
  BriefDraft,
  ChatMessageCitation,
  ClientDocument,
  StressTestReport,
  StrategyMemo,
  TriageAnswer,
} from "@/lib/types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "then",
  "than",
  "have",
  "has",
  "had",
  "was",
  "were",
  "are",
  "not",
  "but",
  "you",
  "your",
  "their",
  "they",
  "them",
  "his",
  "her",
  "its",
  "our",
  "can",
  "may",
  "will",
  "would",
  "should",
  "there",
  "where",
  "which",
  "what",
  "when",
  "been",
  "being",
  "about",
  "over",
  "under",
  "after",
  "before",
  "also",
  "only",
  "very",
  "more",
  "most",
  "such",
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function documentSupportText(document: ClientDocument) {
  return [
    document.summary?.title ?? document.fileName,
    document.summary?.shortSummary ?? "",
    document.summary?.detailedSummary ?? "",
    document.summary?.evidenceValue ?? "",
    document.summary?.recommendedUse ?? "",
    document.summary?.notableFacts.join(" ") ?? "",
    document.summary?.tags.join(" ") ?? "",
    document.summary?.organizations.join(" ") ?? "",
    document.summary?.people.join(" ") ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function supportScore(claim: string, supportText: string) {
  const claimTokens = tokenize(claim);

  if (!claimTokens.length) {
    return 0;
  }

  const supportTokens = new Set(tokenize(supportText));
  const matches = claimTokens.filter((token) => supportTokens.has(token)).length;

  return matches / claimTokens.length;
}

function excerptForDocument(document: ClientDocument) {
  return (
    document.summary?.shortSummary ||
    document.summary?.detailedSummary ||
    document.summary?.evidenceValue ||
    document.fileName
  ).slice(0, 220);
}

function toCitation(document: ClientDocument, claim: string): ChatMessageCitation {
  return {
    docId: document.id,
    workspaceId: document.jobId,
    excerpt: excerptForDocument(document),
    supports: claim,
    label: document.summary?.title || document.fileName,
  };
}

function resolveSupportedDocuments(
  claim: string,
  docIds: string[],
  documents: ClientDocument[],
  threshold = 0.2,
) {
  const lookup = new Map(documents.map((document) => [document.id, document]));

  return [...new Set(docIds)]
    .map((docId) => lookup.get(docId) ?? null)
    .filter((document): document is ClientDocument => Boolean(document))
    .filter((document) => supportScore(claim, documentSupportText(document)) >= threshold);
}

function uniqueCitations(citations: ChatMessageCitation[]) {
  const seen = new Set<string>();

  return citations.filter((citation) => {
    const key = `${citation.docId}:${citation.supports}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function hasCitationCoverageForClaim(
  claim: string,
  citations: ChatMessageCitation[],
  threshold = 0.45,
) {
  return citations.some((citation) => supportScore(claim, citation.supports) >= threshold);
}

export function applyCitationContractToTriage(answer: TriageAnswer, documents: ClientDocument[]) {
  const droppedClaims: string[] = [];
  const nextBlocks = answer.answer
    .map((block) => {
      const supportedDocuments = resolveSupportedDocuments(block.text, block.docIds, documents);

      if (!supportedDocuments.length) {
        droppedClaims.push(block.text);
        return null;
      }

      return {
        block: {
          ...block,
          docIds: supportedDocuments.map((document) => document.id),
        },
        citations: supportedDocuments.map((document) => toCitation(document, block.text)),
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        block: TriageAnswer["answer"][number];
        citations: ChatMessageCitation[];
      } => Boolean(entry),
    );

  return {
    answer: {
      ...answer,
      answer: nextBlocks.map((entry) => entry.block),
    },
    citations: uniqueCitations(nextBlocks.flatMap((entry) => entry.citations)),
    droppedClaims,
  };
}

export function applyCitationContractToStrategy(memo: StrategyMemo, documents: ClientDocument[]) {
  const validCitationEntries = memo.citations.flatMap((citation) => {
    const supportedDocuments = resolveSupportedDocuments(citation.claim, [citation.docId], documents);
    return supportedDocuments.map((document) => toCitation(document, citation.claim));
  });
  const citations = uniqueCitations(validCitationEntries);
  const droppedClaims: string[] = [];

  const filterRecommendations = (entries: StrategyMemo["recommendedMix"]["primary"]) =>
    entries.filter((entry) => {
      const claim = `${entry.criterionCode} ${entry.rationale}`;
      const supportedDocuments = resolveSupportedDocuments(claim, entry.anchorDocIds, documents);
      const supported =
        supportedDocuments.length > 0 || hasCitationCoverageForClaim(entry.rationale, citations);

      if (!supported) {
        droppedClaims.push(entry.rationale);
        return false;
      }

      entry.anchorDocIds = supportedDocuments.length
        ? supportedDocuments.map((document) => document.id)
        : entry.anchorDocIds;
      return true;
    });

  const primary = filterRecommendations([...memo.recommendedMix.primary]);
  const supporting = filterRecommendations([...memo.recommendedMix.supporting]).filter(
    (entry) => !primary.some((primaryEntry) => primaryEntry.criterionCode === entry.criterionCode),
  );
  const gaps = memo.gaps.filter((gap) => {
    const claim = `${gap.criterionCode} ${gap.description}`;
    const supported = hasCitationCoverageForClaim(claim, citations);

    if (!supported) {
      droppedClaims.push(gap.description);
    }

    return supported;
  });
  const risks = memo.risks.filter((risk) => {
    const claim = `${risk.type} ${risk.description}`;
    const supportedDocuments = resolveSupportedDocuments(claim, risk.affectedDocIds, documents);
    const supported =
      supportedDocuments.length > 0 || hasCitationCoverageForClaim(risk.description, citations);

    if (!supported) {
      droppedClaims.push(risk.description);
      return false;
    }

    risk.affectedDocIds = supportedDocuments.length
      ? supportedDocuments.map((document) => document.id)
      : risk.affectedDocIds;
    return true;
  });
  const leadSupported =
    resolveSupportedDocuments(
      memo.leadArgument.narrativeSpine,
      memo.leadArgument.anchorDocIds,
      documents,
    ).length > 0 || hasCitationCoverageForClaim(memo.leadArgument.narrativeSpine, citations);

  const leadArgument = leadSupported
    ? memo.leadArgument
    : {
        ...memo.leadArgument,
        narrativeSpine: "Setu could not produce a fully citable lead argument from the current evidence.",
      };

  if (!leadSupported) {
    droppedClaims.push(memo.leadArgument.narrativeSpine);
  }

  return {
    memo: {
      ...memo,
      recommendedMix: {
        primary,
        supporting,
        decline: memo.recommendedMix.decline,
      },
      leadArgument,
      gaps,
      risks,
      citations: citations.map((citation) => ({
        docId: citation.docId,
        claim: citation.supports,
      })),
    },
    citations,
    droppedClaims,
  };
}

export function applyCitationContractToStressTest(
  report: StressTestReport,
  documents: ClientDocument[],
) {
  const droppedClaims: string[] = [];
  const lookup = new Map(documents.map((document) => [document.id, document]));

  const challenges = report.challenges.filter((challenge) => {
    const directDocuments = [...new Set(challenge.atRiskDocIds)]
      .map((docId) => lookup.get(docId) ?? null)
      .filter((document): document is ClientDocument => Boolean(document));
    const criterionMatchedDocuments = directDocuments.filter((document) =>
      document.criteriaTags.some((tag) => tag.code === challenge.criterionCode),
    );
    const acceptedDocuments = criterionMatchedDocuments.length
      ? criterionMatchedDocuments
      : directDocuments;

    if (!acceptedDocuments.length) {
      droppedClaims.push(challenge.uscisStance);
      return false;
    }

    challenge.atRiskDocIds = acceptedDocuments.map((document) => document.id);
    return true;
  });

  const citations = uniqueCitations(
    challenges.flatMap((challenge) =>
      challenge.atRiskDocIds
        .map((docId) => lookup.get(docId) ?? null)
        .filter((document): document is ClientDocument => Boolean(document))
        .map((document) => toCitation(document, challenge.uscisStance)),
    ),
  );

  return {
    report: {
      ...report,
      challenges,
    },
    citations,
    droppedClaims,
  };
}

export function applyCitationContractToDraft(draft: BriefDraft, documents: ClientDocument[]) {
  const droppedClaims: string[] = [];
  const paragraphs = draft.paragraphs.filter((paragraph) => {
    const citations = paragraph.citations
      .map((citation) => {
        const supportedDocuments = resolveSupportedDocuments(
          citation.supports,
          [citation.docId],
          documents,
          0.12,
        );
        return supportedDocuments.length
          ? {
              ...citation,
              docId: supportedDocuments[0].id,
            }
          : null;
      })
      .filter((citation): citation is BriefDraft["paragraphs"][number]["citations"][number] => Boolean(citation));

    if (!citations.length || !paragraph.exhibitRefs.length) {
      droppedClaims.push(paragraph.text);
      return false;
    }

    paragraph.citations = citations;
    return true;
  });

  const chatCitations = uniqueCitations(
    paragraphs.flatMap((paragraph) =>
      paragraph.citations.flatMap((citation) => {
        const document = documents.find((candidate) => candidate.id === citation.docId);
        return document ? [toCitation(document, citation.supports)] : [];
      }),
    ),
  );

  return {
    draft: {
      ...draft,
      paragraphs,
    },
    citations: chatCitations,
    droppedClaims,
  };
}
