import { getStoredCriteriaTaggingState } from "@/lib/criteria-tagging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");

  if (!workspaceId) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "workspaceId is required." } }, { status: 400 });
  }

  const state = getStoredCriteriaTaggingState(workspaceId);

  return Response.json({ ok: true, data: state });
}
