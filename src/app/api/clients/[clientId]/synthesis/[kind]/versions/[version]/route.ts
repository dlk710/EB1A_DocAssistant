import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { findSynthesisVersion, getSynthesisDraft } from "@/lib/synthesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string; kind: string; version: string }> },
) {
  const { clientId, kind, version } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  if (kind !== "statement-of-eligibility" && kind !== "final-merits-determination") {
    return Response.json({ error: "Invalid synthesis section." }, { status: 400 });
  }
  const draft = getSynthesisDraft(clientId, kind);
  if (!draft) {
    return Response.json({ error: "Synthesis draft not found." }, { status: 404 });
  }
  const selectedVersion = findSynthesisVersion(draft, Number(version));
  if (!selectedVersion) {
    return Response.json({ error: "Synthesis version not found." }, { status: 404 });
  }
  return Response.json({
    draft,
    version: selectedVersion,
  });
}
