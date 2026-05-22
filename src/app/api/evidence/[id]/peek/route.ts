import { describeCriterionTag, normalizeCriterionTags } from "@/lib/criterion-tags";
import { getDocument } from "@/lib/qdrant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await getDocument(id);

  if (!document) {
    return Response.json(
      { ok: false, error: { code: "not_found", message: "Document not found." } },
      { status: 404 },
    );
  }

  const criteriaTags = normalizeCriterionTags(document);
  const previewText =
    document.metadata?.preview ||
    document.summary?.detailedSummary ||
    document.summary?.shortSummary ||
    "Preview unavailable.";

  return Response.json({
    ok: true,
    documentId: id,
    summary: document.summary,
    tags: criteriaTags,
    tagLabels: criteriaTags.map(describeCriterionTag),
    previewText: previewText.slice(0, 1500),
    metadata: {
      pageCount: document.pageCount,
      indexedAt: document.metadata?.indexedAt ?? document.createdAt,
      bundleHint: document.relativePath.split("/").slice(0, -1).join(" / ") || null,
      sourceKind: document.sourceKind,
      workspaceLabel: document.folderLabel,
      relativePath: document.relativePath,
    },
  });
}
