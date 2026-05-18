import { ensureWorkspaceEb1aClassification } from "@/lib/eb1a-classification";
import { ensureWorkspaceEventBundles } from "@/lib/event-bundles";
import { listJobs } from "@/lib/jobs";
import {
  getWorkspaceManualOverrideState,
  regenerateWorkspaceOverrideOutput,
  saveWorkspaceManualOverrideState,
} from "@/lib/manual-overrides";
import { getJobDocuments, setDocumentPayload } from "@/lib/qdrant";
import { getRuntimeSettings } from "@/lib/settings";
import { buildLibrarySnapshot } from "@/lib/library";
import { appendClientTimelineEvent } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveJob(jobId: string) {
  return listJobs(200).find((job) => job.id === jobId) ?? null;
}

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

export async function POST(request: Request) {
  const payload = (await request.json()) as
    | {
        jobId?: string;
        type?: "bundle-category" | "document-event" | "document-review";
        bundleId?: string;
        bucketCode?: string;
        documentId?: string;
        targetBundleId?: string;
        reviewDisposition?: "keep" | "archive" | "unwanted";
      }
    | null;

  if (!payload?.jobId || !payload.type) {
    return Response.json({ error: "jobId and type are required." }, { status: 400 });
  }

  const job = resolveJob(payload.jobId);

  if (!job) {
    return Response.json({ error: "Workspace not found." }, { status: 404 });
  }

  const settings = getRuntimeSettings();
  const documents = await getJobDocuments(job.id);
  const rawEventBundles = ensureWorkspaceEventBundles(job.id, documents);
  const rawClassification = ensureWorkspaceEb1aClassification(
    job.id,
    job.candidateName,
    rawEventBundles,
    documents,
  );
  const overrideState = getWorkspaceManualOverrideState(job.id, settings.outputRootPath);

  if (payload.type === "bundle-category") {
    if (!rawEventBundles || rawEventBundles.status !== "completed") {
      return Response.json(
        { error: "Event overrides are only available after bundling completes." },
        { status: 400 },
      );
    }

    if (!payload.bundleId || !payload.bucketCode) {
      return Response.json(
        { error: "bundleId and bucketCode are required for category overrides." },
        { status: 400 },
      );
    }

    if (!rawClassification || rawClassification.status !== "completed") {
      return Response.json(
        { error: "Category overrides are only available after classification completes." },
        { status: 400 },
      );
    }

    const baseDecision = rawClassification.decisions.find(
      (decision) => decision.bundleId === payload.bundleId,
    );

    if (!baseDecision) {
      return Response.json({ error: "Bundle classification not found." }, { status: 404 });
    }

    if (baseDecision.bucketCode === payload.bucketCode) {
      delete overrideState.categoryOverrides[payload.bundleId];
    } else {
      overrideState.categoryOverrides[payload.bundleId] = payload.bucketCode;
    }

    if (job.clientId) {
      appendClientTimelineEvent({
        id: `${payload.bundleId}:category-override:${Date.now()}`,
        clientId: job.clientId,
        occurredAt: new Date().toISOString(),
        kind: "manual-override",
        workspaceId: job.id,
        summary: `Manual bundle reassignment saved for '${baseDecision.suggestedExhibitTitle}'.`,
        metadata: {
          workspaceId: job.id,
          bundleId: payload.bundleId,
          bucketCode: payload.bucketCode,
          overrideType: payload.type,
        },
      });
    }
  }

  if (payload.type === "document-event") {
    if (!rawEventBundles || rawEventBundles.status !== "completed") {
      return Response.json(
        { error: "Event overrides are only available after bundling completes." },
        { status: 400 },
      );
    }

    if (!payload.documentId || !payload.targetBundleId) {
      return Response.json(
        { error: "documentId and targetBundleId are required for event overrides." },
        { status: 400 },
      );
    }

    const baseLookup = buildDocumentBundleLookup(rawEventBundles.bundles);
    const baseBundleId = baseLookup.get(payload.documentId);

    if (!baseBundleId) {
      return Response.json({ error: "Document is not attached to a bundle." }, { status: 404 });
    }

    const targetBundleExists = rawEventBundles.bundles.some(
      (bundle) => bundle.id === payload.targetBundleId,
    );

    if (!targetBundleExists) {
      return Response.json({ error: "Target bundle not found." }, { status: 404 });
    }

    if (baseBundleId === payload.targetBundleId) {
      delete overrideState.documentEventOverrides[payload.documentId];
    } else {
      overrideState.documentEventOverrides[payload.documentId] = payload.targetBundleId;
    }

    if (job.clientId) {
      appendClientTimelineEvent({
        id: `${payload.documentId}:event-override:${Date.now()}`,
        clientId: job.clientId,
        occurredAt: new Date().toISOString(),
        kind: "manual-override",
        workspaceId: job.id,
        summary: "Manual event reassignment saved for one evidence file.",
        metadata: {
          workspaceId: job.id,
          documentId: payload.documentId,
          targetBundleId: payload.targetBundleId,
          overrideType: payload.type,
        },
      });
    }
  }

  if (payload.type === "document-review") {
    if (!payload.documentId || !payload.reviewDisposition) {
      return Response.json(
        { error: "documentId and reviewDisposition are required for evidence review overrides." },
        { status: 400 },
      );
    }
    const documentExists = documents.some((document) => document.id === payload.documentId);

    if (!documentExists) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    if (payload.reviewDisposition === "keep") {
      delete overrideState.documentDispositionOverrides[payload.documentId];
    } else {
      overrideState.documentDispositionOverrides[payload.documentId] =
        payload.reviewDisposition;
    }

    await setDocumentPayload(payload.documentId, {
      reviewStatus: payload.reviewDisposition === "keep" ? "kept" : "archived",
      reviewStatusSource: "manual",
      reviewStatusReason:
        payload.reviewDisposition === "keep"
          ? "Human reviewer kept this evidence in the active petition drafting set."
          : payload.reviewDisposition === "archive"
            ? "Human reviewer archived this evidence for later review."
            : "Human reviewer removed this evidence from the active petition drafting set.",
    });

    if (job.clientId) {
      appendClientTimelineEvent({
        id: `${payload.documentId}:review-override:${Date.now()}`,
        clientId: job.clientId,
        occurredAt: new Date().toISOString(),
        kind: "manual-override",
        workspaceId: job.id,
        summary: `Manual review disposition saved as ${payload.reviewDisposition}.`,
        metadata: {
          workspaceId: job.id,
          documentId: payload.documentId,
          reviewDisposition: payload.reviewDisposition,
          overrideType: payload.type,
        },
      });
    }
  }

  const refreshedOverrideState = await regenerateWorkspaceOverrideOutput({
    jobId: job.id,
    folderLabel: job.folderLabel,
    candidateName: job.candidateName,
    documents,
    eventBundles: rawEventBundles,
    classification: rawClassification,
    overrideState: {
      ...overrideState,
      updatedAt: new Date().toISOString(),
      outputRootPath: settings.outputRootPath,
    },
  });

  saveWorkspaceManualOverrideState(job.id, refreshedOverrideState);

  return Response.json(await buildLibrarySnapshot({ jobId: job.id }));
}
