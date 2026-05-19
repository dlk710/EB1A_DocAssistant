import { z } from "zod";
import { getPublicSettings } from "@/lib/settings";
import { getStyleProfile, listStyleProfiles, setActiveStyleProfile } from "@/lib/style-profiles";

const activeProfileSchema = z.object({
  profileId: z.string().min(1).max(160),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getPublicSettings();
  return Response.json({
    activeStyleProfileId: settings.activeStyleProfileId,
    profile: getStyleProfile(settings.activeStyleProfileId),
    profiles: listStyleProfiles(),
  });
}

export async function POST(request: Request) {
  const parsed = activeProfileSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid active style profile payload." }, { status: 400 });
  }
  const profile = setActiveStyleProfile(parsed.data.profileId);
  if (!profile) {
    return Response.json({ error: "Style profile not found." }, { status: 404 });
  }
  return Response.json({
    activeStyleProfileId: profile.id,
    profile,
    profiles: listStyleProfiles(),
  });
}
