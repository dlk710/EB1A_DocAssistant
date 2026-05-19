import { z } from "zod";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";
import { generateClientStrategyMemo } from "@/lib/chat-service";
import { getLatestStrategyMemo } from "@/lib/chat-state";

const regenerateSchema = z.object({
  regenerate: z.boolean().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;

  if (!getClient(clientId)) {
    notFound();
  }

  const latest = getLatestStrategyMemo(clientId);

  return Response.json({
    memo: latest,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;

  if (!getClient(clientId)) {
    notFound();
  }

  const parsed = regenerateSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const snapshot = await buildLibrarySnapshot({ clientId });
    const result = await generateClientStrategyMemo(clientId, snapshot);

    return Response.json({
      memo: result.memo,
      citations: result.citations,
      droppedClaims: result.droppedClaims,
      reasoning: result.reasoning,
      pendingDisclosure: result.pendingDisclosure,
      costUsd: result.costUsd,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to build strategy memo." },
      { status: 500 },
    );
  }
}
