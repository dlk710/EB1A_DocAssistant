import { buildLibrarySnapshot } from "@/lib/library";
import { getChatReadiness } from "@/lib/chat-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const snapshot = await buildLibrarySnapshot({ jobId });
  const readiness = getChatReadiness(snapshot);

  return Response.json(readiness);
}
