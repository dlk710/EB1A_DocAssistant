import { z } from "zod";
import { deleteStyleProfile, getStyleProfile, listStyleProfiles, updateStyleProfile } from "@/lib/style-profiles";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(160),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const profile = getStyleProfile(id);
  if (!profile) {
    return Response.json({ error: "Style profile not found." }, { status: 404 });
  }
  return Response.json({ profile });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = updateProfileSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid style profile payload." }, { status: 400 });
  }
  const profile = updateStyleProfile(id, parsed.data);
  if (!profile) {
    return Response.json({ error: "Style profile not found." }, { status: 404 });
  }
  return Response.json({ profile, profiles: listStyleProfiles() });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deleted = deleteStyleProfile(id);
  if (!deleted) {
    return Response.json({ error: "Default profile cannot be deleted." }, { status: 400 });
  }
  return Response.json({ ok: true, profiles: listStyleProfiles() });
}
