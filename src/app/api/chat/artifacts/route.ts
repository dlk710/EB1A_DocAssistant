import { z } from "zod";
import { createChatArtifact, getChatSession, listChatArtifacts } from "@/lib/chat-state";
import type { ChatArtifactRecord } from "@/lib/types";

const artifactQuerySchema = z.object({
  jobId: z.string().uuid(),
});

const artifactInputSchema = z.object({
  jobId: z.string().uuid(),
  sessionId: z.string().uuid(),
  turnId: z.string().uuid(),
  kind: z.enum(["strategy-memo", "stress-test", "brief-draft"]),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deriveArtifactRecord(turnPayload: NonNullable<ReturnType<typeof getChatSession>["turns"][number]["assistantPayload"]>, input: z.infer<typeof artifactInputSchema>) {
  if (input.kind === "strategy-memo" && turnPayload.strategyMemo) {
    return {
      title: `Strategy memo · ${turnPayload.strategyMemo.leadArgument.criterionCode}`,
      strategyMemo: turnPayload.strategyMemo,
    } satisfies Pick<ChatArtifactRecord, "title" | "strategyMemo">;
  }

  if (input.kind === "stress-test" && turnPayload.stressTestReport) {
    return {
      title: `Stress test ${turnPayload.stressTestReport.scope === "full-petition" ? "full petition" : turnPayload.stressTestReport.scope.criterionCode}`,
      stressTestReport: turnPayload.stressTestReport,
    } satisfies Pick<ChatArtifactRecord, "title" | "stressTestReport">;
  }

  if (input.kind === "brief-draft" && turnPayload.briefDraft) {
    return {
      title: turnPayload.briefDraft.title,
      briefDraft: turnPayload.briefDraft,
    } satisfies Pick<ChatArtifactRecord, "title" | "briefDraft">;
  }

  return null;
}

export async function GET(request: Request) {
  const parsed = artifactQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );

  if (!parsed.success) {
    return Response.json({ error: "jobId is required." }, { status: 400 });
  }

  return Response.json({
    artifacts: listChatArtifacts(parsed.data.jobId),
  });
}

export async function POST(request: Request) {
  const parsed = artifactInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid artifact payload." }, { status: 400 });
  }

  const session = getChatSession(parsed.data.jobId, parsed.data.sessionId);
  const turn = session.turns.find((entry) => entry.id === parsed.data.turnId);

  if (!turn || !turn.assistantPayload) {
    return Response.json({ error: "Chat turn was not found." }, { status: 404 });
  }

  const artifactPayload = deriveArtifactRecord(turn.assistantPayload, parsed.data);

  if (!artifactPayload) {
    return Response.json({ error: "That turn does not contain a pinnable artifact." }, { status: 400 });
  }

  const artifact = createChatArtifact({
    jobId: parsed.data.jobId,
    sessionId: parsed.data.sessionId,
    turnId: parsed.data.turnId,
    kind: parsed.data.kind,
    ...artifactPayload,
  });

  return Response.json({
    artifact,
    artifacts: listChatArtifacts(parsed.data.jobId),
  });
}
