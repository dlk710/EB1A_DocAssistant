import { getDocument, setDocumentPayload } from "@/lib/qdrant";
import { upsertCriterionTag } from "@/lib/criterion-tags";
import { getCriterionDefinition } from "@/lib/constants";
import { getJob } from "@/lib/jobs";
import { appendClientTimelineEvent } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; criterionCode: string }> },
) {
  const { id, criterionCode } = await context.params;
  const payload = (await request.json()) as {
    state?: "suggested" | "enabled" | "disabled";
    role?: "primary" | "supporting";
  } | null;

  if (!payload?.state) {
    return Response.json(
      { ok: false, error: { code: "bad_request", message: "state is required." } },
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

  const next = upsertCriterionTag(document, criterionCode, {
    state: payload.state,
    role: payload.role,
    origin: "attorney",
  });

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
  const criterion = getCriterionDefinition(criterionCode);

  if (job?.clientId) {
    appendClientTimelineEvent({
      id: `${document.id}:criterion:${criterion?.code ?? criterionCode}:${payload.state}:${Date.now()}`,
      clientId: job.clientId,
      occurredAt: now,
      kind: "review-action-taken",
      workspaceId: document.jobId,
      summary: `Attorney set '${document.summary?.title || document.fileName}' ${criterion?.name ?? criterionCode} tag to ${payload.state}${payload.role ? ` ${payload.role}` : ""}.`,
      metadata: {
        actor: "attorney",
        action: "criterion-tag",
        documentId: document.id,
        criterionCode: criterion?.code ?? criterionCode,
        state: payload.state,
        role: payload.role ?? null,
        workspaceId: document.jobId,
      },
    });
  }

  return Response.json({ ok: true, documentId: id, criterionCode, ...next });
}
