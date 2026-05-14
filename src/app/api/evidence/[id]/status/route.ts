import { getDocument, setDocumentPayload } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as { status?: "kept" | "pending" | "archived" } | null;

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

  return Response.json({ ok: true });
}
