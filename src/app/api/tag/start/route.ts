import { ensureWorkspaceCriteriaTagging, startWorkspaceCriteriaTaggingJob } from "@/lib/criteria-tagging";
import { ensureWorkspaceEb1aClassification } from "@/lib/eb1a-classification";
import { ensureWorkspaceEventBundles } from "@/lib/event-bundles";
import { listJobs } from "@/lib/jobs";
import { getJobDocuments } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as { workspaceId?: string } | null;
  const jobId = payload?.workspaceId;

  if (!jobId) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "workspaceId is required." } }, { status: 400 });
  }

  const job = listJobs(200).find((entry) => entry.id === jobId);

  if (!job) {
    return Response.json({ ok: false, error: { code: "not_found", message: "Workspace not found." } }, { status: 404 });
  }

  const documents = await getJobDocuments(job.id);
  const eventBundles = ensureWorkspaceEventBundles(job.id, documents);
  const classification = ensureWorkspaceEb1aClassification(
    job.id,
    job.candidateName,
    eventBundles,
    documents,
  );

  if (!eventBundles || eventBundles.status !== "completed" || !classification || classification.status !== "completed") {
    const state = ensureWorkspaceCriteriaTagging(
      job.id,
      job.candidateName,
      eventBundles,
      classification,
      documents,
    );
    return Response.json({ ok: true, data: state });
  }

  startWorkspaceCriteriaTaggingJob(
    job.id,
    job.candidateName,
    eventBundles,
    classification,
    documents,
  );

  return Response.json({
    ok: true,
    data: {
      jobId: job.id,
    },
  });
}
