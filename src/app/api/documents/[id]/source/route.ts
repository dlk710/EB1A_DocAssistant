import fs from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getDocument } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await getDocument(id);
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!document || (jobId && document.jobId !== jobId)) {
    return Response.json(
      {
        error: "Document not found.",
      },
      { status: 404 },
    );
  }

  const buffer = await fs.readFile(document.absolutePath);
  const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  return new Response(body, {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
    },
  });
}
