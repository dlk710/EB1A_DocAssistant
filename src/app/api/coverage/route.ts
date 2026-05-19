import { buildWorkspaceCoverage } from "@/lib/coverage";
import { buildLibrarySnapshot } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const workspaceId = params.get("workspaceId");
  const clientId = params.get("clientId");
  const snapshot = await buildLibrarySnapshot({
    jobId: workspaceId,
    clientId,
  });

  return Response.json({
    ok: true,
    data: clientId
      ? buildWorkspaceCoverage(snapshot.clientDocuments)
      : buildWorkspaceCoverage(snapshot.documents),
  });
}
