interface PetitionTemplateInput {
  title: string;
  subtitle?: string | null;
  bodyHtml: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraphHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function shell(input: PetitionTemplateInput) {
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\" />",
    "<style>",
    "@page { size: letter; margin: 0.75in 0.75in 0.8in; }",
    "html, body { margin: 0; padding: 0; color: #1A1A1F; font-family: 'Charter', Georgia, 'Times New Roman', serif; }",
    "body { font-size: 12pt; line-height: 1.55; }",
    ".page { width: 100%; }",
    ".brand { font-family: Helvetica, Arial, sans-serif; font-size: 11px; letter-spacing: .34em; text-transform: uppercase; color: #5B5B75; margin-bottom: 12px; }",
    ".brand-line { display: inline-block; width: 32px; height: 2px; background: #BA7517; vertical-align: middle; margin-left: 8px; }",
    "h1 { margin: 0 0 8px; font-size: 22pt; font-weight: 600; letter-spacing: -0.02em; }",
    ".subtitle { margin: 0 0 18px; font-family: Helvetica, Arial, sans-serif; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: #5B5B75; }",
    "p { margin: 0 0 12px; text-align: left; }",
    ".criterion-chip, .exhibit-chip { display: inline-block; margin-right: 6px; margin-bottom: 6px; border-radius: 999px; padding: 3px 8px; font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }",
    ".criterion-chip { background: #FAEEDA; color: #854F0B; }",
    ".exhibit-chip { background: #F5F4F0; color: #5B5B75; }",
    ".toc-table, .index-table { width: 100%; border-collapse: collapse; font-family: Helvetica, Arial, sans-serif; font-size: 11px; }",
    ".toc-table td, .index-table td, .index-table th { padding: 8px 0; border-bottom: 1px solid #E8E6DF; vertical-align: top; }",
    ".toc-table td:last-child, .index-table td:last-child, .index-table th:last-child { text-align: right; }",
    ".index-table th { text-transform: uppercase; letter-spacing: .12em; color: #5B5B75; font-size: 9px; text-align: left; }",
    ".cover { display: flex; min-height: 9.5in; flex-direction: column; justify-content: space-between; }",
    ".cover-meta { font-family: Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.8; color: #2A2A33; }",
    ".cover-wordmark { position: absolute; top: 0.75in; right: 0.75in; font-family: Helvetica, Arial, sans-serif; font-size: 16px; letter-spacing: -.03em; text-transform: lowercase; }",
    ".cover-wordmark::after { content: ''; display: block; margin-top: 4px; height: 2px; width: 54px; background: #BA7517; }",
    ".text-block { white-space: normal; }",
    "</style></head><body>",
    "<div class=\"page\">",
    input.bodyHtml,
    "</div></body></html>",
  ].join("");
}

export function buildCoverHtml(input: {
  candidateName: string;
  petitionType: string;
  attorneyName: string | null;
  firmName: string | null;
  filedDate: string | null;
}) {
  const bodyHtml = [
    "<div class=\"cover\">",
    "<div class=\"cover-wordmark\">setu</div>",
    "<div>",
    "<div class=\"brand\">petition packet <span class=\"brand-line\"></span></div>",
    `<h1>${escapeHtml(input.candidateName)}</h1>`,
    `<p class="subtitle">${escapeHtml(input.petitionType)} · Extraordinary ability petition</p>`,
    "</div>",
    "<div class=\"cover-meta\">",
    `<div><strong>Petitioner:</strong> ${escapeHtml(input.candidateName)}</div>`,
    `<div><strong>Petition type:</strong> ${escapeHtml(input.petitionType)}</div>`,
    `<div><strong>Prepared by:</strong> ${escapeHtml(input.attorneyName || "Setu attorney workflow")}</div>`,
    `<div><strong>Firm:</strong> ${escapeHtml(input.firmName || "Setu")}</div>`,
    `<div><strong>Filed date:</strong> ${escapeHtml(input.filedDate || "Pending")}</div>`,
    "</div>",
    "</div>",
  ].join("");
  return shell({ title: "Cover", bodyHtml });
}

export function buildTextSectionHtml(input: {
  title: string;
  subtitle?: string | null;
  paragraphs: string[];
}) {
  const bodyHtml = [
    "<div class=\"brand\">petition section <span class=\"brand-line\"></span></div>",
    `<h1>${escapeHtml(input.title)}</h1>`,
    input.subtitle ? `<p class="subtitle">${escapeHtml(input.subtitle)}</p>` : "",
    `<div class="text-block">${input.paragraphs.map((paragraph) => paragraphHtml(paragraph)).join("")}</div>`,
  ].join("");
  return shell({ title: input.title, subtitle: input.subtitle, bodyHtml });
}

export function buildTocHtml(input: { entries: Array<{ title: string; page: number; bates: string }> }) {
  const rows = input.entries
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.title)}</td><td>${escapeHtml(entry.bates)}</td><td>${entry.page}</td></tr>`,
    )
    .join("");

  const bodyHtml = [
    "<div class=\"brand\">table of contents <span class=\"brand-line\"></span></div>",
    "<h1>Table of Contents</h1>",
    "<table class=\"toc-table\">",
    rows,
    "</table>",
  ].join("");

  return shell({ title: "Table of Contents", bodyHtml });
}

export function buildExhibitIndexHtml(input: {
  entries: Array<{ exhibitNumber: string; title: string; pageRange: string; bates: string }>;
}) {
  const rows = input.entries
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.exhibitNumber)}</td><td>${escapeHtml(entry.title)}</td><td>${escapeHtml(entry.pageRange)}</td><td>${escapeHtml(entry.bates)}</td></tr>`,
    )
    .join("");
  const bodyHtml = [
    "<div class=\"brand\">exhibit index <span class=\"brand-line\"></span></div>",
    "<h1>Exhibit Index</h1>",
    "<table class=\"index-table\">",
    "<thead><tr><th>Exhibit</th><th>Title</th><th>Pages</th><th>Bates</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
  ].join("");
  return shell({ title: "Exhibit Index", bodyHtml });
}

export function buildPlainTextExhibitHtml(input: { title: string; text: string }) {
  const bodyHtml = [
    "<div class=\"brand\">exhibit preview <span class=\"brand-line\"></span></div>",
    `<h1>${escapeHtml(input.title)}</h1>`,
    `<div class="text-block">${paragraphHtml(input.text)}</div>`,
  ].join("");
  return shell({ title: input.title, bodyHtml });
}

export function buildImageExhibitHtml(input: { title: string; fileUrl: string }) {
  const bodyHtml = [
    "<div class=\"brand\">exhibit preview <span class=\"brand-line\"></span></div>",
    `<h1>${escapeHtml(input.title)}</h1>`,
    `<div style="display:flex;justify-content:center;align-items:flex-start;"><img src="${escapeHtml(input.fileUrl)}" style="max-width:100%;max-height:9in;border:1px solid #D8D6CF;border-radius:8px;" /></div>`,
  ].join("");
  return shell({ title: input.title, bodyHtml });
}
