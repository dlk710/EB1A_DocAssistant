import fs from 'node:fs/promises';
import path from 'node:path';

// Lazy-load heavy parsers so the server doesn't pay startup cost when not needed.
let pdfParse = null;
let mammoth = null;

const SMART_EXTRACT_CHAR_LIMIT = 3200;
const SMART_HEAD_CHAR_LIMIT = 1100;
const SMART_TAIL_CHAR_LIMIT = 400;
const EVIDENCE_KEYWORDS = [
  'award', 'prize', 'recognition', 'honor', 'winner', 'finalist', 'forbes',
  'member', 'membership', 'fellow', 'distinguished member',
  'published', 'publication', 'article', 'paper', 'journal', 'conference', 'authored',
  'judge', 'judging', 'reviewer', 'peer review', 'panel', 'jury', 'invited reviewer',
  'patent', 'inventor', 'innovation', 'contribution', 'novel', 'significance',
  'citation', 'cited', 'reference letter', 'recommendation', 'support letter',
  'salary', 'compensation', 'equity', 'bonus',
  'critical role', 'leading', 'led', 'director', 'cto', 'founder',
  'media', 'press', 'featured', 'profile', 'interview',
];

export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return extractPdf(filePath);
  if (ext === '.docx') return extractDocx(filePath);
  if (ext === '.txt' || ext === '.md') return extractPlain(filePath);
  if (ext === '.eml') return extractEml(filePath);
  if (ext === '.htm' || ext === '.html') return extractHtml(filePath);
  throw new Error(`Unsupported text format: ${ext}`);
}

export async function extractClassificationText(filePath) {
  const raw = await extractText(filePath);
  return buildClassificationExcerpt(raw);
}

export function buildClassificationExcerpt(rawText) {
  const normalized = normalizeText(rawText);
  if (!normalized) return '';
  if (normalized.length <= SMART_EXTRACT_CHAR_LIMIT) return normalized;

  const head = normalized.slice(0, SMART_HEAD_CHAR_LIMIT).trim();
  const tail = normalized.slice(-SMART_TAIL_CHAR_LIMIT).trim();
  const seen = new Set(splitSnippetLines(head).map(normalizeLineKey));
  const snippets = [];
  let usedChars = head.length + tail.length + 64;

  for (const candidate of rankEvidenceLines(normalized)) {
    const key = normalizeLineKey(candidate);
    if (!key || seen.has(key)) continue;
    if (usedChars + candidate.length + 1 > SMART_EXTRACT_CHAR_LIMIT) break;
    snippets.push(candidate);
    seen.add(key);
    usedChars += candidate.length + 1;
  }

  const parts = [
    head,
    snippets.length ? `Key evidence lines:\n${snippets.join('\n')}` : '',
    tail && normalizeLineKey(tail) !== normalizeLineKey(head) ? `Closing excerpt:\n${tail}` : '',
  ].filter(Boolean);

  return parts.join('\n\n').slice(0, SMART_EXTRACT_CHAR_LIMIT).trim();
}

async function extractPdf(filePath) {
  if (!pdfParse) ({ default: pdfParse } = await import('pdf-parse'));
  const buf = await fs.readFile(filePath);
  const data = await pdfParse(buf);
  return (data.text || '').trim();
}

async function extractDocx(filePath) {
  if (!mammoth) ({ default: mammoth } = await import('mammoth'));
  const result = await mammoth.extractRawText({ path: filePath });
  return (result.value || '').trim();
}

async function extractPlain(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return text.trim();
}

async function extractEml(filePath) {
  // Naive .eml handling: strip headers up to first blank line, return body.
  const raw = await fs.readFile(filePath, 'utf8');
  const blankIdx = raw.indexOf('\n\n');
  if (blankIdx === -1) return raw.trim();
  return raw.slice(blankIdx + 2).trim();
}

async function extractHtml(filePath) {
  const html = await fs.readFile(filePath, 'utf8');
  // Strip tags very crudely — fine for classification.
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSnippetLines(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function normalizeLineKey(line) {
  return line.toLowerCase().replace(/\s+/g, ' ').trim();
}

function rankEvidenceLines(text) {
  const lines = splitSnippetLines(text)
    .map(line => line.length > 220 ? `${line.slice(0, 217)}...` : line)
    .filter(line => line.length >= 24);

  return lines
    .map(line => ({ line, score: scoreEvidenceLine(line) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.line.length - b.line.length)
    .slice(0, 28)
    .map(item => item.line);
}

function scoreEvidenceLine(line) {
  const lower = line.toLowerCase();
  let score = 0;

  for (const keyword of EVIDENCE_KEYWORDS) {
    if (lower.includes(keyword)) score += 4;
  }
  if (/\b(19|20)\d{2}\b/.test(line)) score += 2;
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(line)) score += 2;
  if (/\$\s?\d[\d,]*(?:\.\d{2})?/.test(line)) score += 3;
  if (/\b(?:ieee|acm|neurips|icml|forbes|techcrunch|wired|patent|journal|conference)\b/i.test(line)) score += 3;
  if (/[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z&.-]+){1,5}/.test(line)) score += 1;
  if (line.length >= 40 && line.length <= 180) score += 1;
  if (/^[-*•]/.test(line)) score += 1;

  return score;
}
