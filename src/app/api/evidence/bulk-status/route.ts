import { setDocumentsPayload } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    ids?: string[];
    status?: "kept" | "pending" | "archived";
  } | null;

  if (!payload?.ids?.length || !payload.status) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "ids and status are required." } }, { status: 400 });
  }

  await setDocumentsPayload(payload.ids, {
    reviewStatus: payload.status,
    reviewStatusSource: "manual",
    reviewStatusReason: null,
  });

  return Response.json({
    ok: true,
    data: {
      updated: payload.ids.length,
    },
  });
}
