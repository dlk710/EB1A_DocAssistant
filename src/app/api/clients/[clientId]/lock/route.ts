import { z } from "zod";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { getLockedStrategy, lockClientStrategy } from "@/lib/lock";
import { buildLibrarySnapshot } from "@/lib/library";
import { getLatestStrategyMemo, listChatArtifacts } from "@/lib/chat-state";

const lockInputSchema = z.object({
  confirmed: z.boolean(),
  memoArtifactId: z.string().uuid().nullable().optional(),
  stressTestArtifactId: z.string().uuid().nullable().optional(),
  narrativeSpine: z.string().min(1).max(4000).optional(),
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

  return Response.json({
    lockedStrategy: getLockedStrategy(clientId),
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

  const parsed = lockInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid lock payload." }, { status: 400 });
  }

  if (!parsed.data.confirmed) {
    return Response.json(
      { error: "Confirmation is required before locking the case theory." },
      { status: 400 },
    );
  }

  const artifacts = listChatArtifacts(clientId);
  const pinnedMemoArtifact =
    (parsed.data.memoArtifactId
      ? artifacts.find((artifact) => artifact.id === parsed.data.memoArtifactId)
      : artifacts.find((artifact) => artifact.kind === "strategy-memo")) ?? null;
  const strategyMemo = pinnedMemoArtifact?.strategyMemo ?? getLatestStrategyMemo(clientId);

  if (!strategyMemo) {
    return Response.json(
      { error: "Generate a strategy memo before locking the case theory." },
      { status: 409 },
    );
  }

  const snapshot = await buildLibrarySnapshot({ clientId });
  const lockedStrategy = lockClientStrategy({
    clientId,
    memoArtifactId: pinnedMemoArtifact?.id ?? null,
    stressTestArtifactId: parsed.data.stressTestArtifactId ?? null,
    strategyMemo,
    clientDocuments: snapshot.clientDocuments,
    narrativeSpine: parsed.data.narrativeSpine?.trim() || strategyMemo.leadArgument.narrativeSpine,
  });

  return Response.json({
    lockedStrategy,
  });
}
