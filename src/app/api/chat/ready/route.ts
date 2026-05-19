import { buildLibrarySnapshot } from "@/lib/library";
import { getChatReadiness } from "@/lib/chat-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");

  if (!clientId) {
    return Response.json({ ready: false, reason: "clientId is required." }, { status: 400 });
  }

  const snapshot = await buildLibrarySnapshot({ clientId });
  const readiness = getChatReadiness(snapshot);

  return Response.json(readiness);
}
