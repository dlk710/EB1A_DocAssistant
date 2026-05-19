import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { listCriterionDrafts } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }

  return Response.json({
    drafts: listCriterionDrafts(clientId),
    lockedStrategy: getLockedStrategy(clientId),
  });
}
