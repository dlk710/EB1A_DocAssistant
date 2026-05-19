import { z } from "zod";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";
import { generateClientStressTest } from "@/lib/chat-service";
import { getLatestStressTestReport, getLatestStrategyMemo } from "@/lib/chat-state";

const stressTestSchema = z.object({
  adHocScope: z.string().max(160).optional(),
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
    report: getLatestStressTestReport(clientId),
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

  const parsed = stressTestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const snapshot = await buildLibrarySnapshot({ clientId });
    const result = await generateClientStressTest({
      clientId,
      snapshot,
      strategyMemo: getLatestStrategyMemo(clientId),
      adHocScope: parsed.data.adHocScope,
    });

    return Response.json({
      report: result.report,
      citations: result.citations,
      droppedClaims: result.droppedClaims,
      reasoning: result.reasoning,
      pendingDisclosure: result.pendingDisclosure,
      costUsd: result.costUsd,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to build stress-test report." },
      { status: 500 },
    );
  }
}
