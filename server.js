import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLLM, listProviders, DEFAULT_PROMPTS, DEFAULT_PROMPT_SECTIONS, PROMPT_SECTION_META, resolvePrompts } from './lib/llm/index.js';
import { getModelPricing } from './lib/llm/pricing.js';
import { runPipeline } from './lib/pipeline.js';
import { loadPetitionWorkspace, savePetitionWorkspace, WORKSPACE_FILENAME, PLAN_FILENAME } from './lib/petition-workspace.js';
import { CRITERIA_ORDER, normalizeSelectedCriteria } from './lib/criteria.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, 'config', 'settings.local.json');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ESTIMATE_BASE_INPUT_TOKENS = 725;
const ESTIMATE_FILENAME_TOKENS = 20;
const ESTIMATE_OUTPUT_TOKENS = 90;
const ESTIMATE_CHARS_PER_TOKEN = 4;
const MAX_CLASSIFICATION_CHARS = 6000;

// In-memory store of recent runs (single-user local app — no persistence needed beyond a session).
const runs = new Map();

// --- settings ---
async function loadSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
    return withSettingsDefaults(JSON.parse(raw));
  } catch (err) {
    // Fall back to defaults if file missing.
    return withSettingsDefaults({
      llm: { provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY || '' },
      fileMode: 'copy',
      spendingCapUSD: 5.00,
    });
  }
}

async function saveSettings(s) {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(s, null, 2), 'utf8');
}

// --- API ---
app.get('/api/settings', async (_req, res) => {
  const s = await loadSettings();
  // Never echo the API key back in full — show only a redacted form.
  res.json({
    ...s,
    llm: {
      ...s.llm,
      apiKey: s.llm.apiKey ? `${s.llm.apiKey.slice(0, 6)}…${s.llm.apiKey.slice(-4)}` : '',
      hasKey: !!s.llm.apiKey,
    },
    availableProviders: listProviders(),
    criteriaOptions: CRITERIA_ORDER,
    availableModels: {
      openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
      anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    },
    promptDefaults: DEFAULT_PROMPTS,
    promptSectionDefaults: DEFAULT_PROMPT_SECTIONS,
    promptSectionMeta: PROMPT_SECTION_META,
  });
});

app.post('/api/settings', async (req, res) => {
  const current = await loadSettings();
  const incoming = req.body || {};
  const next = {
    ...current,
    ...incoming,
    llm: { ...current.llm, ...(incoming.llm || {}) },
  };
  // If apiKey was sent as a redacted string, keep the existing one.
  if (next.llm.apiKey && next.llm.apiKey.includes('…')) next.llm.apiKey = current.llm.apiKey;
  await saveSettings(next);
  res.json({ ok: true });
});

app.post('/api/prompts/review', async (req, res) => {
  const { sections } = req.body || {};
  if (!sections || typeof sections !== 'object') {
    return res.status(400).json({ error: 'sections required' });
  }

  const settings = await loadSettings();
  if (!settings.llm.apiKey) {
    return res.status(400).json({ error: 'No API key configured. Open Settings and add one before running AI prompt review.' });
  }

  let llm;
  try {
    llm = createLLM({ ...settings.llm, prompts: settings.prompts });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (typeof llm.reviewPromptSections !== 'function') {
    return res.status(400).json({ error: `${settings.llm.provider} does not support AI prompt review in this build.` });
  }

  try {
    const review = await llm.reviewPromptSections(sections);
    res.json({ ok: true, review });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/folder/check', async (req, res) => {
  const { inputDir } = req.body || {};
  if (!inputDir) return res.status(400).json({ error: 'inputDir required' });
  try {
    const stat = await fs.stat(inputDir);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });
    // Count files for the start-screen preview.
    const { walkFolder } = await import('./lib/walk.js');
    const files = await walkFolder(inputDir);
    const textCount = files.filter(f => f.isTextReadable).length;
    const sizeBytes = files.reduce((s, f) => s + f.size, 0);
    const settings = await loadSettings();
    const estimate = estimateRunCost(files, settings);
    res.json({
      ok: true,
      totalFiles: files.length,
      textReadable: textCount,
      skipped: files.length - textCount,
      sizeBytes,
      estimate,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/runs', async (req, res) => {
  const { inputDir, outputDir, selectedCriteria } = req.body || {};
  if (!inputDir || !outputDir) return res.status(400).json({ error: 'inputDir and outputDir required' });
  const inputPath = path.resolve(inputDir);
  const outputPath = path.resolve(outputDir);
  try {
    await fs.access(inputPath);
  } catch {
    return res.status(400).json({ error: `Input folder not found: ${inputPath}` });
  }

  try {
    const inputStat = await fs.stat(inputPath);
    if (!inputStat.isDirectory()) {
      return res.status(400).json({ error: `Input path is not a directory: ${inputPath}` });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (pathsEqualOrNested(outputPath, inputPath)) {
    return res.status(400).json({
      error: 'Output folder must be outside the source folder. The source directory is read-only and cannot contain generated output.',
    });
  }
  if (pathsEqualOrNested(inputPath, outputPath)) {
    return res.status(400).json({
      error: 'Output folder cannot be a parent of the source folder. Choose a separate destination outside the source tree.',
    });
  }

  const settings = await loadSettings();
  if (!settings.llm.apiKey) return res.status(400).json({ error: 'No API key configured. Open Settings and add one.' });

  let llm;
  try {
    llm = createLLM({ ...settings.llm, prompts: settings.prompts });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let archivedOutputDir = null;
  try {
    archivedOutputDir = await rotateExistingOutput(outputPath);
    await fs.mkdir(outputPath, { recursive: true });
  } catch (err) {
    return res.status(400).json({ error: `Unable to prepare output folder: ${err.message}` });
  }

  const runId = String(Date.now());
  const normalizedCriteria = normalizeSelectedCriteria(selectedCriteria || settings.selectedCriteria);
  const run = {
    id: runId,
    inputDir: inputPath,
    outputDir: outputPath,
    archivedOutputDir,
    selectedCriteria: normalizedCriteria,
    status: 'running',
    events: [],
    summary: null,
    error: null,
    startedAt: new Date().toISOString(),
  };
  runs.set(runId, run);

  // Kick off in background.
  runPipeline({
    inputDir: inputPath, outputDir: outputPath, llm, settings: { ...settings, selectedCriteria: normalizedCriteria },
    onProgress: (ev) => { run.events.push({ ...ev, t: Date.now() }); if (run.events.length > 2000) run.events.shift(); },
  })
  .then(summary => { run.status = 'done'; run.summary = summary; run.finishedAt = new Date().toISOString(); })
  .catch(err => { run.status = 'error'; run.error = err.message; run.finishedAt = new Date().toISOString(); console.error('pipeline error', err); });

  res.json({ runId });
});

app.get('/api/runs/:id', (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'run not found' });
  // Send only the tail of events to keep response small.
  const since = parseInt(req.query.since || '0', 10);
  const events = since > 0 ? run.events.filter(e => e.t > since) : run.events.slice(-50);
  res.json({
    id: run.id,
    status: run.status,
    inputDir: run.inputDir,
    outputDir: run.outputDir,
    archivedOutputDir: run.archivedOutputDir,
    selectedCriteria: run.selectedCriteria,
    error: run.error,
    summary: run.status === 'done' ? run.summary : null,
    events,
    eventCount: run.events.length,
    latestT: run.events.length ? run.events[run.events.length - 1].t : 0,
  });
});

app.get('/api/workspace', async (req, res) => {
  const outputDir = req.query.outputDir ? path.resolve(String(req.query.outputDir)) : '';
  if (!outputDir) return res.status(400).json({ error: 'outputDir required' });
  try {
    const workspace = await loadPetitionWorkspace(outputDir);
    res.json({
      ok: true,
      workspace,
      files: {
        workspace: path.join(outputDir, WORKSPACE_FILENAME),
        plan: path.join(outputDir, PLAN_FILENAME),
      },
    });
  } catch (err) {
    res.status(404).json({ error: `Workspace not found for output folder: ${outputDir}` });
  }
});

app.post('/api/workspace', async (req, res) => {
  const { outputDir, workspace } = req.body || {};
  const resolvedOutputDir = outputDir ? path.resolve(outputDir) : '';
  if (!resolvedOutputDir || !workspace) return res.status(400).json({ error: 'outputDir and workspace required' });
  try {
    const stat = await fs.stat(resolvedOutputDir);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'outputDir is not a directory' });
    const saved = await savePetitionWorkspace(resolvedOutputDir, workspace);
    res.json({
      ok: true,
      workspace: saved,
      files: {
        workspace: path.join(resolvedOutputDir, WORKSPACE_FILENAME),
        plan: path.join(resolvedOutputDir, PLAN_FILENAME),
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Resolve & open paths in the host OS (best-effort, macOS-aware).
app.post('/api/reveal', async (req, res) => {
  const { path: target } = req.body || {};
  if (!target) return res.status(400).json({ error: 'path required' });
  const { exec } = await import('node:child_process');
  const cmd = process.platform === 'darwin' ? `open "${target.replace(/"/g, '\\"')}"`
            : process.platform === 'win32'  ? `start "" "${target}"`
                                            : `xdg-open "${target}"`;
  exec(cmd, (err) => err ? res.status(500).json({ error: err.message }) : res.json({ ok: true }));
});

app.listen(PORT, () => {
  console.log(`\n  EB1A DocAssistant — http://localhost:${PORT}\n`);
});

function estimateRunCost(files, llmSettings = {}) {
  const pricing = getModelPricing(llmSettings.llm?.model || llmSettings.model);
  const textFiles = files.filter(f => f.isTextReadable);
  const referenceFiles = files.length - textFiles.length;
  const modeInfo = resolveProcessingMode(llmSettings, textFiles.length);
  const estimatedInputTokens = textFiles.reduce((sum, file) => {
    return sum + ESTIMATE_BASE_INPUT_TOKENS + ESTIMATE_FILENAME_TOKENS + estimateBodyTokens(file);
  }, 0);
  const estimatedOutputTokens = textFiles.length * ESTIMATE_OUTPUT_TOKENS;
  const baseCost = pricing
    ? ((estimatedInputTokens / 1_000_000) * pricing.inputPer1M) + ((estimatedOutputTokens / 1_000_000) * pricing.outputPer1M)
    : null;
  const estimatedCostUSD = baseCost == null
    ? null
    : modeInfo.resolvedMode === 'batch'
      ? baseCost * 0.5
      : baseCost;

  return {
    provider: llmSettings.llm?.provider || llmSettings.provider || 'openai',
    model: llmSettings.llm?.model || llmSettings.model || 'gpt-4o-mini',
    readableFiles: textFiles.length,
    referenceFiles,
    configuredMode: modeInfo.configuredMode,
    resolvedMode: modeInfo.resolvedMode,
    batchEligible: modeInfo.batchEligible,
    batchThresholdFiles: modeInfo.batchThresholdFiles,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
    estimatedCostUSD,
    estimatedMinutes: modeInfo.resolvedMode === 'batch' ? null : estimateRunMinutes(textFiles.length, referenceFiles),
    basis: modeInfo.resolvedMode === 'batch'
      ? 'Approximate total based on compact extraction plus OpenAI Batch API 50% pricing.'
      : 'Approximate total based on compact extraction size and readable file count.',
  };
}

function estimateBodyTokens(file) {
  const size = Math.max(0, file.size || 0);
  const multiplier = bodyCharMultiplier(file.ext);
  const estimatedChars = Math.min(3200, Math.round(size * multiplier));
  return Math.ceil(estimatedChars / ESTIMATE_CHARS_PER_TOKEN);
}

function bodyCharMultiplier(ext) {
  if (ext === '.pdf') return 2.4;
  if (ext === '.docx') return 2.0;
  if (ext === '.htm' || ext === '.html') return 1.2;
  if (ext === '.eml') return 1.1;
  return 1.0;
}

function estimateRunMinutes(textReadable, referenceFiles) {
  const seconds = (textReadable * 4.5) + (referenceFiles * 0.2) + 8;
  return Math.max(0.5, Math.round((seconds / 60) * 10) / 10);
}

function withSettingsDefaults(settings) {
  const safeSettings = settings || {};
  const selectedCriteria = normalizeSelectedCriteria(safeSettings.selectedCriteria);
  return {
    fileMode: 'copy',
    spendingCapUSD: 5.00,
    processingMode: 'auto',
    batchThresholdFiles: 75,
    selectedCriteria,
    prompts: DEFAULT_PROMPTS,
    ...safeSettings,
    llm: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY || '',
      ...(safeSettings.llm || {}),
    },
    prompts: resolvePrompts(safeSettings.prompts || {}),
  };
}

function resolveProcessingMode(settings, readableFiles) {
  const configuredMode = settings.processingMode || 'auto';
  const batchThresholdFiles = Number(settings.batchThresholdFiles) > 0 ? Number(settings.batchThresholdFiles) : 75;
  const batchEligible = readableFiles >= batchThresholdFiles;
  const resolvedMode = configuredMode === 'auto'
    ? (batchEligible ? 'batch' : 'standard')
    : configuredMode;
  return { configuredMode, resolvedMode, batchEligible, batchThresholdFiles };
}

async function rotateExistingOutput(outputPath) {
  try {
    await fs.access(outputPath);
  } catch {
    return null;
  }

  const parsed = path.parse(outputPath);
  const stamp = formatTimestamp(new Date());
  let archivedPath = path.join(parsed.dir, `${parsed.name}_${stamp}${parsed.ext || ''}`);
  let n = 1;
  while (true) {
    try {
      await fs.access(archivedPath);
      archivedPath = path.join(parsed.dir, `${parsed.name}_${stamp}_${n}${parsed.ext || ''}`);
      n++;
    } catch {
      break;
    }
  }

  await fs.rename(outputPath, archivedPath);
  return archivedPath;
}

function formatTimestamp(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function pathsEqualOrNested(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
