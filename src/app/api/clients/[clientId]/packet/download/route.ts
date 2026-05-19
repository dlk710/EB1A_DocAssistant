import fs from "node:fs/promises";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { getSavedPacket } from "@/lib/assembly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }

  const packet = getSavedPacket(clientId);
  if (!packet?.pdfPath) {
    return Response.json({ error: "No generated packet exists for this client yet." }, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(packet.pdfPath);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${clientId}-petition-packet.pdf"`,
      },
    });
  } catch {
    return Response.json({ error: "The saved packet file could not be found." }, { status: 404 });
  }
}
