import { ensureWorkspaceEb1aClassification } from "@/lib/eb1a-classification";
import { ensureWorkspaceEventBundles } from "@/lib/event-bundles";
import { listJobs } from "@/lib/jobs";
import {
  getWorkspaceManualOverrideState,
  regenerateWorkspaceOverrideOutput,
  saveWorkspaceManualOverrideState,
} from "@/lib/manual-overrides";
import { buildLibrarySnapshot } from "@/lib/library";
import { getJobDocuments } from "@/lib/qdrant";
import {
  clearBundleCriterionDecisions,
  clearDocumentBundleDecision,
  getWorkspaceReviewState,
  removeDocumentFromSubBundles,
  saveWorkspaceReviewState,
} from "@/lib/review-state";
import { getRuntimeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildDocumentBundleLookup(
  bundles: NonNullable<ReturnType<typeof ensureWorkspaceEventBundles>>["bundles"],
) {
  const lookup = new Map<string, string>();

  bundles.forEach((bundle) => {
    bundle.evidenceDocumentIds.forEach((documentId) => {
      lookup.set(documentId, bundle.id);
    });
  });

  return lookup;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = (await request.json()) as {
    jobId?: string;
    targetBundleId?: string;
    targetSubBundleId?: string | null;
  } | null;

  if (!payload?.jobId || !payload.targetBundleId) {
    return Response.json({ ok: false, error: { code: "bad_request", message: "jobId and targetBundleId are required." } }, { status: 400 });
  }

  const job = listJobs(200).find((entry) => entry.id === payload.jobId);

  if (!job) {
    return Response.json({ ok: false, error: { code: "not_found", message: "Workspace not found." } }, { status: 404 });
  }

  const settings = getRuntimeSettings();
  const documents = await getJobDocuments(job.id);
  const eventBundles = ensureWorkspaceEventBundles(job.id, documents);
  const classification = ensureWorkspaceEb1aClassification(
    job.id,
    job.candidateName,
    eventBundles,
    documents,
  );

  if (!eventBundles || eventBundles.status !== "completed") {
    return Response.json({ ok: false, error: { code: "not_ready", message: "Event overrides are only available after bundling completes." } }, { status: 400 });
  }

  const baseLookup = buildDocumentBundleLookup(eventBundles.bundles);
  const baseBundleId = baseLookup.get(id);

  if (!baseBundleId) {
    return Response.json({ ok: false, error: { code: "not_found", message: "Document is not attached to a bundle." } }, { status: 404 });
  }

  const overrideState = getWorkspaceManualOverrideState(job.id, settings.outputRootPath);

  if (baseBundleId === payload.targetBundleId) {
    delete overrideState.documentEventOverrides[id];
  } else {
    overrideState.documentEventOverrides[id] = payload.targetBundleId;
  }

  const refreshedOverrideState = await regenerateWorkspaceOverrideOutput({
    jobId: job.id,
    folderLabel: job.folderLabel,
    candidateName: job.candidateName,
    documents,
    eventBundles,
    classification,
    overrideState: {
      ...overrideState,
      updatedAt: new Date().toISOString(),
      outputRootPath: settings.outputRootPath,
    },
  });
  saveWorkspaceManualOverrideState(job.id, refreshedOverrideState);

  removeDocumentFromSubBundles(job.id, [id]);
  clearDocumentBundleDecision(job.id, id);
  clearBundleCriterionDecisions(job.id, [
    baseBundleId,
    payload.targetBundleId,
  ]);

  if (payload.targetSubBundleId) {
    const reviewState = getWorkspaceReviewState(job.id);
    const nextReviewState = {
      ...reviewState,
      updatedAt: new Date().toISOString(),
      subBundles: reviewState.subBundles.map((subBundle) =>
        subBundle.id === payload.targetSubBundleId
          ? {
              ...subBundle,
              evidenceDocumentIds: [...new Set([...subBundle.evidenceDocumentIds, id])],
              updatedAt: new Date().toISOString(),
            }
          : subBundle,
      ),
    };
    saveWorkspaceReviewState(job.id, nextReviewState);
  }

  return Response.json(await buildLibrarySnapshot({ jobId: job.id }));
}
