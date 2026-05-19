import { z } from "zod";
import { createChatSession, getChatSession, listChatSessions } from "@/lib/chat-state";
import { buildLibrarySnapshot } from "@/lib/library";
import { getChatReadiness } from "@/lib/chat-readiness";

const sessionQuerySchema = z.object({
  clientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsed = sessionQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );

  if (!parsed.success) {
    return Response.json({ error: "clientId is required." }, { status: 400 });
  }

  if (parsed.data.sessionId) {
    return Response.json({
      session: getChatSession(parsed.data.clientId, parsed.data.sessionId),
    });
  }

  return Response.json({
    sessions: listChatSessions(parsed.data.clientId),
  });
}

export async function POST(request: Request) {
  const parsed = sessionQuerySchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid chat session payload." }, { status: 400 });
  }

  const snapshot = await buildLibrarySnapshot({ clientId: parsed.data.clientId });
  const readiness = getChatReadiness(snapshot);

  if (!readiness.ready) {
    return Response.json(
      {
        error: readiness.reason || "This client is not ready for Ask Setu yet.",
      },
      { status: 409 },
    );
  }

  if (parsed.data.sessionId) {
    return Response.json({
      session: getChatSession(parsed.data.clientId, parsed.data.sessionId),
    });
  }

  const existingSession = listChatSessions(parsed.data.clientId)[0];

  return Response.json({
    session: existingSession ?? createChatSession(parsed.data.clientId),
  });
}
