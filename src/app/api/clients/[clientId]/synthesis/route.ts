import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { getLockedStrategy } from "@/lib/lock";
import { listSynthesisDrafts } from "@/lib/synthesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }

  return Response.json({
    drafts: listSynthesisDrafts(clientId),
    lockedStrategy: getLockedStrategy(clientId),
  });
}
