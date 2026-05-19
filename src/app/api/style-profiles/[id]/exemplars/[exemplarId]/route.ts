import { z } from "zod";
import { deleteStyleExemplar, getStyleProfile, updateStyleExemplar } from "@/lib/style-profiles";

const updateExemplarSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  criterionCode: z.string().min(1).max(8).optional(),
  text: z.string().min(50).max(12000).optional(),
  approvedOutcome: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; exemplarId: string }> },
) {
  const { id, exemplarId } = await context.params;
  const parsed = updateExemplarSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid exemplar payload." }, { status: 400 });
  }
  const exemplar = updateStyleExemplar(id, exemplarId, parsed.data);
  if (!exemplar) {
    return Response.json({ error: "Unable to update exemplar." }, { status: 400 });
  }
  return Response.json({
    exemplar,
    profile: getStyleProfile(id),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; exemplarId: string }> },
) {
  const { id, exemplarId } = await context.params;
  const profile = deleteStyleExemplar(id, exemplarId);
  if (!profile) {
    return Response.json({ error: "Unable to delete exemplar." }, { status: 400 });
  }
  return Response.json({ ok: true, profile });
}
