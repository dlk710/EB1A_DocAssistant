import { z } from "zod";
import { notFound } from "next/navigation";
import crypto from "node:crypto";
import { generateClientBriefDraft } from "@/lib/chat-service";
import { countApproved } from "@/lib/approval";
import { getClient, getDraftLifecycleStatus, updateClient } from "@/lib/clients";
import { appendDraftVersion, ensureCriterionDraft, getCriterionDraft, saveDraftVersion } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";

const generateDraftSchema = z.object({
  authorNotes: z.string().max(4000).optional(),
  message: z.string().max(4000).optional(),
});

const saveDraftSchema = z.object({
  versionNumber: z.number().int().min(1).optional(),
  paragraphs: z.array(
    z.object({
      id: z.string().optional(),
      text: z.string().min(1).max(3000),
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
  ).min(1),
  authorNotes: z.string().max(4000).optional(),
  source: z.enum(["manual", "ai-edited"]).optional(),
  createNewVersion: z.boolean().optional(),
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
    const result = await generateClientBriefDraft({
      clientId,
      criterionCode,
      message: parsed.data.message,
    });
    const draft = appendDraftVersion(clientId, criterionCode, {
      ...result.draftVersionSeed,
      authorNotes: parsed.data.authorNotes || result.draftVersionSeed.authorNotes,
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
  const draft = saveDraftVersion({
    clientId,
    criterionCode,
    versionNumber: parsed.data.versionNumber,
    paragraphs: parsed.data.paragraphs.map((paragraph) => ({
      ...paragraph,
      id: paragraph.id || crypto.randomUUID(),
      factCheckStatus: paragraph.factCheckStatus || "pending",
    })),
    authorNotes: parsed.data.authorNotes,
    source: parsed.data.source,
    createNewVersion: parsed.data.createNewVersion,
  });
  syncClientDraftStatus(clientId);
  return Response.json({ draft });
}
