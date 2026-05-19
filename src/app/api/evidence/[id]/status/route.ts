import { getJob } from "@/lib/jobs";
import { getDocument, setDocumentPayload } from "@/lib/qdrant";
import { appendClientTimelineEvent } from "@/lib/timeline";
import type { EvidenceReviewStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as { status?: EvidenceReviewStatus } | null;

  if (!payload?.status) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "status is required." } }, { status: 400 });
  }

  const document = await getDocument(id);

  if (!document) {
    return Response.json({ ok: false, error: { code: "not_found", message: "Document not found." } }, { status: 404 });
  }

  await setDocumentPayload(id, {
    reviewStatus: payload.status,
    reviewStatusSource: "manual",
    reviewStatusReason: null,
  });

  const job = getJob(document.jobId);

  if (job?.clientId) {
    appendClientTimelineEvent({
      id: `${document.id}:review-action:${payload.status}:${Date.now()}`,
      clientId: job.clientId,
      occurredAt: new Date().toISOString(),
      kind: "review-action-taken",
      workspaceId: document.jobId,
      summary: `Marked '${document.summary?.title || document.fileName}' as ${payload.status}.`,
      metadata: {
        documentId: document.id,
        reviewStatus: payload.status,
        workspaceId: document.jobId,
      },
    });
  }

  return Response.json({ ok: true });
}
