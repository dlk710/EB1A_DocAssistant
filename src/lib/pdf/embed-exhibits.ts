import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";
import { ensureQuickLookPreview } from "@/lib/preview";
import { renderFileUrlToPdf, renderHtmlToPdf } from "@/lib/pdf/render-body";
import { buildImageExhibitHtml, buildPlainTextExhibitHtml } from "@/templates/petition-body.html";
import type { StoredDocument } from "@/lib/types";

interface RenderedExhibitPdf {
  pdfBytes: Uint8Array;
  pageCount: number;
  sourceType: "pdf" | "quicklook" | "text" | "image";
}

function normalizeExtension(document: StoredDocument) {
  return document.extension.toLowerCase();
}

async function pageCountFromPdfBytes(pdfBytes: Uint8Array) {
  const pdf = await PDFDocument.load(pdfBytes);
  return pdf.getPageCount();
}

async function renderQuickLookPdf(document: StoredDocument): Promise<RenderedExhibitPdf> {
  const { htmlPath } = await ensureQuickLookPreview(document.id, document.absolutePath);
  const { pdfBytes, pageCount } = await renderFileUrlToPdf(pathToFileURL(htmlPath).href);
  return {
    pdfBytes,
    pageCount,
    sourceType: "quicklook",
  };
}

async function renderPlainTextPdf(document: StoredDocument) {
  const content = await fs.readFile(document.absolutePath, "utf8");
  const { pdfBytes, pageCount } = await renderHtmlToPdf(
    buildPlainTextExhibitHtml({
      title: document.fileName,
      text: content,
    }),
  );
  return {
    pdfBytes,
    pageCount,
    sourceType: "text" as const,
  };
}

async function renderImagePdf(document: StoredDocument) {
  const { pdfBytes, pageCount } = await renderHtmlToPdf(
    buildImageExhibitHtml({
      title: document.fileName,
      fileUrl: pathToFileURL(document.absolutePath).href,
    }),
  );
  return {
    pdfBytes,
    pageCount,
    sourceType: "image" as const,
  };
}

export async function renderExhibitPdf(document: StoredDocument): Promise<RenderedExhibitPdf> {
  const extension = normalizeExtension(document);

  if (extension === ".pdf" || document.mimeType === "application/pdf") {
    const pdfBytes = new Uint8Array(await fs.readFile(document.absolutePath));
    return {
      pdfBytes,
      pageCount: await pageCountFromPdfBytes(pdfBytes),
      sourceType: "pdf",
    };
  }

  if (
    document.mimeType.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic"].includes(extension)
  ) {
    return renderImagePdf(document);
  }

  if (
    [".docx", ".xlsx", ".pptx", ".pages", ".numbers", ".key"].includes(extension)
  ) {
    return renderQuickLookPdf(document);
  }

  if (
    document.mimeType.startsWith("text/") ||
    document.mimeType === "message/rfc822" ||
    [".txt", ".md", ".eml"].includes(extension) ||
    extension === ""
  ) {
    return renderPlainTextPdf(document);
  }

  throw new Error(`Unsupported exhibit type: ${path.extname(document.fileName) || "unknown"}`);
}
