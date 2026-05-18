import { createClient, listClients } from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    clients: listClients(),
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as
    | {
        displayName?: string;
        petitionType?: "EB-1A";
        filingTargetDate?: string | null;
        notes?: string;
      }
    | null;

  const displayName = payload?.displayName?.trim() ?? "";

  if (!displayName) {
    return Response.json(
      {
        error: "displayName is required.",
      },
      { status: 400 },
    );
  }

  const client = createClient({
    displayName,
    petitionType: payload?.petitionType ?? "EB-1A",
    filingTargetDate: payload?.filingTargetDate ?? null,
    notes: payload?.notes ?? "",
  });

  return Response.json({
    client,
  });
}
