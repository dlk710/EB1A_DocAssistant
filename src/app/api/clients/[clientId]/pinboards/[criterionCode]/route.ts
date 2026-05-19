import { z } from "zod";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";
import { getCriterionPinboard, upsertCriterionPinboard } from "@/lib/pinboards";

const updatePinboardSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    documentId: z.string().min(1),
  }),
  z.object({
    action: z.literal("reorder"),
    documentIds: z.array(z.string().min(1)).min(1),
  }),
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ clientId: string; criterionCode: string }> },
) {
  const { clientId, criterionCode } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  return Response.json({
    pinboard: getCriterionPinboard(clientId, criterionCode),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string; criterionCode: string }> },
) {
  const { clientId, criterionCode } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }
  const parsed = updatePinboardSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid pinboard payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const current = getCriterionPinboard(clientId, criterionCode);
  if (payload.action === "add") {
    const snapshot = await buildLibrarySnapshot({ clientId });
    const document = snapshot.clientDocuments.find((entry) => entry.id === payload.documentId);
    if (!document) {
      return Response.json({ error: "Document not found in this client." }, { status: 404 });
    }
    const nextEntries = [
      ...(current?.entries ?? []),
      {
        documentId: document.id,
        workspaceId: document.jobId,
        exhibitLabel: `Pinned ${((current?.entries ?? []).length + 1).toString().padStart(2, "0")}`,
        addedAt: new Date().toISOString(),
      },
    ];
    return Response.json({
      pinboard: upsertCriterionPinboard({
        clientId,
        criterionCode,
        entries: nextEntries,
      }),
    });
  }

  const lookup = new Map((current?.entries ?? []).map((entry) => [entry.documentId, entry]));
  const nextEntries = payload.documentIds
    .map((documentId) => lookup.get(documentId) ?? null)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return Response.json({
    pinboard: upsertCriterionPinboard({
      clientId,
      criterionCode,
      entries: nextEntries,
    }),
  });
}
