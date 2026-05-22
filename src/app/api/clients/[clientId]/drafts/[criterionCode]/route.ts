import { z } from "zod";
import { notFound } from "next/navigation";
import crypto from "node:crypto";
import { generateClientBriefDraft } from "@/lib/chat-service";
import { countApproved } from "@/lib/approval";
import { getClient, getDraftLifecycleStatus, updateClient } from "@/lib/clients";
import {
  ensureCriterionDraft,
  getCriterionDraft,
  saveSubsectionVersion,
  updateCriterionDraftMeta,
} from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";
import { findSubsection } from "@/lib/subsection-drafts";

const generateDraftSchema = z.object({
  authorNotes: z.string().max(4000).optional(),
  message: z.string().max(4000).optional(),
  subsectionId: z.string().min(1).optional(),
  criterionKind: z.enum(["standard", "comparable-evidence"]).optional(),
  standardCriterionInvoked: z.string().max(20).optional(),
  comparableEvidenceRationale: z.string().max(4000).optional(),
});

const saveDraftSchema = z.object({
  versionNumber: z.number().int().min(1).optional(),
  subsectionId: z.string().min(1),
  paragraphs: z.array(
    z.object({
      id: z.string().optional(),
      text: z.string().max(3000),
      exhibitRefs: z.array(z.string().min(1).max(80)),
      citations: z.array(
        z.object({
          docId: z.string().min(1),
          workspaceId: z.string().min(1),
          excerpt: z.string().max(5000),
          supports: z.string().min(1).max(600),
          characterRange: z.tuple([z.number().int(), z.number().int()]).optional(),
        }),
      ),
      factCheckStatus: z.enum(["verified", "drift-detected", "uncited", "pending"]).optional(),
      factCheckNotes: z.string().max(1000).optional(),
    }),
  ),
  endorsementQuotes: z.array(
    z.object({
      id: z.string().optional(),
      expertName: z.string().min(1).max(200),
      expertTitleAtLetter: z.string().min(1).max(200),
      expertCurrentRole: z.string().max(200).nullable().optional(),
      expertAffiliation: z.string().min(1).max(200),
      sourceExhibitNumber: z.string().min(1).max(80),
      sourceDocId: z.string().min(1),
      quoteText: z.string().min(1).max(5000),
      anchoredToSubsectionId: z.string().min(1).optional(),
      supportsClaim: z.string().min(1).max(600),
      isIndependent: z.boolean().nullable().optional(),
    }),
  ).optional(),
  authorNotes: z.string().max(4000).optional(),
  source: z.enum(["manual", "ai-edited"]).optional(),
  createNewVersion: z.boolean().optional(),
  criterionKind: z.enum(["standard", "comparable-evidence"]).optional(),
  standardCriterionInvoked: z.string().max(20).optional(),
  comparableEvidenceRationale: z.string().max(4000).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function syncClientDraftStatus(clientId: string) {
  const lockedStrategy = getLockedStrategy(clientId);
  if (!lockedStrategy) {
    return null;
  }
  const claimedCriteria = [...lockedStrategy.primary, ...lockedStrategy.supporting].map(
    (entry) => entry.criterionCode,
  );
  const drafts = claimedCriteria
    .map((criterionCode) => getCriterionDraft(clientId, criterionCode))
    .filter(Boolean);
  const approvedCriteriaCount = countApproved(drafts);
  return updateClient(clientId, {
    status: getDraftLifecycleStatus({
      locked: true,
      claimedCriteriaCount: claimedCriteria.length,
      approvedCriteriaCount,
    }),
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ clientId: string; criterionCode: string }> },
) {
  const { clientId, criterionCode } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  return Response.json({
    draft: ensureCriterionDraft(clientId, criterionCode),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string; criterionCode: string }> },
) {
  const { clientId, criterionCode } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const parsed = generateDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid draft generation payload." }, { status: 400 });
  }

  try {
    const currentDraft = ensureCriterionDraft(clientId, criterionCode, {
      kind: parsed.data.criterionKind,
      standardCriterionInvoked: parsed.data.standardCriterionInvoked,
      comparableEvidenceRationale: parsed.data.comparableEvidenceRationale,
    });
    const subsectionId = parsed.data.subsectionId || currentDraft?.root.id;
    const subsection = subsectionId ? findSubsection(currentDraft!.root, subsectionId) : null;
    const result = await generateClientBriefDraft({
      clientId,
      criterionCode,
      message:
        parsed.data.message ||
        (subsection
          ? `Draft the subsection "${subsection.title}" and stay focused on this claim: ${subsection.supportsClaim || subsection.title}.`
          : undefined),
      criterionKind: parsed.data.criterionKind,
      standardCriterionInvoked: parsed.data.standardCriterionInvoked,
      comparableEvidenceRationale: parsed.data.comparableEvidenceRationale,
      focusedSubsectionTitle: subsection?.title,
      focusedSubsectionPath: subsection
        ? [subsection.parentId ? currentDraft?.root.title : null, subsection.title]
            .filter(Boolean)
            .join(" / ")
        : undefined,
      focusedSubsectionSupportsClaim: subsection?.supportsClaim,
    });
    const preparedDraft = parsed.data.criterionKind
      ? updateCriterionDraftMeta({
          clientId,
          criterionCode,
          kind: parsed.data.criterionKind,
          standardCriterionInvoked: parsed.data.standardCriterionInvoked,
          comparableEvidenceRationale: parsed.data.comparableEvidenceRationale,
        })
      : currentDraft;

    const refreshedSubsection =
      subsectionId && preparedDraft ? findSubsection(preparedDraft.root, subsectionId) : null;
    const draft = saveSubsectionVersion({
      clientId,
      criterionCode,
      subsectionId: refreshedSubsection?.id || subsection?.id || preparedDraft?.root.id || currentDraft!.root.id,
      paragraphs: result.draftVersionSeed.paragraphs,
      source: "ai",
      createNewVersion: true,
      authorNotes: parsed.data.authorNotes || result.draftVersionSeed.authorNotes,
      costUsd: result.draftVersionSeed.costUsd,
    });
    syncClientDraftStatus(clientId);
    return Response.json({
      draft,
      generatedDraft: result.draft,
      citations: result.citations,
      droppedClaims: result.droppedClaims,
      reasoning: result.reasoning,
      pendingDisclosure: result.pendingDisclosure,
      costUsd: result.costUsd,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate draft.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string; criterionCode: string }> },
) {
  const { clientId, criterionCode } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const parsed = saveDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid draft save payload." }, { status: 400 });
  }
  if (parsed.data.criterionKind) {
    updateCriterionDraftMeta({
      clientId,
      criterionCode,
      kind: parsed.data.criterionKind,
      standardCriterionInvoked: parsed.data.standardCriterionInvoked,
      comparableEvidenceRationale: parsed.data.comparableEvidenceRationale,
    });
  }
  const draft = saveSubsectionVersion({
    clientId,
    criterionCode,
    subsectionId: parsed.data.subsectionId,
    versionNumber: parsed.data.versionNumber,
    paragraphs: parsed.data.paragraphs.map((paragraph) => ({
      ...paragraph,
      id: paragraph.id || crypto.randomUUID(),
      factCheckStatus: paragraph.factCheckStatus || "pending",
    })),
    endorsementQuotes: parsed.data.endorsementQuotes?.map((quote) => ({
      ...quote,
      id: quote.id || crypto.randomUUID(),
      expertCurrentRole: quote.expertCurrentRole ?? null,
      anchoredToSubsectionId: quote.anchoredToSubsectionId || parsed.data.subsectionId,
      isIndependent:
        typeof quote.isIndependent === "boolean" ? quote.isIndependent : null,
    })),
    authorNotes: parsed.data.authorNotes,
    source: parsed.data.source,
    createNewVersion: parsed.data.createNewVersion,
  });
  syncClientDraftStatus(clientId);
  return Response.json({ draft });
}
