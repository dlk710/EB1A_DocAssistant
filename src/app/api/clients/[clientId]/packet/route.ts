import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { buildPacketAssembly, savePacketState } from "@/lib/assembly";
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
    return Response.json({
      packet: build.petition,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to build packet state." },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;
  if (!getClient(clientId)) {
    notFound();
  }

  try {
    const build = await buildPacketAssembly(clientId);
    const blockingFindings = build.petition.findings.filter((finding) => finding.severity === "blocking");
    if (blockingFindings.length) {
      return Response.json(
        {
          error: "Resolve blocking packet findings before generating the filable packet.",
          packet: build.petition,
        },
        { status: 400 },
      );
    }

    await assemblePacketPdf(
      build.renderedSections.map((section) => ({ pdfBytes: section.pdfBytes })),
      build.petition.pdfPath,
    );
    const packet = savePacketState({
      ...build.petition,
      status: "ready",
    });

    return Response.json({ packet });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to generate the filable packet." },
      { status: 500 },
    );
  }
}
