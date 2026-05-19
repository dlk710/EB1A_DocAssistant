import { z } from "zod";
import { appendChatTurn, createChatSession, getChatSession, listChatSessions } from "@/lib/chat-state";
import { runClientChatTurn } from "@/lib/chat-service";
import type { ChatTurn } from "@/lib/types";

const turnInputSchema = z.object({
  clientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  modeHint: z.enum(["triage", "strategy", "stress-test", "draft"]).optional(),
  criterionCode: z.string().min(1).max(8).optional(),
  synthesisKind: z
    .enum(["statement-of-eligibility", "final-merits-determination"])
    .optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = turnInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid chat turn payload." }, { status: 400 });
  }

  const existingSession = parsed.data.sessionId
    ? getChatSession(parsed.data.clientId, parsed.data.sessionId)
    : listChatSessions(parsed.data.clientId)[0] ??
      createChatSession(parsed.data.clientId, parsed.data.modeHint ?? "triage");

  try {
    const result = await runClientChatTurn({
      clientId: parsed.data.clientId,
      message: parsed.data.message,
      modeHint: parsed.data.modeHint,
      sessionMode: existingSession.mode,
      criterionCode: parsed.data.criterionCode,
      synthesisKind: parsed.data.synthesisKind,
    });

    const turn: ChatTurn = {
      ...result.turn,
      sessionId: existingSession.id,
    };
    const session = appendChatTurn(
      parsed.data.clientId,
      existingSession.id,
      turn,
      parsed.data.modeHint ?? existingSession.mode,
    );

    return Response.json({
      session,
      turn,
      classification: turn.classification,
      modeProposal:
        turn.classification &&
        turn.classification.mode !== (parsed.data.modeHint ?? existingSession.mode) &&
        turn.classification.confidence < 0.65
          ? {
              suggestedMode: turn.classification.mode,
              alternateMode: turn.classification.alternateMode,
              reasoning: turn.classification.reasoning,
            }
          : null,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to complete the chat turn.",
      },
      { status: 500 },
    );
  }
}
