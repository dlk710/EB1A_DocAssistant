import { buildLibrarySnapshot } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");

  return Response.json(
    await buildLibrarySnapshot({
      jobId,
    }),
  );
}
