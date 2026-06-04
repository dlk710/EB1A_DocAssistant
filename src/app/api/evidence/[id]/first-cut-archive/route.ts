import { getJob } from "@/lib/jobs";
import { getDocument } from "@/lib/qdrant";
import { restoreFirstCutArchiveDocument } from "@/lib/review-state";
import { appendClientTimelineEvent } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as { action?: "restore" } | null;

  if (payload?.action !== "restore") {
    return Response.json(
      {
        ok: false,
        error: { code: "bad_request", message: "action must be restore." },
      },
      { status: 400 },
    );
  }

  const document = await getDocument(id);

  if (!document) {
    return Response.json(
      { ok: false, error: { code: "not_found", message: "Document not found." } },
      { status: 404 },
    );
  }

  restoreFirstCutArchiveDocument(document.jobId, document.id);

  const job = getJob(document.jobId);
  const now = new Date().toISOString();

  if (job?.clientId) {
    appendClientTimelineEvent({
      id: `${document.id}:first-cut-restore:${Date.now()}`,
      clientId: job.clientId,
      occurredAt: now,
      kind: "review-action-taken",
      workspaceId: document.jobId,
      summary: `Attorney restored '${document.summary?.title || document.fileName}' from first-cut archive to review.`,
      metadata: {
        actor: "attorney",
        action: "first-cut-archive-restore",
        documentId: document.id,
        workspaceId: document.jobId,
      },
    });
  }

  return Response.json({ ok: true, documentId: id, action: "restore" });
}
