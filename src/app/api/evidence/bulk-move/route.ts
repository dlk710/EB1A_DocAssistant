import { buildLibrarySnapshot } from "@/lib/library";
import { getWorkspaceReviewState, removeDocumentFromSubBundles, saveWorkspaceReviewState } from "@/lib/review-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    jobId?: string;
    ids?: string[];
    targetBundleId?: string;
    targetSubBundleId?: string | null;
  } | null;

  if (!payload?.jobId || !payload.ids?.length || !payload.targetBundleId) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "jobId, ids, and targetBundleId are required." } }, { status: 400 });
  }

  const documentIds = payload.ids;

  for (const documentId of documentIds) {
    await fetch(new URL(`/api/evidence/${documentId}/move`, request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: payload.jobId,
        targetBundleId: payload.targetBundleId,
      }),
    });
  }

  removeDocumentFromSubBundles(payload.jobId, documentIds);

  if (payload.targetSubBundleId) {
    const reviewState = getWorkspaceReviewState(payload.jobId);
    saveWorkspaceReviewState(payload.jobId, {
      ...reviewState,
      updatedAt: new Date().toISOString(),
      subBundles: reviewState.subBundles.map((subBundle) =>
        subBundle.id === payload.targetSubBundleId
          ? {
              ...subBundle,
              evidenceDocumentIds: [
                ...new Set([...subBundle.evidenceDocumentIds, ...documentIds]),
              ],
              updatedAt: new Date().toISOString(),
            }
          : subBundle,
      ),
    });
  }

  return Response.json(await buildLibrarySnapshot({ jobId: payload.jobId }));
}
