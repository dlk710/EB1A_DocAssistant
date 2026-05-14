import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import { getDocument, setDocumentPayload } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as { code?: string; role?: "primary" | "supporting" } | null;

  if (!payload?.code || !payload.role) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "code and role are required." } }, { status: 400 });
  }

  const document = await getDocument(id);

  if (!document) {
    return Response.json({ ok: false, error: { code: "not_found", message: "Document not found." } }, { status: 404 });
  }

  const definition = EB1A_CRITERIA_DEFINITIONS.find((criterion) => criterion.code === payload.code);

  if (!definition) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "Unknown criterion code." } }, { status: 400 });
  }

  const existing = document.criteriaTags.filter((criterion) => criterion.code !== payload.code);
  existing.push({
    code: definition.code,
    legalCode: definition.legalCode,
    name: definition.name,
    role: payload.role,
    source: "manual",
    confidence: 1,
    reasoning: "Added manually during evidence review.",
    taggedAt: new Date().toISOString(),
  });

  await setDocumentPayload(id, {
    criteriaTags: existing,
  });

  return Response.json({ ok: true });
}
