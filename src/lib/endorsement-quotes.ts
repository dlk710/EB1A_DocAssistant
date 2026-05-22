import fs from "node:fs/promises";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import type { EndorsementQuote, StoredDocument } from "@/lib/types";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitIntoCandidatePassages(text: string) {
  return text
    .split(/\n{2,}|(?<=[.?!])\s+(?=[A-Z])/)
    .map((segment) => normalizeWhitespace(segment))
    .filter((segment) => segment.length >= 80 && segment.length <= 480);
}

function likelyQuoteScore(text: string) {
  const lower = text.toLowerCase();
  let score = 0;
  if (/\b(critical|led|lead|significant|major|distinguished|original|indispensable|essential)\b/.test(lower)) {
    score += 2;
  }
  if (/\b(i have|i can attest|in my opinion|i observed|i supervised|i recommend)\b/.test(lower)) {
    score += 3;
  }
  if (text.includes("“") || text.includes("\"")) {
    score += 1;
  }
  return score;
}

function parseExpertName(document: StoredDocument) {
  const source =
    document.summary?.title ||
    document.fileName ||
    document.relativePath;
  const match =
    source.match(/(?:reference|recommendation)\s+letter\s+from\s+(.+?)(?:\s+regarding|\s+for|\s*[-–]|$)/i) ||
    source.match(/from\s+(.+?)(?:\s+regarding|\s+for|\s*[-–]|$)/i);

  return match?.[1]?.trim() || "Unnamed expert";
}

function parseExpertAffiliation(document: StoredDocument) {
  return document.summary?.organizations?.[0] || "Affiliation not parsed";
}

function parseExpertTitle(document: StoredDocument) {
  return document.summary?.people?.[1] || "Title not parsed";
}

export function isLikelyEndorsementDocument(document: Pick<StoredDocument, "fileName" | "relativePath" | "summary">) {
  const haystack = [
    document.fileName,
    document.relativePath,
    document.summary?.title,
    document.summary?.shortSummary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(reference letter|recommendation letter|support letter|endorsement|testimonial|letter of recommendation)/.test(
    haystack,
  );
}

export async function loadDocumentSourceText(document: Pick<StoredDocument, "absolutePath" | "extension" | "mimeType">) {
  const normalizedExtension = document.extension.toLowerCase();

  if (normalizedExtension === ".pdf" || document.mimeType === "application/pdf") {
    const buffer = await fs.readFile(document.absolutePath);
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return normalizeWhitespace(parsed.text || "");
  }

  if (
    normalizedExtension === ".docx" ||
    document.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = await fs.readFile(document.absolutePath);
    const result = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(result.value || "");
  }

  const raw = await fs.readFile(document.absolutePath, "utf8").catch(() => "");
  return normalizeWhitespace(raw);
}

export async function verifyVerbatimQuote(
  document: Pick<StoredDocument, "absolutePath" | "extension" | "mimeType">,
  quoteText: string,
) {
  const sourceText = await loadDocumentSourceText(document);
  if (!sourceText) {
    return false;
  }
  return sourceText.includes(normalizeWhitespace(quoteText));
}

export async function extractCandidateEndorsementQuotes(input: {
  documents: StoredDocument[];
  subsectionId: string;
  supportsClaim: string;
  exhibitLookup: Map<string, string>;
  employerNames?: string[];
  maxCandidates?: number;
}) {
  const candidates: EndorsementQuote[] = [];

  for (const document of input.documents) {
    if (!isLikelyEndorsementDocument(document)) {
      continue;
    }

    const sourceText = await loadDocumentSourceText(document).catch(() => "");
    if (!sourceText) {
      continue;
    }

    const bestPassages = splitIntoCandidatePassages(sourceText)
      .map((text) => ({ text, score: likelyQuoteScore(text) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 2);

    for (const passage of bestPassages) {
      candidates.push({
        id: `${document.id}:${candidates.length + 1}`,
        expertName: parseExpertName(document),
        expertTitleAtLetter: parseExpertTitle(document),
        expertCurrentRole: null,
        expertAffiliation: parseExpertAffiliation(document),
        sourceExhibitNumber: input.exhibitLookup.get(document.id) || "Exhibit pending",
        sourceDocId: document.id,
        quoteText: passage.text,
        anchoredToSubsectionId: input.subsectionId,
        supportsClaim: input.supportsClaim,
        isIndependent:
          input.employerNames?.length
            ? !input.employerNames.some((name) =>
                parseExpertAffiliation(document).toLowerCase().includes(name.toLowerCase()),
              )
            : null,
      });
    }
  }

  return candidates.slice(0, input.maxCandidates ?? 4);
}
