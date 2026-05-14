import { createSubBundle } from "@/lib/review-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as {
    jobId?: string;
    name?: string;
    evidenceIds?: string[];
  } | null;

  if (!payload?.jobId || !payload.name?.trim()) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "jobId and name are required." } }, { status: 400 });
  }

  const subBundle = createSubBundle({
    jobId: payload.jobId,
    parentBundleId: id,
    name: payload.name,
    evidenceDocumentIds: payload.evidenceIds ?? [],
  });

  return Response.json({ ok: true, data: subBundle });
}
