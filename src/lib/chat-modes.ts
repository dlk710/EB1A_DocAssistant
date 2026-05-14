import { z } from "zod";
import type {
  BriefDraft,
  ChatMessageCitation,
  ClientDocument,
  LibrarySnapshot,
  StressTestReport,
  StrategyMemo,
  TriageAnswer,
} from "@/lib/types";

export const triageAnswerSchema = z.object({
  schemaVersion: z.literal("triage-answer/1.0"),
  answer: z.array(
    z.object({
      text: z.string().min(1).max(600),
      docIds: z.array(z.string().min(1)).min(1).max(6),
    }),
  ),
  insufficiencyNote: z.string().nullable(),
});

export const triageAnswerJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", const: "triage-answer/1.0" },
    answer: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          docIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["text", "docIds"],
      },
    },
    insufficiencyNote: {
      type: ["string", "null"],
    },
  },
  required: ["schemaVersion", "answer", "insufficiencyNote"],
} as const;

export const strategyMemoSchema = z.object({
  schemaVersion: z.literal("strategy-memo/1.0"),
  jobId: z.string().min(1),
  createdAt: z.string().min(1),
  petitionType: z.literal("EB-1A"),
  pendingDocsConsidered: z.number().int().min(0),
  recommendedMix: z.object({
    primary: z.array(
      z.object({
        criterionCode: z.string().min(1),
        rationale: z.string().min(1).max(700),
        anchorDocIds: z.array(z.string().min(1)).min(1).max(4),
      }),
    ),
    supporting: z.array(
      z.object({
        criterionCode: z.string().min(1),
        rationale: z.string().min(1).max(700),
        anchorDocIds: z.array(z.string().min(1)).min(1).max(4),
      }),
    ),
    decline: z.array(
      z.object({
        criterionCode: z.string().min(1),
        rationale: z.string().min(1).max(500),
      }),
    ),
  }),
  leadArgument: z.object({
    criterionCode: z.string().min(1),
    narrativeSpine: z.string().min(1).max(1400),
    anchorDocIds: z.array(z.string().min(1)).min(1).max(5),
  }),
  gaps: z.array(
    z.object({
      criterionCode: z.string().min(1),
      type: z.enum([
        "insufficient-quantity",
        "lack-of-independence",
        "lack-of-significance",
        "missing-context",
      ]),
      description: z.string().min(1).max(600),
      suggestedAdditions: z.array(z.string().min(1).max(300)).max(6),
    }),
  ),
  risks: z.array(
    z.object({
      type: z.string().min(1).max(120),
      description: z.string().min(1).max(600),
      severity: z.enum(["low", "medium", "high"]),
      affectedDocIds: z.array(z.string().min(1)).max(6),
    }),
  ),
  citations: z.array(
    z.object({
      docId: z.string().min(1),
      claim: z.string().min(1).max(500),
    }),
  ),
});

export const strategyMemoJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", const: "strategy-memo/1.0" },
    jobId: { type: "string" },
    createdAt: { type: "string" },
    petitionType: { type: "string", const: "EB-1A" },
    pendingDocsConsidered: { type: "integer", minimum: 0 },
    recommendedMix: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              criterionCode: { type: "string" },
              rationale: { type: "string" },
              anchorDocIds: { type: "array", items: { type: "string" } },
            },
            required: ["criterionCode", "rationale", "anchorDocIds"],
          },
        },
        supporting: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              criterionCode: { type: "string" },
              rationale: { type: "string" },
              anchorDocIds: { type: "array", items: { type: "string" } },
            },
            required: ["criterionCode", "rationale", "anchorDocIds"],
          },
        },
        decline: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              criterionCode: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["criterionCode", "rationale"],
          },
        },
      },
      required: ["primary", "supporting", "decline"],
    },
    leadArgument: {
      type: "object",
      additionalProperties: false,
      properties: {
        criterionCode: { type: "string" },
        narrativeSpine: { type: "string" },
        anchorDocIds: { type: "array", items: { type: "string" } },
      },
      required: ["criterionCode", "narrativeSpine", "anchorDocIds"],
    },
    gaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          criterionCode: { type: "string" },
          type: {
            type: "string",
            enum: [
              "insufficient-quantity",
              "lack-of-independence",
              "lack-of-significance",
              "missing-context",
            ],
          },
          description: { type: "string" },
          suggestedAdditions: { type: "array", items: { type: "string" } },
        },
        required: ["criterionCode", "type", "description", "suggestedAdditions"],
      },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          affectedDocIds: { type: "array", items: { type: "string" } },
        },
        required: ["type", "description", "severity", "affectedDocIds"],
      },
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          docId: { type: "string" },
          claim: { type: "string" },
        },
        required: ["docId", "claim"],
      },
    },
  },
  required: [
    "schemaVersion",
    "jobId",
    "createdAt",
    "petitionType",
    "pendingDocsConsidered",
    "recommendedMix",
    "leadArgument",
    "gaps",
    "risks",
    "citations",
  ],
} as const;

export const stressTestReportSchema = z.object({
  schemaVersion: z.literal("stress-test/1.0"),
  jobId: z.string().min(1),
  createdAt: z.string().min(1),
  scope: z.union([
    z.literal("full-petition"),
    z.object({
      criterionCode: z.string().min(1),
    }),
  ]),
  strategyMemoVersion: z.string().nullable(),
  pendingDocsConsidered: z.number().int().min(0),
  challenges: z.array(
    z.object({
      criterionCode: z.string().min(1),
      challengeType: z.enum([
        "insufficiency",
        "lack-of-independence",
        "lack-of-significance",
        "comparability",
        "sustained-acclaim",
      ]),
      uscisStance: z.string().min(1).max(900),
      atRiskDocIds: z.array(z.string().min(1)).min(1).max(8),
      currentMitigation: z.string().min(1).max(700),
      suggestedAction: z.enum([
        "add-evidence",
        "rewrite-brief",
        "reorganize",
        "accept-risk",
      ]),
      suggestedActionDetail: z.string().min(1).max(700),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),
});

export const stressTestReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", const: "stress-test/1.0" },
    jobId: { type: "string" },
    createdAt: { type: "string" },
    scope: {
      anyOf: [
        { type: "string", const: "full-petition" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            criterionCode: { type: "string" },
          },
          required: ["criterionCode"],
        },
      ],
    },
    strategyMemoVersion: { type: ["string", "null"] },
    pendingDocsConsidered: { type: "integer", minimum: 0 },
    challenges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          criterionCode: { type: "string" },
          challengeType: {
            type: "string",
            enum: [
              "insufficiency",
              "lack-of-independence",
              "lack-of-significance",
              "comparability",
              "sustained-acclaim",
            ],
          },
          uscisStance: { type: "string" },
          atRiskDocIds: { type: "array", items: { type: "string" } },
          currentMitigation: { type: "string" },
          suggestedAction: {
            type: "string",
            enum: ["add-evidence", "rewrite-brief", "reorganize", "accept-risk"],
          },
          suggestedActionDetail: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: [
          "criterionCode",
          "challengeType",
          "uscisStance",
          "atRiskDocIds",
          "currentMitigation",
          "suggestedAction",
          "suggestedActionDetail",
          "severity",
        ],
      },
    },
  },
  required: [
    "schemaVersion",
    "jobId",
    "createdAt",
    "scope",
    "strategyMemoVersion",
    "pendingDocsConsidered",
    "challenges",
  ],
} as const;

export const briefDraftSchema = z.object({
  schemaVersion: z.literal("brief-draft/1.0"),
  jobId: z.string().min(1),
  createdAt: z.string().min(1),
  section: z.enum([
    "statement-of-eligibility",
    "criterion-argument",
    "final-merits-determination",
    "introduction",
    "conclusion",
  ]),
  targetCriterionCode: z.string().nullable(),
  title: z.string().min(1).max(240),
  paragraphs: z.array(
    z.object({
      text: z.string().min(1).max(1800),
      exhibitRefs: z.array(z.string().min(1).max(80)).min(1).max(6),
      citations: z.array(
        z.object({
          docId: z.string().min(1),
          supports: z.string().min(1).max(320),
        }),
      ).min(1).max(8),
    }),
  ).min(1).max(8),
  wordCount: z.number().int().min(1),
});

export const briefDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", const: "brief-draft/1.0" },
    jobId: { type: "string" },
    createdAt: { type: "string" },
    section: {
      type: "string",
      enum: [
        "statement-of-eligibility",
        "criterion-argument",
        "final-merits-determination",
        "introduction",
        "conclusion",
      ],
    },
    targetCriterionCode: { type: ["string", "null"] },
    title: { type: "string" },
    paragraphs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          exhibitRefs: { type: "array", items: { type: "string" } },
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                docId: { type: "string" },
                supports: { type: "string" },
              },
              required: ["docId", "supports"],
            },
          },
        },
        required: ["text", "exhibitRefs", "citations"],
      },
    },
    wordCount: { type: "integer", minimum: 1 },
  },
  required: [
    "schemaVersion",
    "jobId",
    "createdAt",
    "section",
    "targetCriterionCode",
    "title",
    "paragraphs",
    "wordCount",
  ],
} as const;

export function buildRetrievedDocsBlock(documents: ClientDocument[]) {
  return documents
    .map((document, index) =>
      [
        `${index + 1}. [doc:${document.id}] ${document.summary?.title || document.fileName}`,
        `Path: ${document.relativePath}`,
        `Review status: ${document.reviewStatus}`,
        `Summary: ${document.summary?.shortSummary || "Summary pending."}`,
        `Detailed: ${document.summary?.detailedSummary || "Detailed summary pending."}`,
        `Tags: ${(document.summary?.tags ?? []).join(", ") || "None"}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export function buildCoverageBlock(snapshot: LibrarySnapshot) {
  if (!snapshot.coverage) {
    return "Coverage unavailable.";
  }

  return snapshot.coverage.criteria
    .map(
      (criterion) =>
        `${criterion.legalCode} ${criterion.name}: ${criterion.state}, kept=${criterion.keptCount}, primary=${criterion.primaryCount}, supporting=${criterion.supportingCount}`,
    )
    .join("\n");
}

export function buildKeptDocsBlock(documents: ClientDocument[]) {
  return documents
    .filter((document) => document.reviewStatus === "kept")
    .slice(0, 40)
    .map(
      (document) =>
        `[doc:${document.id}] ${document.summary?.title || document.fileName} :: ${document.summary?.shortSummary || "Summary pending."} :: criteria ${document.criteriaTags.map((tag) => `${tag.legalCode} ${tag.role}`).join(", ") || "none"}`,
    )
    .join("\n");
}

export function buildPendingDocsBlock(documents: ClientDocument[]) {
  return documents
    .filter((document) => document.reviewStatus === "pending")
    .slice(0, 20)
    .map(
      (document) =>
        `[doc:${document.id}] ${document.summary?.title || document.fileName} :: ${document.summary?.shortSummary || "Summary pending."}`,
    )
    .join("\n");
}

export function buildPendingDisclosure(documents: ClientDocument[]) {
  const kept = documents.filter((document) => document.reviewStatus === "kept").length;
  const pending = documents.filter((document) => document.reviewStatus === "pending").length;
  const archived = documents.filter((document) => document.reviewStatus === "archived").length;

  return `This analysis considered ${kept} kept documents, ${pending} pending documents (not yet reviewed), and excluded ${archived} archived documents. Pending documents are flagged inline; revisit this analysis after final review if the count is significant.`;
}

export function buildChatCitations(
  docIds: string[],
  documents: ClientDocument[],
): ChatMessageCitation[] {
  const lookup = new Map(documents.map((document) => [document.id, document]));

  return [...new Set(docIds)]
    .map((docId) => {
      const document = lookup.get(docId);

      if (!document) {
        return null;
      }

      return {
        docId,
        label: document.summary?.title || document.fileName,
      } satisfies ChatMessageCitation;
    })
    .filter((citation): citation is ChatMessageCitation => Boolean(citation));
}

export function normalizeTriageAnswer(
  answer: TriageAnswer,
  documents: ClientDocument[],
) {
  const allowedDocIds = new Set(documents.map((document) => document.id));

  return {
    ...answer,
    answer: answer.answer
      .map((block) => ({
        ...block,
        docIds: block.docIds.filter((docId) => allowedDocIds.has(docId)),
      }))
      .filter((block) => block.text.trim() && block.docIds.length > 0),
  };
}

export function normalizeStrategyMemo(
  memo: StrategyMemo,
  documents: ClientDocument[],
) {
  const allowedDocIds = new Set(documents.map((document) => document.id));
  const filterDocIds = (docIds: string[]) => docIds.filter((docId) => allowedDocIds.has(docId));
  const dedupeRecommendations = (
    entries: StrategyMemo["recommendedMix"]["primary"],
    excludeCodes = new Set<string>(),
  ) => {
    const seen = new Set<string>(excludeCodes);

    return entries.filter((entry) => {
      if (!entry.criterionCode || seen.has(entry.criterionCode)) {
        return false;
      }

      seen.add(entry.criterionCode);
      return true;
    });
  };

  const primary = dedupeRecommendations(
    memo.recommendedMix.primary
      .map((entry) => ({
        ...entry,
        anchorDocIds: filterDocIds(entry.anchorDocIds),
      }))
      .filter((entry) => entry.anchorDocIds.length > 0),
  );
  const supporting = dedupeRecommendations(
    memo.recommendedMix.supporting
      .map((entry) => ({
        ...entry,
        anchorDocIds: filterDocIds(entry.anchorDocIds),
      }))
      .filter((entry) => entry.anchorDocIds.length > 0),
    new Set(primary.map((entry) => entry.criterionCode)),
  );

  return {
    ...memo,
    recommendedMix: {
      primary,
      supporting,
      decline: memo.recommendedMix.decline,
    },
    leadArgument: {
      ...memo.leadArgument,
      anchorDocIds: filterDocIds(memo.leadArgument.anchorDocIds),
    },
    risks: memo.risks.map((risk) => ({
      ...risk,
      affectedDocIds: filterDocIds(risk.affectedDocIds),
    })),
    citations: memo.citations.filter((citation) => allowedDocIds.has(citation.docId)),
  };
}

export function normalizeStressTestReport(
  report: StressTestReport,
  documents: ClientDocument[],
) {
  const allowedDocIds = new Set(documents.map((document) => document.id));

  return {
    ...report,
    challenges: report.challenges
      .map((challenge) => ({
        ...challenge,
        atRiskDocIds: challenge.atRiskDocIds.filter((docId) => allowedDocIds.has(docId)),
      }))
      .filter((challenge) => challenge.atRiskDocIds.length > 0),
  };
}

export function normalizeBriefDraft(
  draft: BriefDraft,
  documents: ClientDocument[],
) {
  const allowedDocIds = new Set(documents.map((document) => document.id));

  return {
    ...draft,
    paragraphs: draft.paragraphs
      .map((paragraph) => ({
        ...paragraph,
        citations: paragraph.citations.filter((citation) => allowedDocIds.has(citation.docId)),
      }))
      .filter((paragraph) => paragraph.citations.length > 0 && paragraph.exhibitRefs.length > 0),
  };
}
