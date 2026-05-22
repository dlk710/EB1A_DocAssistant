import fs from "node:fs/promises";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { IMAGE_EXTENSIONS, TEXT_EXTENSIONS } from "@/lib/constants";
import { buildFolderContextText } from "@/lib/folder-context";
import { extractQuickLookPreviewText } from "@/lib/preview";
import type { StoredDocument } from "@/lib/types";

export interface PreparedDocumentInput {
  extractionMethod: "text" | "vision" | "filename_only";
  sourceKind: string;
  promptBody: string;
  preview: string;
  previewMode: "native" | "quicklook" | "text_extract" | "filename_only";
  pageCount: number | null;
  charCount: number;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sampleText(value: string, maxLength = 18000) {
  if (value.length <= maxLength) {
    return value;
  }

  const head = value.slice(0, Math.floor(maxLength * 0.65));
  const tail = value.slice(-Math.floor(maxLength * 0.25));
  return `${head}\n\n...[truncated for review]...\n\n${tail}`;
}

function buildTextPrompt(fileName: string, relativePath: string, text: string) {
  return [
    `File name: ${fileName}`,
    `Relative path: ${relativePath}`,
    buildFolderContextText(relativePath),
    "",
    "Extracted content:",
    sampleText(text),
  ].join("\n");
}

export async function prepareDocumentInput(
  document: Pick<
    StoredDocument,
    "id" | "absolutePath" | "fileName" | "relativePath" | "extension" | "mimeType"
  >,
): Promise<PreparedDocumentInput> {
  const normalizedExtension = document.extension.toLowerCase();

  if (
    IMAGE_EXTENSIONS.has(normalizedExtension) ||
    document.mimeType.startsWith("image/")
  ) {
    const buffer = await fs.readFile(document.absolutePath);
    const dataUrl = `data:${document.mimeType || "image/png"};base64,${buffer.toString("base64")}`;

    return {
      extractionMethod: "vision",
      sourceKind: "image_vision",
      promptBody: [
        `File name: ${document.fileName}`,
        `Relative path: ${document.relativePath}`,
        buildFolderContextText(document.relativePath),
        "",
        "Review this evidence image and extract what it appears to show.",
        dataUrl,
      ].join("\n"),
      preview: "Image-only evidence. Review grounded in the uploaded visual.",
      previewMode: "native",
      pageCount: 1,
      charCount: 0,
    };
  }

  if (normalizedExtension === ".pdf" || document.mimeType === "application/pdf") {
    const buffer = await fs.readFile(document.absolutePath);
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const extractedText = normalizeWhitespace(parsed.text || "");

    if (extractedText.length > 40) {
      return {
        extractionMethod: "text",
        sourceKind: "pdf_text",
        promptBody: buildTextPrompt(document.fileName, document.relativePath, extractedText),
        preview: sampleText(extractedText, 1200),
        previewMode: "native",
        pageCount: parsed.total ?? null,
        charCount: extractedText.length,
      };
    }
  }

  if (
    normalizedExtension === ".docx" ||
    document.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = await fs.readFile(document.absolutePath);
    const result = await mammoth.extractRawText({ buffer });
    const extractedText = normalizeWhitespace(result.value || "");

    if (extractedText.length > 40) {
      return {
        extractionMethod: "text",
        sourceKind: "docx_text",
        promptBody: buildTextPrompt(document.fileName, document.relativePath, extractedText),
        preview: sampleText(extractedText, 1200),
        previewMode: "quicklook",
        pageCount: null,
        charCount: extractedText.length,
      };
    }
  }

  if (
    TEXT_EXTENSIONS.has(normalizedExtension) ||
    document.mimeType.startsWith("text/") ||
    document.mimeType === "message/rfc822"
  ) {
    const buffer = await fs.readFile(document.absolutePath);
    const extractedText = normalizeWhitespace(buffer.toString("utf8"));

    if (extractedText.length > 0) {
      return {
        extractionMethod: "text",
        sourceKind: "text_extract",
        promptBody: buildTextPrompt(document.fileName, document.relativePath, extractedText),
        preview: sampleText(extractedText, 1200),
        previewMode: "native",
        pageCount: null,
        charCount: extractedText.length,
      };
    }
  }

  try {
    const extractedText = normalizeWhitespace(
      await extractQuickLookPreviewText(document.id, document.absolutePath),
    );

    if (extractedText.length > 40) {
      return {
        extractionMethod: "text",
        sourceKind: "quicklook_preview_text",
        promptBody: buildTextPrompt(document.fileName, document.relativePath, extractedText),
        preview: sampleText(extractedText, 1200),
        previewMode: "quicklook",
        pageCount: null,
        charCount: extractedText.length,
      };
    }
  } catch {
    // Quick Look is a best-effort fallback for rich local previews.
  }

  return {
    extractionMethod: "filename_only",
    sourceKind: "filename_only",
    promptBody: [
      `File name: ${document.fileName}`,
      `Relative path: ${document.relativePath}`,
      buildFolderContextText(document.relativePath),
      `Extension: ${document.extension || "unknown"}`,
      `Mime type: ${document.mimeType || "unknown"}`,
      "",
      "No extractable text or viewable image preview was available from this file.",
      "Create a cautious review note based only on the metadata above. State clearly that OCR or manual review is still needed.",
    ].join("\n"),
    preview: "No extractable text was available. Manual OCR or conversion may be needed.",
    previewMode: "filename_only",
    pageCount: null,
    charCount: 0,
  };
}
