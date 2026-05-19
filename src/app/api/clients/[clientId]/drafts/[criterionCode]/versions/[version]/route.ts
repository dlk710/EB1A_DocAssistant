import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { findDraftVersion, getCriterionDraft } from "@/lib/drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ clientId: string; criterionCode: string; version: string }> },
) {
  const { clientId, criterionCode, version } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const draft = getCriterionDraft(clientId, criterionCode);
  if (!draft) {
    return Response.json({ error: "Draft not found." }, { status: 404 });
  }
  const selectedVersion = findDraftVersion(draft, Number(version));
  if (!selectedVersion) {
    return Response.json({ error: "Draft version not found." }, { status: 404 });
  }
  return Response.json({
    draft,
    version: selectedVersion,
  });
}
