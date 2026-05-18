import { getClient } from "@/lib/clients";
import { listClientTimeline } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClientTimelineRouteProps {
  params: Promise<{
    clientId: string;
  }>;
}

export async function GET(_request: Request, { params }: ClientTimelineRouteProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    return Response.json({ error: "Client not found." }, { status: 404 });
  }

  return Response.json({
    events: listClientTimeline(clientId),
  });
}
