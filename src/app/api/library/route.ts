import { buildLibrarySnapshot } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const jobId = params.get("jobId");
  const clientId = params.get("clientId");

  return Response.json(
    await buildLibrarySnapshot({
      jobId,
      clientId,
    }),
  );
}
