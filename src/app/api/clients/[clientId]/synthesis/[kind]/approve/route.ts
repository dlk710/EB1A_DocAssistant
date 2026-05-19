import { notFound } from "next/navigation";
import { z } from "zod";
import { getClient, getSynthesisLifecycleStatus, updateClient } from "@/lib/clients";
import { listCriterionDrafts } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";
import { approveSynthesisVersion, getSynthesisDraft } from "@/lib/synthesis";

const approveSchema = z.object({
  version: z.number().int().min(1),
});

const kindSchema = z.enum(["statement-of-eligibility", "final-merits-determination"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string; kind: string }> },
) {
  const { clientId, kind } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const parsedKind = kindSchema.safeParse(kind);
  if (!parsedKind.success) {
    return Response.json({ error: "Invalid synthesis section." }, { status: 400 });
  }
  const parsed = approveSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid approval payload." }, { status: 400 });
  }

  const draft = approveSynthesisVersion(clientId, parsedKind.data, parsed.data.version);
  if (!draft) {
    return Response.json({ error: "Synthesis draft not found." }, { status: 404 });
  }

  const lockedStrategy = getLockedStrategy(clientId);
  const claimedCriteria = [...(lockedStrategy?.primary ?? []), ...(lockedStrategy?.supporting ?? [])].map(
    (entry) => entry.criterionCode,
  );
  const approvedCriteriaCount = listCriterionDrafts(clientId, claimedCriteria).filter(
    (entry) => entry.latestApprovedVersion !== null,
  ).length;
  const approvedSynthesisCount = (
    [
      getSynthesisDraft(clientId, "statement-of-eligibility"),
      getSynthesisDraft(clientId, "final-merits-determination"),
    ] as const
  ).filter((entry) => entry?.latestApprovedVersion !== null).length;

  const client = updateClient(clientId, {
    status: getSynthesisLifecycleStatus({
      locked: Boolean(lockedStrategy),
      claimedCriteriaCount: claimedCriteria.length,
      approvedCriteriaCount,
      approvedSynthesisCount,
    }),
  });

  return Response.json({ draft, client });
}
