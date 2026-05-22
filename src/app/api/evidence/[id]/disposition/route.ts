import { getDocument, setDocumentPayload } from "@/lib/qdrant";
import { setDocumentDisposition } from "@/lib/criterion-tags";

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

  await setDocumentPayload(id, {
    criteriaTags: next.criteriaTags,
    disposition: next.disposition,
    reviewStatus: next.reviewStatus,
    reviewStatusSource: "manual",
    reviewStatusReason: null,
    updatedAt: new Date().toISOString(),
  });

  return Response.json({ ok: true, documentId: id, ...next });
}
