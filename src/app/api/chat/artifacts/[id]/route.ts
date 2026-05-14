import { z } from "zod";
import { deleteChatArtifact, listChatArtifacts } from "@/lib/chat-state";

const deleteArtifactSchema = z.object({
  jobId: z.string().uuid(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const parsed = deleteArtifactSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "jobId is required to delete an artifact." }, { status: 400 });
  }

  deleteChatArtifact(parsed.data.jobId, params.id);

  return Response.json({
    ok: true,
    artifacts: listChatArtifacts(parsed.data.jobId),
  });
}
