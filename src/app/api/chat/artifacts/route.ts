import { z } from "zod";
import {
  createChatArtifact,
  getChatSession,
  getLatestStrategyMemo,
  getLatestStressTestReport,
  listChatArtifacts,
} from "@/lib/chat-state";
import type { ChatArtifactRecord } from "@/lib/types";

const artifactQuerySchema = z.object({
  clientId: z.string().uuid(),
});

const artifactInputSchema = z.object({
  clientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  turnId: z.string().uuid().optional(),
  kind: z.enum(["strategy-memo", "stress-test-report", "brief-draft"]),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deriveArtifactRecord(
  turn: ReturnType<typeof getChatSession>["turns"][number],
  input: z.infer<typeof artifactInputSchema>,
) {
  const artifact = turn.response.artifact;

  if (!artifact) {
    return null;
  }

  if (input.kind === "strategy-memo" && artifact.schemaVersion === "strategy-memo/2.0") {
    return {
      title: `Strategy memo · ${artifact.leadArgument.criterionCode}`,
      workspaceIds: artifact.workspaceIds,
      strategyMemo: artifact,
    } satisfies Pick<ChatArtifactRecord, "title" | "workspaceIds" | "strategyMemo">;
  }

  if (input.kind === "stress-test-report" && artifact.schemaVersion === "stress-test/2.0") {
    return {
      title:
        artifact.scope === "full-petition"
          ? "Stress-test · full petition"
          : `Stress-test · ${artifact.scope.criterionCode}`,
      workspaceIds: artifact.workspaceIds,
      stressTestReport: artifact,
    } satisfies Pick<ChatArtifactRecord, "title" | "workspaceIds" | "stressTestReport">;
  }

  if (input.kind === "brief-draft" && artifact.schemaVersion === "brief-draft/2.0") {
    return {
      title: artifact.title,
      workspaceIds: [],
      briefDraft: artifact,
    } satisfies Pick<ChatArtifactRecord, "title" | "workspaceIds" | "briefDraft">;
  }

  return null;
}

export async function GET(request: Request) {
  const parsed = artifactQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );

  if (!parsed.success) {
    return Response.json({ error: "clientId is required." }, { status: 400 });
  }

  return Response.json({
    artifacts: listChatArtifacts(parsed.data.clientId),
  });
}

export async function POST(request: Request) {
  const parsed = artifactInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid artifact payload." }, { status: 400 });
  }

  const session =
    parsed.data.sessionId && parsed.data.turnId
      ? getChatSession(parsed.data.clientId, parsed.data.sessionId)
      : null;
  const turn = session?.turns.find((entry) => entry.id === parsed.data.turnId) ?? null;
  const artifactPayload =
    turn && session
      ? deriveArtifactRecord(turn, parsed.data)
      : parsed.data.kind === "strategy-memo"
        ? (() => {
            const memo = getLatestStrategyMemo(parsed.data.clientId);
            return memo
              ? {
                  title: `Strategy memo · ${memo.leadArgument.criterionCode}`,
                  workspaceIds: memo.workspaceIds,
                  strategyMemo: memo,
                }
              : null;
          })()
        : parsed.data.kind === "stress-test-report"
          ? (() => {
              const report = getLatestStressTestReport(parsed.data.clientId);
              return report
                ? {
                    title:
                      report.scope === "full-petition"
                        ? "Stress-test · full petition"
                        : `Stress-test · ${report.scope.criterionCode}`,
                    workspaceIds: report.workspaceIds,
                    stressTestReport: report,
                  }
                : null;
            })()
          : null;

  if (!artifactPayload) {
    return Response.json(
      { error: "That turn does not contain a pinnable artifact." },
      { status: 400 },
    );
  }

  const artifact = createChatArtifact({
    clientId: parsed.data.clientId,
    sessionId: session?.id ?? "client-latest",
    turnId: turn?.id ?? "latest",
    kind: parsed.data.kind,
    ...artifactPayload,
  });

  return Response.json({
    artifact,
    artifacts: listChatArtifacts(parsed.data.clientId),
  });
}
