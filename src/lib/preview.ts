import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mime from "mime-types";
import {
  NATIVE_PREVIEW_EXTENSIONS,
  PREVIEW_ROOT,
  QUICKLOOK_PREVIEW_EXTENSIONS,
} from "@/lib/constants";
import { ensureStorageRoots } from "@/lib/state-store";
import type { StoredDocument } from "@/lib/types";

const execFileAsync = promisify(execFile);

export type PreviewMode =
  | "native"
  | "quicklook"
  | "text_extract"
  | "filename_only";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPreviewShell(document: StoredDocument, previewMode: PreviewMode, workspaceJobId?: string | null) {
  const query = workspaceJobId ? `?jobId=${encodeURIComponent(workspaceJobId)}` : "";
  const sourceLabel = escapeHtml(document.fileName);
  const isImage = document.mimeType.startsWith("image/");
  const isPdf = document.mimeType === "application/pdf";
  const defaultScale =
    previewMode === "quicklook" ? 0.74 : isPdf ? 0.82 : isImage ? 1 : 0.92;
  const minScale = isImage ? 0.4 : 0.55;
  const maxScale = isImage ? 3 : 2.25;
  const step = isImage ? 0.15 : 0.1;
  const rawPreviewUrl =
    previewMode === "quicklook"
      ? `/api/documents/${document.id}/preview/_bundle/index.html${query}`
      : `/api/documents/${document.id}/preview/raw${query}${
          isPdf ? "#toolbar=0&navpanes=0&view=FitH" : ""
        }`;

  const viewportMarkup = isImage
    ? [
        '<div id="surface" class="surface surface-image">',
        `<img id="preview-image" src="${rawPreviewUrl}" alt="${sourceLabel}" />`,
        "</div>",
      ].join("")
    : [
        '<div id="surface" class="surface surface-frame">',
        `<iframe id="preview-frame" src="${rawPreviewUrl}" title="${sourceLabel}" loading="lazy"></iframe>`,
        "</div>",
      ].join("");

  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\" />",
    `<title>${sourceLabel}</title>`,
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<style>",
    ":root{color-scheme:light;}",
    "html,body{height:100%;margin:0;background:#f6f7fb;color:#211c33;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;}",
    "body{display:flex;flex-direction:column;}",
    ".toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(35,31,53,.08);background:rgba(255,255,255,.92);backdrop-filter:blur(18px);}",
    ".label{min-width:0;display:flex;flex-direction:column;gap:2px;}",
    ".eyebrow{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#7d7598;}",
    ".title{font-size:11px;font-weight:600;line-height:1.45;color:#312a49;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".controls{display:flex;align-items:center;gap:8px;flex-shrink:0;}",
    ".controls button{appearance:none;border:1px solid rgba(35,31,53,.1);background:white;border-radius:999px;color:#312a49;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;}",
    ".controls button:hover{background:#f5f7ff;}",
    ".controls button:active{transform:translateY(1px);}",
    ".zoom-value{min-width:48px;text-align:center;font-size:11px;font-weight:700;color:#5e567b;}",
    ".workspace{flex:1;min-height:0;padding:12px;}",
    ".frame-shell{height:100%;border:1px solid rgba(35,31,53,.08);border-radius:18px;background:white;overflow:auto;box-shadow:0 20px 50px -38px rgba(35,31,53,.3);}",
    ".surface{position:relative;min-height:100%;display:flex;align-items:flex-start;justify-content:center;padding:10px;box-sizing:border-box;overflow:auto;}",
    ".surface-frame{background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%);}",
    ".surface-image{align-items:center;background:radial-gradient(circle at top,#f7f5ff 0%,#ffffff 70%);}",
    "#preview-frame{border:0;display:block;background:white;transform-origin:top center;box-shadow:0 20px 48px -36px rgba(35,31,53,.45);}",
    "#preview-image{display:block;max-width:100%;height:auto;transform-origin:center center;box-shadow:0 20px 48px -36px rgba(35,31,53,.45);border-radius:14px;}",
    "</style></head><body>",
    "<div class=\"toolbar\">",
    "<div class=\"label\">",
    "<span class=\"eyebrow\">Fit To Pane By Default</span>",
    `<span class="title">${sourceLabel}</span>`,
    "</div>",
    "<div class=\"controls\">",
    "<button type=\"button\" id=\"zoom-out\" aria-label=\"Zoom out\">−</button>",
    "<span class=\"zoom-value\" id=\"zoom-value\">100%</span>",
    "<button type=\"button\" id=\"zoom-in\" aria-label=\"Zoom in\">+</button>",
    "<button type=\"button\" id=\"zoom-fit\">Fit</button>",
    "<button type=\"button\" id=\"zoom-reset\">100%</button>",
    "</div>",
    "</div>",
    "<div class=\"workspace\">",
    "<div class=\"frame-shell\">",
    viewportMarkup,
    "</div>",
    "</div>",
    "<script>",
    `const state={scale:${defaultScale.toFixed(2)},defaultScale:${defaultScale.toFixed(2)},minScale:${minScale.toFixed(2)},maxScale:${maxScale.toFixed(2)},step:${step.toFixed(2)}};`,
    "const frame=document.getElementById('preview-frame');",
    "const image=document.getElementById('preview-image');",
    "const zoomValue=document.getElementById('zoom-value');",
    "function clamp(value){return Math.min(state.maxScale,Math.max(state.minScale,Number(value.toFixed(2))));}",
    "function applyScale(){",
    "zoomValue.textContent=`${Math.round(state.scale*100)}%`;",
    "if(frame){",
    "frame.style.transform=`scale(${state.scale})`;",
    "frame.style.width=`${100/state.scale}%`;",
    "frame.style.height=`${100/state.scale}%`;",
    "frame.style.minHeight=`${Math.max(520, Math.round(820/state.scale))}px`;",
    "}",
    "if(image){image.style.transform=`scale(${state.scale})`;}",
    "}",
    "document.getElementById('zoom-out').addEventListener('click',()=>{state.scale=clamp(state.scale-state.step);applyScale();});",
    "document.getElementById('zoom-in').addEventListener('click',()=>{state.scale=clamp(state.scale+state.step);applyScale();});",
    "document.getElementById('zoom-fit').addEventListener('click',()=>{state.scale=state.defaultScale;applyScale();});",
    "document.getElementById('zoom-reset').addEventListener('click',()=>{state.scale=1;applyScale();});",
    "applyScale();",
    "</script>",
    "</body></html>",
  ].join("");
}

function isWithin(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function listQuickLookEntries(previewDir: string) {
  let entries;

  try {
    entries = await fs.readdir(previewDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const bundle = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(".qlpreview"));
  return bundle ? path.join(previewDir, bundle.name) : null;
}

async function getPreviewHtmlPath(bundleDir: string) {
  const htmlPath = path.join(bundleDir, "Preview.html");
  await fs.access(htmlPath);
  return htmlPath;
}

export async function ensureQuickLookPreview(documentId: string, absolutePath: string) {
  ensureStorageRoots();
  const sourceStat = await fs.stat(absolutePath);
  const previewDir = path.join(PREVIEW_ROOT, documentId);
  const existingBundle = await listQuickLookEntries(previewDir);

  if (existingBundle) {
    try {
      const htmlPath = await getPreviewHtmlPath(existingBundle);
      const previewStat = await fs.stat(htmlPath);

      if (previewStat.mtimeMs >= sourceStat.mtimeMs) {
        return {
          previewDir,
          bundleDir: existingBundle,
          htmlPath,
        };
      }
    } catch {
      // Rebuild stale or incomplete preview below.
    }
  }

  await fs.rm(previewDir, { recursive: true, force: true });
  await fs.mkdir(previewDir, { recursive: true });
  await execFileAsync("qlmanage", ["-o", previewDir, "-p", absolutePath]);

  const bundleDir = await listQuickLookEntries(previewDir);

  if (!bundleDir) {
    throw new Error("Quick Look preview was not generated.");
  }

  return {
    previewDir,
    bundleDir,
    htmlPath: await getPreviewHtmlPath(bundleDir),
  };
}

export async function extractQuickLookPreviewText(documentId: string, absolutePath: string) {
  const { htmlPath } = await ensureQuickLookPreview(documentId, absolutePath);
  const { stdout } = await execFileAsync("textutil", ["-convert", "txt", "-stdout", htmlPath]);
  return stdout.trim();
}

export function inferPreviewMode(document: StoredDocument): PreviewMode {
  if (
    document.mimeType.startsWith("image/") ||
    document.mimeType === "application/pdf" ||
    document.mimeType.startsWith("text/") ||
    NATIVE_PREVIEW_EXTENSIONS.has(document.extension.toLowerCase())
  ) {
    return "native";
  }

  if (QUICKLOOK_PREVIEW_EXTENSIONS.has(document.extension.toLowerCase())) {
    return "quicklook";
  }

  if (document.metadata?.previewMode) {
    return document.metadata.previewMode;
  }

  return "filename_only";
}

export async function resolvePreviewAsset(
  document: StoredDocument,
  assetSegments?: string[],
  workspaceJobId?: string | null,
): Promise<{
  contentType: string;
  body: ArrayBuffer | string;
}> {
  const previewMode = inferPreviewMode(document);

  if (previewMode === "native") {
    if (!assetSegments?.length || assetSegments.join("/") === "index.html") {
      return {
        contentType: "text/html; charset=utf-8",
        body: buildPreviewShell(document, previewMode, workspaceJobId),
      };
    }

    if (assetSegments[0] !== "raw") {
      throw new Error("Invalid native preview asset path.");
    }

    const buffer = await fs.readFile(document.absolutePath);
    return {
      contentType:
        document.mimeType ||
        (typeof mime.lookup(document.fileName) === "string"
          ? (mime.lookup(document.fileName) as string)
          : "application/octet-stream"),
      body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  }

  if (previewMode === "quicklook") {
    const { bundleDir, htmlPath } = await ensureQuickLookPreview(document.id, document.absolutePath);

    if (!assetSegments?.length || assetSegments.join("/") === "index.html") {
      return {
        contentType: "text/html; charset=utf-8",
        body: buildPreviewShell(document, previewMode, workspaceJobId),
      };
    }

    if (assetSegments[0] !== "_bundle") {
      throw new Error("Invalid preview asset path.");
    }

    const innerSegments = assetSegments.slice(1);
    const assetPath =
      !innerSegments.length || innerSegments.join("/") === "index.html"
        ? htmlPath
        : path.join(bundleDir, ...innerSegments);

    if (!isWithin(bundleDir, assetPath)) {
      throw new Error("Invalid preview asset path.");
    }

    const buffer = await fs.readFile(assetPath);
    const contentType =
      (typeof mime.lookup(assetPath) === "string"
        ? (mime.lookup(assetPath) as string)
        : "application/octet-stream") || "application/octet-stream";

    return {
      contentType,
      body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  }

  const fallbackHtml = [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\" />",
    `<title>${document.fileName}</title>`,
    "<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#fbf8ff;color:#231f35;padding:24px;line-height:1.6}a{color:#4b4dce;text-decoration:none;font-weight:600}.card{max-width:760px;background:white;border:1px solid rgba(35,31,53,.08);border-radius:20px;padding:20px;box-shadow:0 24px 60px -40px rgba(35,31,53,.35)}</style>",
    "</head><body><div class=\"card\">",
    `<h1 style="margin:0 0 8px;font-size:20px;">${document.fileName}</h1>`,
    "<p style=\"margin:0 0 14px;color:#6f6888;\">A native preview is not available for this format. The document is still stored locally and can be opened from the evidence workspace.</p>",
    `<p style="margin:0;"><a href="/api/documents/${document.id}/source${
      workspaceJobId ? `?jobId=${encodeURIComponent(workspaceJobId)}` : ""
    }" target="_blank" rel="noreferrer">Open the original file</a></p>`,
    "</div></body></html>",
  ].join("");

  return {
    contentType: "text/html; charset=utf-8",
    body: fallbackHtml,
  };
}
