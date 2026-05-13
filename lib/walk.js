import fs from 'node:fs/promises';
import path from 'node:path';

// Extensions we'll attempt to extract text from.
export const TEXT_EXTS = new Set(['.pdf', '.docx', '.txt', '.md', '.eml', '.htm', '.html']);

// Folders / files we should never recurse into.
const SKIP_NAMES = new Set(['.DS_Store', '.git', 'node_modules', '.idea', '.vscode']);

export async function walkFolder(rootDir) {
  const out = [];
  await walkInner(rootDir, rootDir, out);
  return out;
}

async function walkInner(rootDir, current, out) {
  let entries;
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch (err) {
    return;
  }
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walkInner(rootDir, full, out);
    } else if (entry.isFile()) {
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) continue;
      const ext = path.extname(entry.name).toLowerCase();
      out.push({
        absPath: full,
        relPath: path.relative(rootDir, full),
        name: entry.name,
        ext,
        size: stat.size,
        isTextReadable: TEXT_EXTS.has(ext),
      });
    }
  }
}
