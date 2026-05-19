import { z } from "zod";
import { createStyleProfile, listStyleProfiles } from "@/lib/style-profiles";

const createProfileSchema = z.object({
  displayName: z.string().min(1).max(160),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    profiles: listStyleProfiles(),
  });
}

export async function POST(request: Request) {
  const parsed = createProfileSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid style profile payload." }, { status: 400 });
  }
  return Response.json({
    profile: createStyleProfile(parsed.data),
    profiles: listStyleProfiles(),
  });
}
