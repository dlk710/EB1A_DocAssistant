import { getDocument, setDocumentPayload } from "@/lib/qdrant";
import { upsertCriterionTag } from "@/lib/criterion-tags";
import { getCriterionDefinition } from "@/lib/constants";
import { getJob } from "@/lib/jobs";
import { appendClientTimelineEvent } from "@/lib/timeline";
import type { StoredDocument } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    documentIds?: string[];
    criterionCode?: string;
    state?: "suggested" | "enabled" | "disabled";
    role?: "primary" | "supporting";
  } | null;

  if (!payload?.documentIds?.length || !payload.criterionCode || !payload.state) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "bad_request",
          message: "documentIds, criterionCode, and state are required.",
        },
      },
      { status: 400 },
    );
  }

  const existingDocuments = await Promise.all(
    payload.documentIds.map((documentId) => getDocument(documentId)),
  );
  const documents = existingDocuments.filter(
    (document): document is StoredDocument => Boolean(document),
  );
  const now = new Date().toISOString();

  await Promise.all(
    documents.map(async (document) => {
      const next = upsertCriterionTag(document, payload.criterionCode!, {
        state: payload.state!,
        role: payload.role,
        origin: "attorney",
      });

      await setDocumentPayload(document.id, {
        criteriaTags: next.criteriaTags,
        disposition: next.disposition,
        reviewStatus: next.reviewStatus,
        reviewStatusSource: "manual",
        reviewStatusReason: null,
        updatedAt: now,
      });
    }),
  );

  const firstDocument = documents[0] ?? null;
  const job = firstDocument ? getJob(firstDocument.jobId) : null;
  const criterion = getCriterionDefinition(payload.criterionCode);

  if (firstDocument && job?.clientId) {
    appendClientTimelineEvent({
      id: `${firstDocument.jobId}:bulk-criterion:${criterion?.code ?? payload.criterionCode}:${payload.state}:${Date.now()}`,
      clientId: job.clientId,
      occurredAt: now,
      kind: "review-action-taken",
      workspaceId: firstDocument.jobId,
      summary: `Attorney bulk-set ${documents.length} evidence file(s) to ${criterion?.name ?? payload.criterionCode} ${payload.state}${payload.role ? ` ${payload.role}` : ""}.`,
      metadata: {
        actor: "attorney",
        action: "bulk-criterion-tag",
        documentIds: documents.map((document) => document.id),
        criterionCode: criterion?.code ?? payload.criterionCode,
        state: payload.state,
        role: payload.role ?? null,
        workspaceId: firstDocument.jobId,
      },
    });
  }

  return Response.json({ ok: true, updated: documents.length });
}
