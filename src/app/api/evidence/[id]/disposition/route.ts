import { getDocument, setDocumentPayload } from "@/lib/qdrant";
import { setDocumentDisposition } from "@/lib/criterion-tags";
import { getJob } from "@/lib/jobs";
import { appendClientTimelineEvent } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as {
    disposition?: "untouched" | "tagged" | "reference" | "archived";
  } | null;

  if (!payload?.disposition) {
    return Response.json(
      {
        ok: false,
        error: { code: "bad_request", message: "disposition is required." },
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

  const next = setDocumentDisposition(document, payload.disposition);
  const now = new Date().toISOString();

  await setDocumentPayload(id, {
    criteriaTags: next.criteriaTags,
    disposition: next.disposition,
    reviewStatus: next.reviewStatus,
    reviewStatusSource: "manual",
    reviewStatusReason: null,
    updatedAt: now,
  });

  const job = getJob(document.jobId);

  if (job?.clientId) {
    appendClientTimelineEvent({
      id: `${document.id}:disposition:${payload.disposition}:${Date.now()}`,
      clientId: job.clientId,
      occurredAt: now,
      kind: "review-action-taken",
      workspaceId: document.jobId,
      summary: `Attorney marked '${document.summary?.title || document.fileName}' as ${payload.disposition}.`,
      metadata: {
        actor: "attorney",
        action: "disposition",
        documentId: document.id,
        disposition: payload.disposition,
        workspaceId: document.jobId,
      },
    });
  }

  return Response.json({ ok: true, documentId: id, ...next });
}
