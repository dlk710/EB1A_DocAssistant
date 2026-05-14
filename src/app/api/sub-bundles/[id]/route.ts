import {
  getWorkspaceReviewState,
  saveWorkspaceReviewState,
  updateSubBundle,
} from "@/lib/review-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as { jobId?: string; name?: string } | null;

  if (!payload?.jobId || !payload.name?.trim()) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "jobId and name are required." } }, { status: 400 });
  }

  const subBundle = updateSubBundle(payload.jobId, id, (current) => ({
    ...current,
    name: payload.name!.trim(),
    updatedAt: new Date().toISOString(),
  }));

  return Response.json({ ok: true, data: subBundle });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as {
    jobId?: string;
    moveChildrenTo?: "parent" | "archive";
  } | null;

  if (!payload?.jobId) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "jobId is required." } }, { status: 400 });
  }

  const reviewState = getWorkspaceReviewState(payload.jobId);
  const nextReviewState = {
    ...reviewState,
    updatedAt: new Date().toISOString(),
    subBundles: reviewState.subBundles.filter((subBundle) => subBundle.id !== id),
  };
  saveWorkspaceReviewState(payload.jobId, nextReviewState);

  void payload.moveChildrenTo;

  return Response.json({ ok: true, data: { ok: true } });
}
