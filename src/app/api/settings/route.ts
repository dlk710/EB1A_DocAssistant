import { z } from "zod";
import { getPublicSettings, saveRuntimeSettings } from "@/lib/settings";

const settingsInputSchema = z.object({
  candidateName: z.string().max(160),
  summaryPrompt: z.string().min(1).max(12000),
  bundlingPrompt: z.string().min(1).max(12000),
  classificationPrompt: z.string().min(1).max(12000),
  taggingPrompt: z.string().min(1).max(12000),
  folderSignalPolicy: z.enum(["balanced", "prefer_folder"]),
  triagePrompt: z.string().min(1).max(12000),
  strategyPrompt: z.string().min(1).max(12000),
  stressTestPrompt: z.string().min(1).max(12000),
  draftPrompt: z.string().min(1).max(12000),
  statementOfEligibilityPrompt: z.string().min(1).max(12000),
  finalMeritsDeterminationPrompt: z.string().min(1).max(12000),
  activeStyleProfileId: z.string().min(1).max(160).optional(),
  apiKey: z.string().optional(),
  summaryModel: z.string().min(1),
  embeddingModel: z.string().min(1),
  embeddingDimensions: z.coerce.number().int().min(128).max(3072),
  outputRootPath: z.string().min(1).max(1024),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getPublicSettings());
}

export async function POST(request: Request) {
  const parsed = settingsInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid settings payload.",
      },
      { status: 400 },
    );
  }

  saveRuntimeSettings(parsed.data);

  return Response.json({
    ok: true,
    settings: getPublicSettings(),
  });
}
