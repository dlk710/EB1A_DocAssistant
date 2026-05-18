import { deleteClient, getClient, listClientJobs, updateClient } from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClientRouteProps {
  params: Promise<{
    clientId: string;
  }>;
}

export async function GET(_request: Request, { params }: ClientRouteProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    return Response.json({ error: "Client not found." }, { status: 404 });
  }

  return Response.json({
    client,
    jobs: listClientJobs(clientId),
  });
}

export async function PATCH(request: Request, { params }: ClientRouteProps) {
  const { clientId } = await params;
  const payload = (await request.json()) as
    | {
        displayName?: string;
        status?: string;
        filingTargetDate?: string | null;
        filedAt?: string | null;
        decidedAt?: string | null;
        decision?: "approved" | "denied" | "rfe" | "withdrawn" | null;
        notes?: string;
      }
    | null;

  const client = updateClient(clientId, {
    ...(payload?.displayName !== undefined
      ? { displayName: payload.displayName.trim() || "Untitled client" }
      : {}),
    ...(payload?.status !== undefined ? { status: payload.status as never } : {}),
    ...(payload?.filingTargetDate !== undefined
      ? { filingTargetDate: payload.filingTargetDate }
      : {}),
    ...(payload?.filedAt !== undefined ? { filedAt: payload.filedAt } : {}),
    ...(payload?.decidedAt !== undefined ? { decidedAt: payload.decidedAt } : {}),
    ...(payload?.decision !== undefined ? { decision: payload.decision } : {}),
    ...(payload?.notes !== undefined ? { notes: payload.notes } : {}),
  });

  if (!client) {
    return Response.json({ error: "Client not found." }, { status: 404 });
  }

  return Response.json({
    client,
  });
}

export async function DELETE(_request: Request, { params }: ClientRouteProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    return Response.json({ error: "Client not found." }, { status: 404 });
  }

  const jobs = listClientJobs(clientId);

  if (jobs.length > 0) {
    return Response.json(
      { error: "Delete the client's workspaces before removing the client." },
      { status: 400 },
    );
  }

  deleteClient(clientId);

  return Response.json({
    ok: true,
  });
}
