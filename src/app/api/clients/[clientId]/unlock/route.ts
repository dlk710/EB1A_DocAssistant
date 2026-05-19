import { z } from "zod";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { getLockedStrategy, listCriterionDrafts, unlockClientStrategy } from "@/lib/lock";

const unlockInputSchema = z.object({
  confirmed: z.boolean(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;

  if (!getClient(clientId)) {
    notFound();
  }

  const parsed = unlockInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid unlock payload." }, { status: 400 });
  }

  if (!parsed.data.confirmed) {
    return Response.json(
      { error: "Confirmation is required before unlocking the case theory." },
      { status: 400 },
    );
  }

  const lockedStrategy = getLockedStrategy(clientId);

  if (!lockedStrategy) {
    return Response.json({ error: "This client is not locked." }, { status: 404 });
  }

  const affectedCodes = [...lockedStrategy.primary, ...lockedStrategy.supporting].map(
    (entry) => entry.criterionCode,
  );
  const invalidatedDrafts = listCriterionDrafts(clientId, affectedCodes).filter(
    (draft) => draft.status === "approved" || draft.versions.length > 0,
  );
  const result = unlockClientStrategy(clientId);

  return Response.json({
    unlocked: true,
    invalidatedDrafts: invalidatedDrafts.map((draft) => ({
      criterionCode: draft.criterionCode,
      outOfDate: true,
      status: draft.status,
    })),
    previousStrategy: result.lockedStrategy,
  });
}
