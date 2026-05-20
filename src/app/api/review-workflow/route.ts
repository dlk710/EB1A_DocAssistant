import { listJobs } from "@/lib/jobs";
import {
  clearBundleCriterionDecision,
  clearDocumentBundleDecision,
  setBundleCriterionDecision,
  setDocumentBundleDecision,
} from "@/lib/review-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveJob(jobId: string) {
  return listJobs(200).find((job) => job.id === jobId) ?? null;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as
    | {
        jobId?: string;
        type?: "document-bundle" | "bundle-criterion";
        documentId?: string;
        bundleId?: string;
        status?: "accepted" | "other" | "clear";
        criterionCode?: string | null;
      }
    | null;

  if (!payload?.jobId || !payload.type || !payload.status) {
    return Response.json(
      { ok: false, error: { code: "bad_request", message: "jobId, type, and status are required." } },
      { status: 400 },
    );
  }

  const job = resolveJob(payload.jobId);

  if (!job) {
    return Response.json(
      { ok: false, error: { code: "not_found", message: "Workspace not found." } },
      { status: 404 },
    );
  }

  if (payload.type === "document-bundle") {
    if (!payload.documentId) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "documentId is required." } },
        { status: 400 },
      );
    }

    if (payload.status === "clear") {
      clearDocumentBundleDecision(payload.jobId, payload.documentId);
    } else {
      setDocumentBundleDecision(payload.jobId, payload.documentId, payload.status);
    }
  }

  if (payload.type === "bundle-criterion") {
    if (!payload.bundleId) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "bundleId is required." } },
        { status: 400 },
      );
    }

    if (payload.status === "clear") {
      clearBundleCriterionDecision(payload.jobId, payload.bundleId);
    } else {
      setBundleCriterionDecision(
        payload.jobId,
        payload.bundleId,
        payload.status,
        payload.criterionCode ?? null,
      );
    }
  }

  return Response.json({ ok: true });
}
