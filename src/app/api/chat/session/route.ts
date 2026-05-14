import { z } from "zod";
import { createChatSession, getChatSession, listChatSessions } from "@/lib/chat-state";
import { buildLibrarySnapshot } from "@/lib/library";
import { getChatReadiness } from "@/lib/chat-readiness";

const sessionInputSchema = z.object({
  jobId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = sessionInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid chat session payload." }, { status: 400 });
  }

  const snapshot = await buildLibrarySnapshot({ jobId: parsed.data.jobId });
  const readiness = getChatReadiness(snapshot);

  if (!readiness.ready) {
    return Response.json(
      {
        error: readiness.reason || "This workspace is not ready for Ask the Studio yet.",
      },
      { status: 409 },
    );
  }

  if (parsed.data.sessionId) {
    return Response.json({
      session: getChatSession(parsed.data.jobId, parsed.data.sessionId),
    });
  }

  const existingSession = listChatSessions(parsed.data.jobId)[0];

  return Response.json({
    session: existingSession ?? createChatSession(parsed.data.jobId),
  });
}
