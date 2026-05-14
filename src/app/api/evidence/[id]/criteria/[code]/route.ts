import { getDocument, setDocumentPayload } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; code: string }> },
) {
  const { id, code } = await context.params;
  const payload = (await request.json()) as { role?: "primary" | "supporting" } | null;

  if (!payload?.role) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "role is required." } }, { status: 400 });
  }

  const document = await getDocument(id);

  if (!document) {
    return Response.json({ ok: false, error: { code: "not_found", message: "Document not found." } }, { status: 404 });
  }

  const nextCriteria = document.criteriaTags.map((criterion) =>
    criterion.code === code
      ? {
          ...criterion,
          role: payload.role,
          source: "manual" as const,
          taggedAt: new Date().toISOString(),
        }
      : criterion,
  );

  await setDocumentPayload(id, {
    criteriaTags: nextCriteria,
  });

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; code: string }> },
) {
  const { id, code } = await context.params;
  const document = await getDocument(id);

  if (!document) {
    return Response.json({ ok: false, error: { code: "not_found", message: "Document not found." } }, { status: 404 });
  }

  await setDocumentPayload(id, {
    criteriaTags: document.criteriaTags.filter((criterion) => criterion.code !== code),
  });

  return Response.json({ ok: true });
}
