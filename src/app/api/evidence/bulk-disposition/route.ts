import { getDocument, setDocumentPayload } from "@/lib/qdrant";
import { setDocumentDisposition } from "@/lib/criterion-tags";
import type { StoredDocument } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    documentIds?: string[];
    disposition?: "untouched" | "tagged" | "reference" | "archived";
  } | null;

  if (!payload?.documentIds?.length || !payload.disposition) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "bad_request",
          message: "documentIds and disposition are required.",
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

  await Promise.all(
    documents.map(async (document) => {
      const next = setDocumentDisposition(document, payload.disposition!);

      await setDocumentPayload(document.id, {
        criteriaTags: next.criteriaTags,
        disposition: next.disposition,
        reviewStatus: next.reviewStatus,
        reviewStatusSource: "manual",
        reviewStatusReason: null,
        updatedAt: new Date().toISOString(),
      });
    }),
  );

  return Response.json({ ok: true, updated: documents.length });
}
