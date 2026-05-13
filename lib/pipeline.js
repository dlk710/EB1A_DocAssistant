import fs from 'node:fs/promises';
import path from 'node:path';
import { walkFolder } from './walk.js';
import { sha256File } from './hash.js';
import { extractText, buildClassificationExcerpt } from './extract.js';
import { writeIndexFiles } from './index-md.js';
import { writeAuditCsv } from './audit.js';
import { buildPetitionWorkspace, savePetitionWorkspace } from './petition-workspace.js';
import { buildProjectRegistry, buildClassificationProjectContext, enforceProjectScope } from './project-forms.js';
import { buildCriteriaScopeContext, enforceSelectedCriteria, normalizeSelectedCriteria } from './criteria.js';

const FOLDER_NAME_BY_CRIT = {
  '01 — Awards & Recognition':   '01 — Awards & Recognition',
  '02 — Memberships':            '02 — Memberships',
  '03 — Published Material':     '03 — Published Material',
  '04 — Judging':                '04 — Judging',
  '05 — Original Contributions': '05 — Original Contributions',
  '06 — Authorship':             '06 — Authorship',
  '07 — Exhibitions':            '07 — Exhibitions',
  '08 — Leading Critical Role':  '08 — Leading Critical Role',
  '09 — High Salary':            '09 — High Salary',
  '10 — Commercial Success':     '10 — Commercial Success',
  '11 — Comparable Evidence':    '11 — Comparable Evidence',
  'CLEANUP':                     'CLEANUP',
  '_Unclassified':               '_Unclassified',
};

function safeFolderName(s) {
  // Replace characters that are problematic in folder names on macOS/Windows.
  return s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function eventFolderName(c) {
  if (!c.event_title) return null;
  const title = safeFolderName(c.event_title);
  if (c.event_date) return `${title} — ${safeFolderName(c.event_date)}`;
  return title;
}

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }

async function copyFileWithVerify(src, dest, sourceHash) {
  await ensureDir(path.dirname(dest));
  // If the destination already exists, append a numeric suffix.
  let finalDest = dest;
  let n = 1;
  while (true) {
    try {
      await fs.access(finalDest);
      const ext = path.extname(dest);
      const base = dest.slice(0, -ext.length);
      finalDest = `${base} (${n})${ext}`;
      n++;
    } catch { break; }
  }
  await fs.copyFile(src, finalDest);
  const writtenHash = await sha256File(finalDest);
  if (writtenHash !== sourceHash) {
    throw new Error(`Integrity error copying ${src} → ${finalDest}: hash mismatch.`);
  }
  return finalDest;
}

/**
 * Run the full pipeline.
 *  @param {Object} opts
 *  @param {string} opts.inputDir
 *  @param {string} opts.outputDir
 *  @param {object} opts.llm    - provider returned by createLLM()
 *  @param {object} opts.settings
 *  @param {(p:object)=>void} opts.onProgress
 */
export async function runPipeline({ inputDir, outputDir, llm, settings, onProgress }) {
  const emit = onProgress || (() => {});
  const selectedCriteria = normalizeSelectedCriteria(settings.selectedCriteria);

  // 1. Scan input folder
  emit({ phase: 'scan', message: 'Counting files in input folder…' });
  const files = await walkFolder(inputDir);
  emit({ phase: 'scan', message: `Found ${files.length} files.`, totalFiles: files.length });

  // 2. Hash for duplicate detection + integrity
  emit({ phase: 'hash', message: 'Hashing files for duplicate detection…' });
  for (let i = 0; i < files.length; i++) {
    files[i].hash = await sha256File(files[i].absPath);
    emit({ phase: 'hash', message: `Hashed ${i + 1} of ${files.length}`, done: i + 1, total: files.length });
  }

  // 3. Group by hash to identify duplicates
  const byHash = new Map();
  for (const f of files) {
    if (!byHash.has(f.hash)) byHash.set(f.hash, []);
    byHash.get(f.hash).push(f);
  }
  const primaries = [];   // first occurrence of each hash
  const duplicates = [];  // additional copies
  for (const group of byHash.values()) {
    primaries.push(group[0]);
    for (let i = 1; i < group.length; i++) duplicates.push({ ...group[i], primaryOf: group[0] });
  }
  const dupGroupCount = [...byHash.values()].filter(g => g.length > 1).length;
  emit({
    phase: 'hash',
    message: `Found ${dupGroupCount} duplicate group${dupGroupCount === 1 ? '' : 's'} (${duplicates.length} extra files).`,
    duplicates: duplicates.length,
    uniqueFiles: primaries.length,
  });

  // 4. Classify each text-readable primary file
  const toClassify = primaries.filter(f => f.isTextReadable);
  const referenceFiles = primaries.filter(f => !f.isTextReadable);
  emit({
    phase: 'classify',
    message: `Classifying ${toClassify.length} text-readable files. ${referenceFiles.length} non-text files will be copied to _Reference/.`,
    toClassify: toClassify.length,
    reference: referenceFiles.length,
  });

  const prepared = [];
  emit({ phase: 'extract', message: 'Preparing compact evidence excerpts…', done: 0, total: toClassify.length });
  for (let i = 0; i < toClassify.length; i++) {
    const file = toClassify[i];
    const rawText = await extractText(file.absPath);
    const text = buildClassificationExcerpt(rawText);
    prepared.push({ file, text, rawText });
    emit({
      phase: 'extract',
      message: `Prepared ${i + 1} of ${toClassify.length} files for classification`,
      done: i + 1,
      total: toClassify.length,
    });
  }

  const projectRegistry = buildProjectRegistry(prepared);
  const projectContextText = buildClassificationProjectContext(projectRegistry);
  const criteriaContextText = buildCriteriaScopeContext(selectedCriteria);
  emit({
    phase: 'extract',
    message: projectRegistry.forms.length
      ? `Detected ${projectRegistry.forms.length} project template form${projectRegistry.forms.length === 1 ? '' : 's'} to scope Original Contributions and Leading/Critical Role evidence.`
      : 'No project template forms detected for Original Contributions or Leading/Critical Role scoping.',
    forms: projectRegistry.forms.length,
  });

  const mode = resolveProcessingMode(settings, prepared.length, llm);
  emit({
    phase: mode === 'batch' ? 'batch' : 'classify',
    message: mode === 'batch'
      ? `Batch mode enabled for ${prepared.length} files. Lower cost, but OpenAI may take longer to finish.`
      : `Standard mode enabled for ${prepared.length} files.`,
    done: 0,
    total: prepared.length,
  });

  const classified = mode === 'batch'
    ? await classifyInBatch(prepared, llm, emit, { projectRegistry, projectContextText, criteriaContextText, selectedCriteria })
    : await classifyOneByOne(prepared, llm, emit, { projectRegistry, projectContextText, criteriaContextText, selectedCriteria });

  // 5. Copy files to organized output
  emit({ phase: 'copy', message: 'Copying files into organized folders…' });
  await ensureDir(outputDir);
  const audit = [];

  // 5a. Classified files → criterion/event/file
  for (const { file, result } of classified) {
    const critFolder = FOLDER_NAME_BY_CRIT[result.criterion] || '_Unclassified';
    const evtFolder = eventFolderName(result);
    const destDir = evtFolder ? path.join(outputDir, critFolder, evtFolder) : path.join(outputDir, critFolder);
    const destPath = path.join(destDir, file.name);
    const finalDest = await copyFileWithVerify(file.absPath, destPath, file.hash);
    audit.push({
      original: file.relPath,
      destination: path.relative(outputDir, finalDest),
      type: result.criterion === 'CLEANUP' ? 'Cleanup' : result.criterion === '_Unclassified' ? 'Unclassified' : 'Classified',
      hash: file.hash,
      criterion: result.criterion,
      secondary_criterion: result.secondary_criterion || null,
      event: result.event_title || null,
      event_date: result.event_date || null,
      event_id: result.event_id || null,
      event_summary: result.event_summary || null,
      evidence_type: result.evidence_type || null,
      matched_project: result.matched_project || null,
      confidence: result.confidence,
      reason: result.reason,
      notes: result.notes || null,
      is_letter: !!result.is_letter,
      letter_type: result.letter_type || null,
      signer_name: result.signer_name || null,
      signer_title: result.signer_title || null,
    });
  }

  // 5b. Non-text files → _Reference (mirror their subfolder structure)
  for (const file of referenceFiles) {
    const destPath = path.join(outputDir, '_Reference', file.relPath);
    const finalDest = await copyFileWithVerify(file.absPath, destPath, file.hash);
    audit.push({
      original: file.relPath,
      destination: path.relative(outputDir, finalDest),
      type: 'Reference',
      hash: file.hash,
      criterion: null, event: null, event_date: null,
      secondary_criterion: null, event_id: null, event_summary: null, evidence_type: null, matched_project: null,
      confidence: null, reason: 'Non-text file — copied untouched, not analyzed.',
      notes: null,
      is_letter: false, letter_type: null, signer_name: null, signer_title: null,
    });
  }

  // 5c. Duplicates → _Duplicates/group-NN
  let groupNum = 0;
  const groupIndex = new Map(); // hash → groupNum
  for (const dup of duplicates) {
    if (!groupIndex.has(dup.hash)) {
      groupNum++;
      groupIndex.set(dup.hash, groupNum);
    }
    const gn = groupIndex.get(dup.hash);
    const groupDir = path.join(outputDir, '_Duplicates', `group-${String(gn).padStart(3, '0')}`);
    const destPath = path.join(groupDir, dup.name);
    const finalDest = await copyFileWithVerify(dup.absPath, destPath, dup.hash);
    audit.push({
      original: dup.relPath,
      destination: path.relative(outputDir, finalDest),
      type: 'Duplicate',
      hash: dup.hash,
      criterion: null, event: null, event_date: null,
      secondary_criterion: null, event_id: null, event_summary: null, evidence_type: null, matched_project: null,
      confidence: null, reason: `Duplicate of ${dup.primaryOf.relPath}`,
      notes: null,
      is_letter: false, letter_type: null, signer_name: null, signer_title: null,
    });
  }

  // 6. Write index files
  emit({ phase: 'index', message: 'Generating _index.md, _exhibit_list.md, and audit log…' });
  await writeIndexFiles({ outputDir, inputDir, classified, referenceFiles, duplicates, llm, projectRegistry, selectedCriteria });
  await writeAuditCsv(outputDir, audit);

  // 7. Save petition-building workspace metadata
  emit({ phase: 'index', message: 'Saving petition workspace metadata for later review…' });
  const petitionWorkspace = buildPetitionWorkspace({ outputDir, audit });
  await savePetitionWorkspace(outputDir, petitionWorkspace);

  // 8. Done
  const summary = buildSummary({ files, classified, referenceFiles, duplicates, audit, llm, projectRegistry, selectedCriteria });
  emit({ phase: 'done', message: 'Organization complete.', summary });
  return summary;
}

async function classifyOneByOne(prepared, llm, emit, context = {}) {
  const classified = [];
  for (let i = 0; i < prepared.length; i++) {
    const { file, text, rawText } = prepared[i];
    try {
      const result = isCleanupFile(file.name)
        ? cleanupResult()
        : text.length > 0
        ? enforceSelectedCriteria(
            enforceProjectScope(
              await llm.classify(text, file.name, { extraContext: [context.criteriaContextText, context.projectContextText].filter(Boolean).join('\n\n') }),
              rawText,
              context.projectRegistry,
            ),
            context.selectedCriteria,
          )
        : unclassifiedFallback('Empty file content');
      classified.push({ file, result });
      emit({
        phase: 'classify',
        message: `${file.name} → ${result.criterion}`,
        file: file.name,
        criterion: result.criterion,
        confidence: result.confidence,
        done: i + 1,
        total: prepared.length,
        cost: llm.estimateCostUSD?.() ?? 0,
      });
    } catch (err) {
      if (err?.unrecoverable) throw err;
      const result = unclassifiedFallback(`Classification failed: ${err.message}`);
      classified.push({ file, result });
      emit({
        phase: 'classify',
        message: `${file.name} → error (${err.message})`,
        error: true,
        done: i + 1,
        total: prepared.length,
      });
    }
  }
  return classified;
}

async function classifyInBatch(prepared, llm, emit, context = {}) {
  const outputs = await llm.classifyBatch(
    prepared.map(item => isCleanupFile(item.file.name)
      ? null
      : ({ filename: item.file.name, text: item.text, context: { extraContext: [context.criteriaContextText, context.projectContextText].filter(Boolean).join('\n\n') } })),
    { onProgress: ev => emit(ev) },
  );
  const classified = [];
  for (let i = 0; i < prepared.length; i++) {
    const { file, rawText } = prepared[i];
    if (isCleanupFile(file.name)) {
      const result = cleanupResult();
      classified.push({ file, result });
      emit({
        phase: 'classify',
        message: `${file.name} → CLEANUP`,
        file: file.name,
        criterion: result.criterion,
        confidence: result.confidence,
        done: i + 1,
        total: prepared.length,
        cost: llm.estimateCostUSD?.() ?? 0,
      });
      continue;
    }
    const out = outputs[i];
    if (out?.result) {
      const result = enforceSelectedCriteria(enforceProjectScope(out.result, rawText, context.projectRegistry), context.selectedCriteria);
      classified.push({ file, result });
      emit({
        phase: 'classify',
        message: `${file.name} → ${result.criterion}`,
        file: file.name,
        criterion: result.criterion,
        confidence: result.confidence,
        done: i + 1,
        total: prepared.length,
        cost: llm.estimateCostUSD?.() ?? 0,
      });
      continue;
    }
    const err = out?.error || new Error('Unknown batch classification error');
    const result = unclassifiedFallback(`Classification failed: ${err.message}`);
    classified.push({ file, result });
    emit({
      phase: 'classify',
      message: `${file.name} → error (${err.message})`,
      error: true,
      done: i + 1,
      total: prepared.length,
    });
  }
  return classified;
}

function resolveProcessingMode(settings = {}, readableFiles, llm) {
  const configured = settings.processingMode || 'auto';
  const threshold = Number(settings.batchThresholdFiles) > 0 ? Number(settings.batchThresholdFiles) : 75;
  if (configured === 'batch' && llm.supportsBatch?.()) return 'batch';
  if (configured === 'auto' && llm.supportsBatch?.() && readableFiles >= threshold) return 'batch';
  return 'standard';
}

function unclassifiedFallback(reason) {
  return {
    criterion: '_Unclassified',
    confidence: 'LOW',
    reason,
    event_title: null,
    event_date: null,
    event_id: null,
    event_summary: null,
    secondary_criterion: null,
    evidence_type: null,
    matched_project: null,
    notes: null,
    is_letter: false,
    letter_type: null,
    signer_name: null,
    signer_title: null,
  };
}

function cleanupResult() {
  return {
    criterion: 'CLEANUP',
    confidence: 'HIGH',
    reason: 'Filename contains REMOVE or DELETE, so it was routed to CLEANUP automatically.',
    event_title: null,
    event_date: null,
    event_id: null,
    event_summary: null,
    secondary_criterion: null,
    evidence_type: null,
    matched_project: null,
    notes: 'System cleanup rule applied from filename.',
    is_letter: false,
    letter_type: null,
    signer_name: null,
    signer_title: null,
  };
}

function isCleanupFile(filename = '') {
  return /(?:remove|delete)/i.test(filename);
}

function buildSummary({ files, classified, referenceFiles, duplicates, audit, llm, projectRegistry, selectedCriteria }) {
  // Bucket counts
  const buckets = {};
  for (const c of classified) {
    buckets[c.result.criterion] = (buckets[c.result.criterion] || 0) + 1;
  }

  // Letters
  const letters = classified.filter(c => c.result.is_letter);
  const independent = letters.filter(c => c.result.letter_type === 'independent');
  const dependent   = letters.filter(c => c.result.letter_type === 'dependent');
  const citation    = letters.filter(c => c.result.letter_type === 'citation');

  // Events per criterion
  const events = {}; // criterion → Map<eventKey, files[]>
  for (const c of classified) {
    const crit = c.result.criterion;
    if (crit === 'CLEANUP') continue;
    const key = c.result.event_title ? `${c.result.event_title}|${c.result.event_date || ''}` : null;
    if (!key) continue;
    if (!events[crit]) events[crit] = new Map();
    if (!events[crit].has(key)) {
      events[crit].set(key, { title: c.result.event_title, date: c.result.event_date, files: [] });
    }
    events[crit].get(key).files.push(c);
  }

  const eventCountTotal = Object.values(events).reduce((sum, m) => sum + m.size, 0);
  const criteriaWithEvidence = Object.keys(buckets).filter(k => !k.startsWith('_') && k !== 'CLEANUP').length;

  return {
    counts: {
      inputFiles: files.length,
      outputFiles: audit.length,
      classified: classified.filter(c => c.result.criterion !== '_Unclassified' && c.result.criterion !== 'CLEANUP').length,
      cleanup: classified.filter(c => c.result.criterion === 'CLEANUP').length,
      unclassified: classified.filter(c => c.result.criterion === '_Unclassified').length,
      reference: referenceFiles.length,
      duplicates: duplicates.length,
      duplicateGroups: new Set(duplicates.map(d => d.hash)).size,
      events: eventCountTotal,
      criteriaWithEvidence,
    },
    letters: {
      total: letters.length,
      independent: independent.length,
      dependent: dependent.length,
      citation: citation.length,
    },
    buckets,
    events: serializeEvents(events),
    llmStats: llm.stats?.() || null,
    projectScope: {
      forms: projectRegistry?.forms || [],
      originalContributionProjects: projectRegistry?.originalContributionProjects || [],
      leadingCriticalRoleProjects: projectRegistry?.leadingCriticalRoleProjects || [],
    },
    selectedCriteria,
    audit,
  };
}

function serializeEvents(events) {
  const out = {};
  for (const [crit, map] of Object.entries(events)) {
    out[crit] = [];
    for (const ev of map.values()) {
      out[crit].push({
        title: ev.title,
        date: ev.date,
        fileCount: ev.files.length,
        files: ev.files.map(c => ({
          name: c.file.name,
          relPath: c.file.relPath,
          confidence: c.result.confidence,
          reason: c.result.reason,
          event_id: c.result.event_id || null,
          event_summary: c.result.event_summary || null,
          evidence_type: c.result.evidence_type || null,
          matched_project: c.result.matched_project || null,
          secondary_criterion: c.result.secondary_criterion || null,
          notes: c.result.notes || null,
          is_letter: !!c.result.is_letter,
          letter_type: c.result.letter_type,
          signer_name: c.result.signer_name,
          signer_title: c.result.signer_title,
        })),
      });
    }
  }
  return out;
}
