import { z } from "zod";
import { notFound } from "next/navigation";
import { countApproved } from "@/lib/approval";
import { getClient, getDraftLifecycleStatus, updateClient } from "@/lib/clients";
import { approveDraftVersion, getCriterionDraft } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";

const approveDraftSchema = z.object({
  version: z.number().int().min(1),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string; criterionCode: string }> },
) {
  const { clientId, criterionCode } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const parsed = approveDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid approval payload." }, { status: 400 });
  }

  const draft = approveDraftVersion(clientId, criterionCode, parsed.data.version);
  if (!draft) {
    return Response.json({ error: "Draft not found." }, { status: 404 });
  }

  const lockedStrategy = getLockedStrategy(clientId);
  const claimedCriteria = [...(lockedStrategy?.primary ?? []), ...(lockedStrategy?.supporting ?? [])].map(
    (entry) => entry.criterionCode,
  );
  const approvedCriteriaCount = countApproved(
    claimedCriteria.map((code) => getCriterionDraft(clientId, code)),
  );

  const client = updateClient(clientId, {
    status: getDraftLifecycleStatus({
      locked: Boolean(lockedStrategy),
      claimedCriteriaCount: claimedCriteria.length,
      approvedCriteriaCount,
    }),
  });

  return Response.json({ draft, client });
}
