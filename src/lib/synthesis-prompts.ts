import { fillPromptTemplate } from "@/lib/prompt-library";
import type {
  LockedCaseStrategy,
  StyleExemplar,
  SynthesisSectionKind,
} from "@/lib/types";

export const synthesisDraftJsonSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "string" },
    clientId: { type: "string" },
    createdAt: { type: "string" },
    section: {
      type: "string",
      enum: ["statement-of-eligibility", "final-merits-determination"],
    },
    title: { type: "string" },
    paragraphs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          exhibitRefs: { type: "array", items: { type: "string" } },
          criterionRefs: { type: "array", items: { type: "string" } },
          citations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                docId: { type: "string" },
                supports: { type: "string" },
                criterionDraftId: { type: "string" },
                draftVersionParagraphId: { type: "string" },
                draftExcerpt: { type: "string" },
              },
            },
          },
        },
        required: ["text", "exhibitRefs", "criterionRefs", "citations"],
      },
    },
    wordCount: { type: "number" },
    styleProfileId: { type: "string" },
    styleExemplarIds: { type: "array", items: { type: "string" } },
  },
  required: ["section", "title", "paragraphs", "wordCount"],
};

function stylebookBlock(exemplars: StyleExemplar[], kind: SynthesisSectionKind) {
  if (!exemplars.length) {
    return `No synthesis exemplars are currently available for ${kind}. Stay declarative, evidence-led, and stylistically consistent with the approved criterion drafts.`;
  }

  return exemplars
    .map((exemplar, index) => {
      const label = exemplar.kind ? exemplar.kind : exemplar.criterionCode;
      return `Exemplar ${index + 1} (${label}) — ${exemplar.label}\n${exemplar.text}`;
    })
    .join("\n\n");
}

function approvedDraftsBlock(
  approvedDrafts: Array<{
    legalCode: string;
    criterionName: string;
    excerpt: string;
    fullText: string;
  }>,
  mode: "abbreviated" | "full",
) {
  return approvedDrafts
    .map((draft) => {
      const content = mode === "full" ? draft.fullText : draft.excerpt;
      return `${draft.legalCode} ${draft.criterionName}\n${content}`;
    })
    .join("\n\n");
}

export function renderStatementOfEligibilityPrompt(input: {
  template: string;
  candidateName: string;
  lockedStrategy: LockedCaseStrategy;
  approvedDrafts: Array<{
    legalCode: string;
    criterionName: string;
    excerpt: string;
    fullText: string;
  }>;
  styleExemplars: StyleExemplar[];
}) {
  return fillPromptTemplate(input.template, {
    candidateName: input.candidateName,
    lockedStrategyBlock: JSON.stringify(input.lockedStrategy),
    approvedDraftsBlock: approvedDraftsBlock(input.approvedDrafts, "abbreviated"),
    stylebookExemplars: stylebookBlock(
      input.styleExemplars,
      "statement-of-eligibility",
    ),
    synthesisSchema: JSON.stringify(synthesisDraftJsonSchema),
  });
}

export function renderFinalMeritsDeterminationPrompt(input: {
  template: string;
  candidateName: string;
  lockedStrategy: LockedCaseStrategy;
  approvedDrafts: Array<{
    legalCode: string;
    criterionName: string;
    excerpt: string;
    fullText: string;
  }>;
  styleExemplars: StyleExemplar[];
}) {
  return fillPromptTemplate(input.template, {
    candidateName: input.candidateName,
    lockedStrategyBlock: JSON.stringify(input.lockedStrategy),
    approvedDraftsBlock: approvedDraftsBlock(input.approvedDrafts, "full"),
    stylebookExemplars: stylebookBlock(
      input.styleExemplars,
      "final-merits-determination",
    ),
    synthesisSchema: JSON.stringify(synthesisDraftJsonSchema),
  });
}
