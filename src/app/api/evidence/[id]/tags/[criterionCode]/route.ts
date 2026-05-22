import { getDocument, setDocumentPayload } from "@/lib/qdrant";
import { upsertCriterionTag } from "@/lib/criterion-tags";

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

  await setDocumentPayload(id, {
    criteriaTags: next.criteriaTags,
    disposition: next.disposition,
    reviewStatus: next.reviewStatus,
    reviewStatusSource: "manual",
    reviewStatusReason: null,
    updatedAt: new Date().toISOString(),
  });

  return Response.json({ ok: true, documentId: id, criterionCode, ...next });
}
