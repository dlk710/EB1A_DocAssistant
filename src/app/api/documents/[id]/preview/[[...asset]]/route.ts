import type { NextRequest } from "next/server";
import { resolvePreviewAsset } from "@/lib/preview";
import { getDocument } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; asset?: string[] }> },
) {
  const { id, asset } = await context.params;
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

  try {
    const preview = await resolvePreviewAsset(document, asset, jobId);
    const body =
      typeof preview.body === "string" ? preview.body : new Blob([preview.body]);
    return new Response(body, {
      headers: {
        "Content-Type": preview.contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview unavailable.";
    return new Response(
      [
        "<!doctype html>",
        "<html><head><meta charset=\"utf-8\" /><title>Preview unavailable</title></head>",
        `<body style="font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;background:#fbf8ff;color:#231f35;"><h1 style="margin:0 0 8px;font-size:20px;">Preview unavailable</h1><p style="line-height:1.6;">${message}</p><p><a href="/api/documents/${document.id}/source${
          jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""
        }" target="_blank" rel="noreferrer">Open the original file</a></p></body></html>`,
      ].join(""),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    );
  }
}
