import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { buildPacketAssembly } from "@/lib/assembly";
import { assemblePacketPdf } from "@/lib/pdf/assemble";

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

  try {
    const build = await buildPacketAssembly(clientId);
    const pdfBytes = await assemblePacketPdf(
      build.renderedSections.map((section) => ({ pdfBytes: section.pdfBytes })),
    );
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${clientId}-preview.pdf"`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to render the preview packet." },
      { status: 500 },
    );
  }
}
