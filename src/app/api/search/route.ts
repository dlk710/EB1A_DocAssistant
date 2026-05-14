import { semanticSearch } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const jobId = url.searchParams.get("jobId");

  if (!query) {
    return Response.json({
      query,
      jobId,
      results: [],
    });
  }

  const results = await semanticSearch(query, 20, jobId);

  return Response.json({
    query,
    jobId,
    results,
  });
}
