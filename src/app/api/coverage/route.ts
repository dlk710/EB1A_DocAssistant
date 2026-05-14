import { buildWorkspaceCoverage } from "@/lib/coverage";
import { buildLibrarySnapshot } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  const snapshot = await buildLibrarySnapshot({ jobId: workspaceId });

  return Response.json({
    ok: true,
    data: buildWorkspaceCoverage(snapshot.documents),
  });
}
