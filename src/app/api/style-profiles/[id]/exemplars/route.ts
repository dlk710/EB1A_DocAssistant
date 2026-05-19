import { z } from "zod";
import { addStyleExemplar, getStyleProfile } from "@/lib/style-profiles";

const createExemplarSchema = z.object({
  label: z.string().min(1).max(200),
  criterionCode: z.string().min(1).max(8),
  text: z.string().min(50).max(12000),
  approvedOutcome: z.boolean(),
  notes: z.string().max(1000),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = createExemplarSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid exemplar payload." }, { status: 400 });
  }
  const exemplar = addStyleExemplar(id, parsed.data);
  if (!exemplar) {
    return Response.json({ error: "Unable to add exemplar to this style profile." }, { status: 400 });
  }
  return Response.json({
    exemplar,
    profile: getStyleProfile(id),
  });
}
