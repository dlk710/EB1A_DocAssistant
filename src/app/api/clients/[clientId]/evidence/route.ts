import { queryClientEvidence } from "@/lib/evidence-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;
  const { searchParams } = new URL(request.url);
  const disposition = searchParams.get("disposition");
  const objectiveEvidence = searchParams.get("objectiveEvidence");

  const result = await queryClientEvidence(clientId, {
    workspaceId: searchParams.get("workspaceId"),
    bundleId: searchParams.get("bundleId"),
    criterionCode: searchParams.get("criterionCode"),
    state: searchParams.get("state"),
    disposition:
      disposition === "untouched" ||
      disposition === "tagged" ||
      disposition === "reference" ||
      disposition === "archived"
        ? disposition
        : null,
    objectiveEvidence:
      objectiveEvidence === "objective" ||
      objectiveEvidence === "subjective" ||
      objectiveEvidence === "mixed"
        ? objectiveEvidence
        : null,
    search: searchParams.get("search"),
    aiUnsure:
      searchParams.get("aiUnsure") === "1" || searchParams.get("aiUnsure") === "true",
  });

  return Response.json({ ok: true, ...result });
}
