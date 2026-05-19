import crypto from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getClient, getSynthesisLifecycleStatus, updateClient } from "@/lib/clients";
import { listCriterionDrafts } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";
import { buildLibrarySnapshot } from "@/lib/library";
import { generateSynthesisVersion } from "@/lib/synthesis-service";
import {
  ensureSynthesisDraft,
  getSynthesisDraft,
  saveSynthesisVersion,
} from "@/lib/synthesis";
import type { SynthesisDraft } from "@/lib/types";

const synthesisKindSchema = z.enum(["statement-of-eligibility", "final-merits-determination"]);

const generateSchema = z.object({
  authorNotes: z.string().max(4000).optional(),
  message: z.string().max(4000).optional(),
});

const saveSchema = z.object({
  versionNumber: z.number().int().min(1).optional(),
  paragraphs: z.array(
    z.object({
      id: z.string().optional(),
      text: z.string().min(1).max(5000),
      exhibitRefs: z.array(z.string().min(1).max(80)).default([]),
      criterionRefs: z.array(z.string().min(1).max(80)).default([]),
      citations: z.array(
        z.object({
          docId: z.string().min(1).optional(),
          workspaceId: z.string().min(1).optional(),
          excerpt: z.string().max(5000).optional(),
          criterionDraftId: z.string().min(1).optional(),
          draftVersionParagraphId: z.string().min(1).optional(),
          draftExcerpt: z.string().max(5000).optional(),
          supports: z.string().min(1).max(1000),
        }),
      ).min(1),
      factCheckStatus: z.enum(["verified", "drift-detected", "uncited", "pending"]).optional(),
      factCheckNotes: z.string().max(1000).optional(),
    }),
  ).min(1),
  authorNotes: z.string().max(4000).optional(),
  source: z.enum(["manual", "ai-edited"]).optional(),
  createNewVersion: z.boolean().optional(),
  genericProseWarning: z.string().nullable().optional(),
  styleProfileId: z.string().nullable().optional(),
  styleExemplarIds: z.array(z.string()).optional(),
});

function syncClientSynthesisStatus(clientId: string) {
  const lockedStrategy = getLockedStrategy(clientId);
  const claimedCriteria = [...(lockedStrategy?.primary ?? []), ...(lockedStrategy?.supporting ?? [])].map(
    (entry) => entry.criterionCode,
  );
  const approvedCriteriaCount = listCriterionDrafts(clientId, claimedCriteria).filter(
    (draft) => draft.latestApprovedVersion !== null,
  ).length;
  const approvedSynthesisCount = (
    [
      getSynthesisDraft(clientId, "statement-of-eligibility"),
      getSynthesisDraft(clientId, "final-merits-determination"),
    ] satisfies Array<SynthesisDraft | null>
  ).filter((draft) => draft?.latestApprovedVersion !== null).length;

  return updateClient(clientId, {
    status: getSynthesisLifecycleStatus({
      locked: Boolean(lockedStrategy),
      claimedCriteriaCount: claimedCriteria.length,
      approvedCriteriaCount,
      approvedSynthesisCount,
    }),
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string; kind: string }> },
) {
  const { clientId, kind } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const parsedKind = synthesisKindSchema.safeParse(kind);
  if (!parsedKind.success) {
    return Response.json({ error: "Invalid synthesis section." }, { status: 400 });
  }
  return Response.json({
    draft: ensureSynthesisDraft(clientId, parsedKind.data),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string; kind: string }> },
) {
  const { clientId, kind } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const parsedKind = synthesisKindSchema.safeParse(kind);
  if (!parsedKind.success) {
    return Response.json({ error: "Invalid synthesis section." }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid synthesis generation payload." }, { status: 400 });
  }

  try {
    const snapshot = await buildLibrarySnapshot({ clientId });
    const result = await generateSynthesisVersion({
      clientId,
      kind: parsedKind.data,
      snapshot,
      message: parsed.data.message,
    });
    const draft = saveSynthesisVersion({
      clientId,
      kind: parsedKind.data,
      paragraphs: result.versionSeed.paragraphs,
      authorNotes: parsed.data.authorNotes || result.versionSeed.authorNotes,
      source: "ai",
      costUsd: result.versionSeed.costUsd,
      genericProseWarning: result.versionSeed.genericProseWarning ?? null,
      styleProfileId: result.versionSeed.styleProfileId ?? null,
      styleExemplarIds: result.versionSeed.styleExemplarIds ?? [],
      createNewVersion: true,
    });
    const client = syncClientSynthesisStatus(clientId);
    return Response.json({
      draft,
      generatedVersion: result.versionSeed,
      title: result.title,
      reasoning: result.reasoning,
      exemplarWarning: result.exemplarWarning,
      costUsd: result.costUsd,
      client,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate the synthesis section.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string; kind: string }> },
) {
  const { clientId, kind } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const parsedKind = synthesisKindSchema.safeParse(kind);
  if (!parsedKind.success) {
    return Response.json({ error: "Invalid synthesis section." }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid synthesis save payload." }, { status: 400 });
  }
  const draft = saveSynthesisVersion({
    clientId,
    kind: parsedKind.data,
    versionNumber: parsed.data.versionNumber,
    paragraphs: parsed.data.paragraphs.map((paragraph) => ({
      ...paragraph,
      id: paragraph.id || crypto.randomUUID(),
      exhibitRefs: paragraph.exhibitRefs ?? [],
      criterionRefs: paragraph.criterionRefs ?? [],
      factCheckStatus: paragraph.factCheckStatus || "pending",
    })),
    authorNotes: parsed.data.authorNotes,
    source: parsed.data.source,
    createNewVersion: parsed.data.createNewVersion,
    genericProseWarning: parsed.data.genericProseWarning ?? null,
    styleProfileId: parsed.data.styleProfileId ?? null,
    styleExemplarIds: parsed.data.styleExemplarIds ?? [],
  });
  const client = syncClientSynthesisStatus(clientId);
  return Response.json({ draft, client });
}
