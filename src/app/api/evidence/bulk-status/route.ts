import { getJob } from "@/lib/jobs";
import { getDocument, setDocumentsPayload } from "@/lib/qdrant";
import { appendClientTimelineEvent } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    ids?: string[];
    status?: "kept" | "pending" | "reference" | "archived";
  } | null;

  if (!payload?.ids?.length || !payload.status) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "ids and status are required." } }, { status: 400 });
  }

  await setDocumentsPayload(payload.ids, {
    reviewStatus: payload.status,
    reviewStatusSource: "manual",
    reviewStatusReason: null,
  });

  const firstDocument = await getDocument(payload.ids[0]);
  const job = firstDocument ? getJob(firstDocument.jobId) : null;

  if (firstDocument && job?.clientId) {
    appendClientTimelineEvent({
      id: `${firstDocument.jobId}:bulk-review-action:${payload.status}:${Date.now()}`,
      clientId: job.clientId,
      occurredAt: new Date().toISOString(),
      kind: "review-action-taken",
      workspaceId: firstDocument.jobId,
      summary: `Marked ${payload.ids.length} evidence file(s) as ${payload.status}.`,
      metadata: {
        documentIds: payload.ids,
        reviewStatus: payload.status,
        workspaceId: firstDocument.jobId,
      },
    });
  }

  return Response.json({
    ok: true,
    data: {
      updated: payload.ids.length,
    },
  });
}
