import { buildLibrarySnapshot } from "@/lib/library";
import { getJob, listJobs, requestJobCancellation } from "@/lib/jobs";
import { sanitizeDocument } from "@/lib/library";
import { getJobDocuments } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const job = getJob(params.id);

  if (!job) {
    return Response.json(
      {
        error: "Job not found.",
      },
      { status: 404 },
    );
  }

  return Response.json({
    job,
    jobs: listJobs(8),
    documents: (await getJobDocuments(params.id)).map(sanitizeDocument),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const job = getJob(params.id);

  if (!job) {
    return Response.json(
      {
        error: "Job not found.",
      },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (body.action !== "cancel") {
    return Response.json(
      {
        error: "Unsupported job action.",
      },
      { status: 400 },
    );
  }

  const snapshot = await buildLibrarySnapshot({ jobId: params.id });
  const hasAbortableWork =
    snapshot.activeJob?.status === "queued" ||
    snapshot.activeJob?.status === "processing" ||
    snapshot.activeJob?.status === "canceling" ||
    snapshot.eventBundles?.status === "queued" ||
    snapshot.eventBundles?.status === "processing" ||
    snapshot.eb1aClassification?.status === "queued" ||
    snapshot.eb1aClassification?.status === "processing";

  if (!hasAbortableWork) {
    return Response.json(
      {
        error: "There is no active process to cancel for this workspace.",
      },
      { status: 400 },
    );
  }

  requestJobCancellation(params.id);

  return Response.json(await buildLibrarySnapshot({ jobId: params.id }));
}
