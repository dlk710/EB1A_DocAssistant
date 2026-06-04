import { buildLibrarySnapshot } from "@/lib/library";
import { getJob } from "@/lib/jobs";
import { appendClientTimelineEvent } from "@/lib/timeline";
import {
  clearBundleCriterionDecision,
  clearDocumentBundleDecisions,
  getWorkspaceReviewState,
  removeDocumentFromSubBundles,
  saveWorkspaceReviewState,
} from "@/lib/review-state";

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
        suppressTimeline: true,
      }),
    });
  }

  removeDocumentFromSubBundles(payload.jobId, documentIds);
  clearDocumentBundleDecisions(payload.jobId, documentIds);
  clearBundleCriterionDecision(payload.jobId, payload.targetBundleId);

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

  const job = getJob(payload.jobId);

  if (job?.clientId) {
    appendClientTimelineEvent({
      id: `${payload.jobId}:bulk-bundle-move:${payload.targetBundleId}:${Date.now()}`,
      clientId: job.clientId,
      occurredAt: new Date().toISOString(),
      kind: "manual-override",
      workspaceId: payload.jobId,
      summary: `Attorney moved ${documentIds.length} evidence file(s) to bundle '${payload.targetBundleId}'.`,
      metadata: {
        actor: "attorney",
        action: "bulk-bundle-move",
        documentIds,
        targetBundleId: payload.targetBundleId,
        workspaceId: payload.jobId,
      },
    });
  }

  return Response.json(await buildLibrarySnapshot({ jobId: payload.jobId }));
}
