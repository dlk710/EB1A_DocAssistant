import { getDocument, setDocumentPayload } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as {
    notes?: string;
    isPinned?: boolean;
  } | null;

  const document = await getDocument(id);

  if (!document) {
    return Response.json({ ok: false, error: { code: "not_found", message: "Document not found." } }, { status: 404 });
  }

  await setDocumentPayload(id, {
    ...(payload?.notes !== undefined ? { notes: payload.notes } : {}),
    ...(payload?.isPinned !== undefined ? { isPinned: payload.isPinned } : {}),
  });

  return Response.json({ ok: true });
}
