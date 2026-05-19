import crypto from "node:crypto";
import { z } from "zod";
import { buildLibrarySnapshot } from "@/lib/library";
import { getOpenAiContext } from "@/lib/openai";
import { calculateTextModelCost } from "@/lib/openai-pricing";
import { getLockedStrategy } from "@/lib/lock";
import { listCriterionDrafts } from "@/lib/drafts";
import { renderFinalMeritsDeterminationPrompt, renderStatementOfEligibilityPrompt } from "@/lib/synthesis-prompts";
import { runGenericProseCheck } from "@/lib/draft-prose-check";
import { runSynthesisFactCheck } from "@/lib/draft-fact-check";
import { selectSynthesisExemplars } from "@/lib/style-profiles";
import type {
  ClientDocument,
  CriterionDraft,
  DraftParagraph,
  LibrarySnapshot,
  LockedCaseStrategy,
  SynthesisCitation,
  SynthesisParagraph,
  SynthesisSectionKind,
  SynthesisVersion,
} from "@/lib/types";

const synthesisCitationSchema = z.object({
  docId: z.string().min(1).optional(),
  supports: z.string().min(1).max(1000),
  criterionDraftId: z.string().min(1).optional(),
  draftVersionParagraphId: z.string().min(1).optional(),
  draftExcerpt: z.string().max(5000).optional(),
});

const synthesisParagraphSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(5000),
  exhibitRefs: z.array(z.string().min(1).max(80)).default([]),
  criterionRefs: z.array(z.string().min(1).max(80)).default([]),
  citations: z.array(synthesisCitationSchema).min(1),
});

const synthesisResponseSchema = z.object({
  section: z.enum(["statement-of-eligibility", "final-merits-determination"]),
  title: z.string().min(1).max(200),
  paragraphs: z.array(synthesisParagraphSchema).min(1).max(8),
  wordCount: z.number().int().min(1).max(2500).optional(),
});

interface ApprovedDraftContext {
  draftId: string;
  criterionCode: string;
  legalCode: string;
  criterionName: string;
  approvedVersion: number;
  excerpt: string;
  fullText: string;
  paragraphs: DraftParagraph[];
}

function parseOutputJson(outputText: string) {
  try {
    return JSON.parse(outputText) as Record<string, unknown>;
  } catch {
    throw new Error("Setu received a malformed model response and could not parse it.");
  }
}

function buildUsageCost(
  model: string,
  usage:
    | {
        input_tokens?: number | null;
        output_tokens?: number | null;
        input_tokens_details?: {
          cached_tokens?: number | null;
        } | null;
      }
    | null
    | undefined,
) {
  return (
    calculateTextModelCost({
      model,
      inputTokens: usage?.input_tokens ?? 0,
      cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
    }) ?? 0
  );
}

function candidateName(snapshot: LibrarySnapshot) {
  return snapshot.activeClient?.displayName || snapshot.settings.candidateName || "the client";
}

function latestApprovedDraftParagraphs(draft: CriterionDraft) {
  if (draft.latestApprovedVersion === null) {
    return [];
  }
  return draft.versions.find((version) => version.version === draft.latestApprovedVersion)?.paragraphs ?? [];
}

function draftText(paragraphs: DraftParagraph[]) {
  return paragraphs.map((paragraph) => paragraph.text.trim()).filter(Boolean).join("\n\n");
}

function firstSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const match = trimmed.match(/(.+?[.!?])(\s|$)/);
  return (match?.[1] || trimmed).trim();
}

function buildApprovedDraftContexts(clientId: string, lockedStrategy: LockedCaseStrategy) {
  const draftLookup = new Map(listCriterionDrafts(clientId).map((draft) => [draft.criterionCode, draft]));

  return [...lockedStrategy.primary, ...lockedStrategy.supporting]
    .map((entry) => {
      const draft = draftLookup.get(entry.criterionCode);
      if (!draft || draft.latestApprovedVersion == null) {
        return null;
      }
      const paragraphs = latestApprovedDraftParagraphs(draft);
      if (!paragraphs.length) {
        return null;
      }
      return {
        draftId: draft.id || `${clientId}:${entry.criterionCode}`,
        criterionCode: entry.criterionCode,
        legalCode: entry.legalCode,
        criterionName: entry.criterionName,
        approvedVersion: draft.latestApprovedVersion,
        excerpt: firstSentence(paragraphs[0]?.text || ""),
        fullText: draftText(paragraphs),
        paragraphs,
      } satisfies ApprovedDraftContext;
    })
    .filter((entry): entry is ApprovedDraftContext => Boolean(entry));
}

function buildDocumentLookup(documents: ClientDocument[]) {
  return new Map(documents.map((document) => [document.id, document]));
}

function normalizeCriterionRef(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^\(.+\)$/.test(trimmed)) {
    return trimmed;
  }
  return `(${trimmed})`;
}

function normalizeSynthesisParagraphs(input: {
  paragraphs: z.infer<typeof synthesisParagraphSchema>[];
  documentLookup: Map<string, ClientDocument>;
  approvedDrafts: ApprovedDraftContext[];
}) {
  const approvedDraftLookup = new Map(input.approvedDrafts.map((draft) => [draft.draftId, draft]));

  return input.paragraphs.map((paragraph) => {
    const normalizedCitations: SynthesisCitation[] = paragraph.citations.map((citation) => {
      if (citation.docId) {
        const document = input.documentLookup.get(citation.docId);
        return {
          docId: citation.docId,
          workspaceId: document?.jobId ?? "",
          excerpt:
            document?.metadata?.preview ||
            document?.summary?.shortSummary ||
            document?.summary?.detailedSummary ||
            document?.fileName ||
            "",
          supports: citation.supports,
        };
      }

      const approvedDraft = citation.criterionDraftId
        ? approvedDraftLookup.get(citation.criterionDraftId)
        : undefined;
      const matchedParagraph = approvedDraft?.paragraphs.find(
        (candidate) => candidate.id === citation.draftVersionParagraphId,
      );
      return {
        criterionDraftId: citation.criterionDraftId || approvedDraft?.draftId,
        draftVersionParagraphId: citation.draftVersionParagraphId || matchedParagraph?.id,
        draftExcerpt: citation.draftExcerpt || matchedParagraph?.text || "",
        supports: citation.supports,
      };
    });

    return {
      id: paragraph.id || crypto.randomUUID(),
      text: paragraph.text.trim(),
      exhibitRefs: [...new Set(paragraph.exhibitRefs.map((reference) => reference.trim()).filter(Boolean))],
      criterionRefs: [...new Set(paragraph.criterionRefs.map(normalizeCriterionRef).filter(Boolean))],
      citations: normalizedCitations,
      factCheckStatus: "pending" as const,
      factCheckNotes: undefined,
    } satisfies SynthesisParagraph;
  });
}

function genericProseThreshold(kind: SynthesisSectionKind) {
  if (kind === "statement-of-eligibility") {
    return { shortParagraphThreshold: 2, overallThreshold: 5 };
  }
  return { shortParagraphThreshold: 2, overallThreshold: 6 };
}

function buildApprovedDraftLookup(clientId: string, approvedDrafts: ApprovedDraftContext[]) {
  return new Map<string, CriterionDraft>(
    approvedDrafts.map((draft) => [
      draft.draftId,
      {
        id: draft.draftId,
        clientId,
        criterionCode: draft.criterionCode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "approved",
        latestApprovedVersion: draft.approvedVersion,
        versions: [
          {
            version: draft.approvedVersion,
            createdAt: new Date().toISOString(),
            source: "manual",
            authorNotes: "",
            paragraphs: draft.paragraphs,
            wordCount: draft.paragraphs.reduce(
              (sum, paragraph) => sum + paragraph.text.trim().split(/\s+/).filter(Boolean).length,
              0,
            ),
            costUsd: 0,
          },
        ],
      },
    ]),
  );
}

function conservativeSynthesisParagraph(
  text: string,
  criterionRefs: string[],
  supportingDrafts: ApprovedDraftContext[],
) {
  const selectedDraft =
    supportingDrafts.find(
      (draft) =>
        criterionRefs.includes(draft.legalCode) || criterionRefs.includes(draft.criterionCode),
    ) ??
    supportingDrafts[0];
  const selectedParagraph = selectedDraft?.paragraphs[0];
  const citations: SynthesisCitation[] = selectedDraft
    ? [
        {
          criterionDraftId: selectedDraft.draftId,
          draftVersionParagraphId: selectedParagraph?.id,
          draftExcerpt: selectedParagraph?.text || "",
          supports: firstSentence(selectedParagraph?.text || text),
        },
      ]
    : [];

  return {
    id: crypto.randomUUID(),
    text,
    exhibitRefs: [],
    criterionRefs,
    citations,
    factCheckStatus: "pending" as const,
  } satisfies SynthesisParagraph;
}

function buildFallbackSynthesis(input: {
  clientId: string;
  kind: SynthesisSectionKind;
  candidateName: string;
  lockedStrategy: LockedCaseStrategy;
  approvedDrafts: ApprovedDraftContext[];
}) {
  const allEntries = [...input.lockedStrategy.primary, ...input.lockedStrategy.supporting];
  const criterionList = allEntries.map((entry) => `${entry.legalCode} ${entry.criterionName}`).join(", ");
  const criterionRefs = allEntries.map((entry) => entry.legalCode);

  if (input.kind === "statement-of-eligibility") {
    const leadCriterion = input.lockedStrategy.primary[0];
    const paragraphs = [
      conservativeSynthesisParagraph(
        `${input.candidateName} petitions for classification as an individual of extraordinary ability under 8 CFR §204.5(h)(3). The petition relies on the following claimed criteria: ${criterionList}. Taken together, these approved criterion sections show that the record satisfies the regulatory threshold of at least three criteria.`,
        criterionRefs,
        input.approvedDrafts,
      ),
      conservativeSynthesisParagraph(
        leadCriterion
          ? `The petition’s lead theory centers on ${leadCriterion.legalCode} ${leadCriterion.criterionName}. The locked strategy explains that ${input.lockedStrategy.narrativeSpine}. The sections that follow provide the detailed criterion-by-criterion support for that theory.`
          : `The petition’s lead theory follows the locked strategy narrative: ${input.lockedStrategy.narrativeSpine}. The sections that follow provide the detailed criterion-by-criterion support for that theory.`,
        leadCriterion ? [leadCriterion.legalCode] : criterionRefs,
        input.approvedDrafts,
      ),
    ];
    return {
      title: "Statement of Eligibility",
      paragraphs,
    };
  }

  const primary = input.lockedStrategy.primary.map((entry) => `${entry.legalCode} ${entry.criterionName}`).join(", ");
  const thresholdParagraph = conservativeSynthesisParagraph(
    `${input.candidateName} satisfies the regulatory threshold because the record establishes the following criteria under 8 CFR §204.5(h)(3): ${criterionList}. Those approved sections therefore meet Step One of the final merits analysis.`,
    criterionRefs,
    input.approvedDrafts,
  );
  const totalityParagraph = conservativeSynthesisParagraph(
    `At Step Two, the approved record reflects a consistent pattern across the claimed criteria: third-party recognition, identifiable impact, and responsibility for consequential work. Read together, the approved criterion sections show a case built on cumulative evidence rather than any single exhibit.`,
    criterionRefs,
    input.approvedDrafts,
  );
  const leadParagraph = conservativeSynthesisParagraph(
    primary
      ? `The strongest totality themes appear across ${primary}. These approved sections show that the petitioner’s work was important to the organizations involved, was recognized by independent parties, and was consequential enough to justify inclusion in the final merits analysis.`
      : `The approved criterion sections show that the petitioner’s work was important to the organizations involved, was recognized by independent parties, and was consequential enough to justify inclusion in the final merits analysis.`,
    input.lockedStrategy.primary.map((entry) => entry.legalCode),
    input.approvedDrafts,
  );
  return {
    title: "Final Merits Determination",
    paragraphs: [thresholdParagraph, totalityParagraph, leadParagraph],
  };
}

function buildReasoning(input: {
  kind: SynthesisSectionKind;
  profileName: string;
  approvedDraftCount: number;
  directExemplarWarning: boolean;
  attempt: number;
}) {
  const pieces = [
    `Read ${input.approvedDraftCount} approved criterion drafts for ${input.kind}.`,
    `Applied the ${input.profileName} style profile${input.attempt > 1 ? ` after ${input.attempt} synthesis attempts` : ""}.`,
  ];
  if (input.directExemplarWarning) {
    pieces.push("No direct synthesis exemplars were available for the active style profile, so Setu used criterion-level exemplars as fallback guidance.");
  }
  return pieces.join(" ");
}

export async function generateSynthesisVersion(input: {
  clientId: string;
  kind: SynthesisSectionKind;
  snapshot?: LibrarySnapshot;
  message?: string;
}) {
  const snapshot = input.snapshot ?? (await buildLibrarySnapshot({ clientId: input.clientId }));
  const lockedStrategy = getLockedStrategy(input.clientId);
  if (!lockedStrategy) {
    throw new Error("Synthesis is only available after the case theory is locked.");
  }

  const approvedDrafts = buildApprovedDraftContexts(input.clientId, lockedStrategy);
  const claimedCriteriaCount = [...lockedStrategy.primary, ...lockedStrategy.supporting].length;
  if (approvedDrafts.length < claimedCriteriaCount) {
    throw new Error("Every claimed criterion needs an approved draft before synthesis can begin.");
  }

  const documentLookup = buildDocumentLookup(snapshot.clientDocuments);
  const approvedDraftLookup = buildApprovedDraftLookup(input.clientId, approvedDrafts);
  const { profile, exemplars, hasDirectKindExemplars } = selectSynthesisExemplars(
    snapshot.settings.activeStyleProfileId,
    input.kind,
  );
  const { client, settings } = getOpenAiContext();
  let totalCostUsd = 0;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const prompt =
        input.kind === "statement-of-eligibility"
          ? renderStatementOfEligibilityPrompt({
              template: settings.statementOfEligibilityPrompt,
              candidateName: candidateName(snapshot),
              lockedStrategy,
              approvedDrafts,
              styleExemplars: exemplars,
            })
          : renderFinalMeritsDeterminationPrompt({
              template: settings.finalMeritsDeterminationPrompt,
              candidateName: candidateName(snapshot),
              lockedStrategy,
              approvedDrafts,
              styleExemplars: exemplars,
            });

      const retryInstruction =
        attempt === 1
          ? input.message ||
            `Generate the ${input.kind === "statement-of-eligibility" ? "Statement of Eligibility" : "Final Merits Determination"} for this client.`
          : `${input.message || "Regenerate the section."}\n\nRevision instruction: stay closer to the approved draft language, keep every paragraph tightly grounded in cited support, and avoid strengthening claims beyond the approved criterion drafts.`;

      const response = await client.responses.create({
        model: settings.summaryModel,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: prompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: retryInstruction }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "setu_synthesis_draft",
            strict: true,
            schema: {
              type: "object",
              properties: {
                section: { type: "string", enum: ["statement-of-eligibility", "final-merits-determination"] },
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
                          required: ["supports"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["text", "exhibitRefs", "criterionRefs", "citations"],
                    additionalProperties: false,
                  },
                },
                wordCount: { type: "number" },
              },
              required: ["section", "title", "paragraphs"],
              additionalProperties: false,
            },
          },
        },
      });

      const modelCostUsd = buildUsageCost(settings.summaryModel, response.usage);
      totalCostUsd += modelCostUsd;
      const parsed = synthesisResponseSchema.parse(parseOutputJson(response.output_text));
      const normalizedParagraphs = normalizeSynthesisParagraphs({
        paragraphs: parsed.paragraphs,
        documentLookup,
        approvedDrafts,
      });
      const factChecked = runSynthesisFactCheck(
        normalizedParagraphs,
        documentLookup,
        approvedDraftLookup,
      );
      const proseCheck = runGenericProseCheck(
        factChecked.paragraphs.map((paragraph) => ({ text: paragraph.text })),
        genericProseThreshold(input.kind),
      );

      if (factChecked.blockingCount > 0) {
        throw new Error("Setu detected significant factual drift in the generated synthesis section.");
      }

      const versionSeed: Omit<SynthesisVersion, "version" | "createdAt"> = {
        source: "ai",
        authorNotes: input.message || "",
        paragraphs: factChecked.paragraphs,
        wordCount:
          parsed.wordCount ||
          factChecked.paragraphs.reduce(
            (sum, paragraph) => sum + paragraph.text.trim().split(/\s+/).filter(Boolean).length,
            0,
          ),
        costUsd: modelCostUsd,
        referencedCriteria: [...new Set(factChecked.paragraphs.flatMap((paragraph) => paragraph.criterionRefs))],
        genericProseWarning: proseCheck.message,
        styleProfileId: profile.id,
        styleExemplarIds: exemplars.map((exemplar) => exemplar.id),
      };

      return {
        title: parsed.title,
        versionSeed,
        costUsd: totalCostUsd,
        reasoning: buildReasoning({
          kind: input.kind,
          profileName: profile.displayName,
          approvedDraftCount: approvedDrafts.length,
          directExemplarWarning: !hasDirectKindExemplars,
          attempt,
        }),
        exemplarWarning: hasDirectKindExemplars
          ? null
          : "No synthesis exemplars are present in the active style profile. Setu used criterion exemplars as fallback guidance.",
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to generate synthesis.");
      if (attempt < 3) {
        continue;
      }
    }
  }

  const fallback = buildFallbackSynthesis({
    clientId: input.clientId,
    kind: input.kind,
    candidateName: candidateName(snapshot),
    lockedStrategy,
    approvedDrafts,
  });
  const factCheckedFallback = runSynthesisFactCheck(
    fallback.paragraphs,
    documentLookup,
    approvedDraftLookup,
  );
  const proseCheckFallback = runGenericProseCheck(
    factCheckedFallback.paragraphs.map((paragraph) => ({ text: paragraph.text })),
    genericProseThreshold(input.kind),
  );

  return {
    title: fallback.title,
    versionSeed: {
      source: "ai",
      authorNotes: `${input.message || ""}\n\nFallback note: conservative synthesis generated after stricter attempts failed.${lastError ? ` ${lastError.message}` : ""}`.trim(),
      paragraphs: factCheckedFallback.paragraphs,
      wordCount: factCheckedFallback.paragraphs.reduce(
        (sum, paragraph) => sum + paragraph.text.trim().split(/\s+/).filter(Boolean).length,
        0,
      ),
      costUsd: totalCostUsd,
      referencedCriteria: [...new Set(factCheckedFallback.paragraphs.flatMap((paragraph) => paragraph.criterionRefs))],
      genericProseWarning: proseCheckFallback.message,
      styleProfileId: profile.id,
      styleExemplarIds: exemplars.map((exemplar) => exemplar.id),
    } satisfies Omit<SynthesisVersion, "version" | "createdAt">,
    costUsd: totalCostUsd,
    reasoning: `Setu generated a conservative synthesis fallback after stricter attempts failed${lastError ? ` (${lastError.message})` : ""}.`,
    exemplarWarning: hasDirectKindExemplars
      ? null
      : "No synthesis exemplars are present in the active style profile. Setu used criterion exemplars as fallback guidance.",
  };
}
