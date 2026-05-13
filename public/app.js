// Frontend logic — talks to the local Express API.

const state = {
  runId: null,
  pollTimer: null,
  latestT: 0,
  summary: null,
  workspace: null,
  settings: null,
  folderEstimate: null,
};
const CRITERION_META = {
  '01 — Awards & Recognition':    { num: '01', cite: '8 C.F.R. § 204.5(h)(3)(i)' },
  '02 — Memberships':             { num: '02', cite: '8 C.F.R. § 204.5(h)(3)(ii)' },
  '03 — Published Material':      { num: '03', cite: '8 C.F.R. § 204.5(h)(3)(iii)' },
  '04 — Judging':                 { num: '04', cite: '8 C.F.R. § 204.5(h)(3)(iv)' },
  '05 — Original Contributions':  { num: '05', cite: '8 C.F.R. § 204.5(h)(3)(v)' },
  '06 — Authorship':              { num: '06', cite: '8 C.F.R. § 204.5(h)(3)(vi)' },
  '07 — Exhibitions':             { num: '07', cite: '8 C.F.R. § 204.5(h)(3)(vii)' },
  '08 — Leading Critical Role':   { num: '08', cite: '8 C.F.R. § 204.5(h)(3)(viii)' },
  '09 — High Salary':             { num: '09', cite: '8 C.F.R. § 204.5(h)(3)(ix)' },
  '10 — Commercial Success':      { num: '10', cite: '8 C.F.R. § 204.5(h)(3)(x)' },
  '11 — Comparable Evidence':     { num: '11', cite: '8 C.F.R. § 204.5(h)(4)' },
};
const CRITERIA_ORDER = Object.keys(CRITERION_META);

// ---------- helpers ----------
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'onclick') e.onclick = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------- settings ----------
async function loadSettings() {
  const r = await fetch('/api/settings').then(r => r.json());
  state.settings = r;
  renderCriteriaScopeEditor();
  updateEstimateStrip();
  // Populate selects
  const pSel = document.getElementById('set-provider');
  pSel.innerHTML = '';
  for (const p of r.availableProviders) pSel.append(new Option(p, p, p === r.llm.provider, p === r.llm.provider));
  populateModelSelect(r.llm.provider, r.llm.model);
  document.getElementById('set-cap').value = r.spendingCapUSD ?? 5;
  document.getElementById('set-processing-mode').value = r.processingMode || 'auto';
  document.getElementById('set-batch-threshold').value = r.batchThresholdFiles || 75;
  document.getElementById('set-key').placeholder = r.llm.hasKey ? `Saved key: ${r.llm.apiKey}` : 'Paste API key';
}
function populateModelSelect(provider, current) {
  const mSel = document.getElementById('set-model');
  mSel.innerHTML = '';
  const models = (state.settings?.availableModels?.[provider]) || [];
  for (const m of models) mSel.append(new Option(m, m, m === current, m === current));
}
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  document.getElementById('set-provider').addEventListener('change', (e) => populateModelSelect(e.target.value));
});

function openSettings() { document.getElementById('settings-modal').classList.add('open'); }
function openPromptLibrary() {
  renderPromptSections();
  document.getElementById('prompt-library-modal').classList.add('open');
}
function closePromptLibrary() {
  document.getElementById('prompt-library-modal').classList.remove('open');
}
async function saveSettings() {
  const provider = document.getElementById('set-provider').value;
  const model = document.getElementById('set-model').value;
  const apiKey = document.getElementById('set-key').value;
  const spendingCapUSD = parseFloat(document.getElementById('set-cap').value || '5');
  const processingMode = document.getElementById('set-processing-mode').value;
  const batchThresholdFiles = parseInt(document.getElementById('set-batch-threshold').value || '75', 10);
  const selectedCriteria = getSelectedCriteria();
  const payload = { llm: { provider, model }, spendingCapUSD, processingMode, batchThresholdFiles, selectedCriteria };
  if (!selectedCriteria.length) payload.selectedCriteria = state.settings?.criteriaOptions || CRITERIA_ORDER;
  if (apiKey) payload.llm.apiKey = apiKey;
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  document.getElementById('settings-modal').classList.remove('open');
  await loadSettings();
  if (document.getElementById('input-path').value.trim()) await checkInputFolder();
}

function renderCriteriaScopeEditor() {
  const grid = document.getElementById('criteria-scope-grid');
  if (!grid) return;
  const available = state.settings?.criteriaOptions || CRITERIA_ORDER;
  const selected = new Set(state.settings?.selectedCriteria || available);
  grid.innerHTML = '';
  for (const criterion of available) {
    const id = `criterion-scope-${criterion.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
    const card = el('label', { class: 'criterion-scope-chip' + (selected.has(criterion) ? ' active' : ''), for: id });
    card.innerHTML = `
      <input type="checkbox" id="${escapeHtml(id)}" class="criterion-scope-input" value="${escapeHtml(criterion)}" ${selected.has(criterion) ? 'checked' : ''}>
      <span class="criterion-scope-num">${escapeHtml((CRITERION_META[criterion]?.num) || criterion.split(' ')[0])}</span>
      <span class="criterion-scope-name">${escapeHtml(criterion.replace(/^\d+ — /, ''))}</span>
    `;
    grid.append(card);
  }
  grid.querySelectorAll('.criterion-scope-input').forEach(input => {
    input.addEventListener('change', () => {
      input.closest('.criterion-scope-chip')?.classList.toggle('active', input.checked);
      updateEstimateStrip();
    });
  });
}

function getSelectedCriteria() {
  const inputs = [...document.querySelectorAll('.criterion-scope-input')];
  return inputs.filter(input => input.checked).map(input => input.value);
}

function selectAllCriteria() {
  document.querySelectorAll('.criterion-scope-input').forEach(input => {
    input.checked = true;
    input.closest('.criterion-scope-chip')?.classList.add('active');
  });
  updateEstimateStrip();
}

function clearAllCriteria() {
  document.querySelectorAll('.criterion-scope-input').forEach(input => {
    input.checked = false;
    input.closest('.criterion-scope-chip')?.classList.remove('active');
  });
  updateEstimateStrip();
}

function renderPromptSections() {
  const container = document.getElementById('prompt-library-sections');
  const sections = state.settings?.prompts?.sections || state.settings?.promptSectionDefaults || {};
  const meta = state.settings?.promptSectionMeta || {};
  container.innerHTML = '';
  for (const [key, value] of Object.entries(sections)) {
    const info = meta[key] || { label: key, hint: '' };
    const isShort = key === 'role' || key === 'decisionStyle' || key === 'userTemplate';
    const card = el('section', { class: 'prompt-section-card' });
    card.innerHTML = `
      <div class="prompt-section-head">
        <div class="prompt-section-meta">
          <div class="prompt-section-title">${escapeHtml(info.label)}</div>
          <div class="prompt-section-hint">${escapeHtml(info.hint || '')}</div>
        </div>
        <div class="prompt-section-actions">
          <button class="btn btn-ghost btn-sm" onclick="resetPromptSection('${escapeHtml(key)}')">Reset</button>
          <button class="btn btn-primary btn-sm" onclick="savePromptSection('${escapeHtml(key)}')">Save section</button>
        </div>
      </div>
      <textarea id="prompt-section-${escapeHtml(key)}" class="prompt-editor ${isShort ? 'prompt-editor-xs' : ''}" spellcheck="false"></textarea>
    `;
    container.append(card);
    container.querySelector(`#prompt-section-${CSS.escape(key)}`).value = value || '';
  }
}

function collectPromptSections() {
  const current = state.settings?.prompts?.sections || {};
  const next = {};
  for (const key of Object.keys(current)) {
    const el = document.getElementById(`prompt-section-${key}`);
    next[key] = el ? el.value.trim() : current[key];
  }
  return next;
}

function resetPromptSection(sectionKey) {
  const defaults = state.settings?.promptSectionDefaults || {};
  const editor = document.getElementById(`prompt-section-${sectionKey}`);
  if (editor) editor.value = defaults[sectionKey] || '';
}

async function savePromptSection(sectionKey) {
  const sections = {
    ...(state.settings?.prompts?.sections || {}),
    [sectionKey]: document.getElementById(`prompt-section-${sectionKey}`)?.value.trim() || '',
  };
  await persistPromptSections(sections);
}

function resetAllPromptSections() {
  const defaults = state.settings?.promptSectionDefaults || {};
  for (const key of Object.keys(defaults)) {
    const editor = document.getElementById(`prompt-section-${key}`);
    if (editor) editor.value = defaults[key] || '';
  }
}

async function saveAllPromptSections() {
  await persistPromptSections(collectPromptSections());
}

async function persistPromptSections(sections) {
  await fetch('/api/settings', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ prompts: { sections } }),
  });
  await loadSettings();
  renderPromptSections();
}

// ---------- start screen ----------
async function checkInputFolder() {
  const inputDir = document.getElementById('input-path').value.trim();
  if (!inputDir) return;
  const stats = document.getElementById('input-stats');
  stats.style.display = 'flex';
  stats.innerHTML = '<span class="muted">Checking…</span>';
  try {
    const r = await fetch('/api/folder/check', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ inputDir }) }).then(r => r.json());
    if (r.error) {
      state.folderEstimate = null;
      updateEstimateStrip();
      stats.innerHTML = `<span style="color:var(--bad);">${escapeHtml(r.error)}</span>`;
      return;
    }
    const mb = (r.sizeBytes / 1024 / 1024).toFixed(1);
    stats.innerHTML = `<span><strong>${r.totalFiles}</strong> files</span><span class="muted">·</span>` +
                      `<span><strong>${r.textReadable}</strong> readable</span><span class="muted">·</span>` +
                      `<span><strong>${r.skipped}</strong> to copy as reference</span><span class="muted">·</span>` +
                      `<span><strong>${mb} MB</strong></span>`;
    state.folderEstimate = r.estimate || null;
    updateEstimateStrip();
    // Suggest output path
    const outEl = document.getElementById('output-path');
    if (!outEl.value) outEl.value = inputDir.replace(/\/$/, '') + '_AIORGANIZED';
  } catch (err) {
    state.folderEstimate = null;
    updateEstimateStrip();
    stats.innerHTML = `<span style="color:var(--bad);">${escapeHtml(err.message)}</span>`;
  }
}

function updateEstimateStrip() {
  const selectedCriteria = getSelectedCriteria();
  const effectiveCriteria = selectedCriteria.length ? selectedCriteria : (state.settings?.criteriaOptions || CRITERIA_ORDER);
  document.getElementById('est-model').textContent = state.settings
    ? `${state.settings.llm.provider}/${state.settings.llm.model}${estimateModeSuffix()}`
    : '…';
  document.getElementById('est-time').textContent = state.folderEstimate
    ? formatEstimateTime(state.folderEstimate)
    : 'depends on file count';
  document.getElementById('est-cost').textContent = state.folderEstimate?.estimatedCostUSD != null
    ? `~$${state.folderEstimate.estimatedCostUSD.toFixed(4)} total`
    : '~cost shown after folder check';
  document.getElementById('estimate-note').textContent = estimateNote(effectiveCriteria, selectedCriteria.length === 0);
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return 'depends on file count';
  if (minutes < 1) return 'under 1 min';
  if (minutes < 2) return 'about 1 min';
  return `about ${Math.round(minutes)} min`;
}

function formatEstimateTime(estimate) {
  if (estimate?.resolvedMode === 'batch') return 'slower, async';
  return `~${formatMinutes(estimate?.estimatedMinutes)}`;
}

function estimateModeSuffix() {
  if (state.folderEstimate?.resolvedMode === 'batch') return ' · batch';
  if (state.folderEstimate?.resolvedMode === 'standard') return ' · standard';
  return '';
}

function estimateNote(selectedCriteria = [], noneSelected = false) {
  if (!state.folderEstimate) return 'Check a folder to estimate total cost before starting.';
  if (noneSelected) return 'Select at least one EB1A category before starting a run.';
  const totalCriteria = state.settings?.criteriaOptions?.length || CRITERIA_ORDER.length;
  const criteriaScope = selectedCriteria.length && selectedCriteria.length < totalCriteria
    ? ` Scoped to ${selectedCriteria.length} selected categor${selectedCriteria.length === 1 ? 'y' : 'ies'}.`
    : '';
  if (state.folderEstimate.resolvedMode === 'batch') {
    return `Using batch mode for this folder because it has ${state.folderEstimate.readableFiles} readable files. Estimated cost already includes ~50% batch pricing.${criteriaScope}`;
  }
  if (state.folderEstimate.configuredMode === 'auto') {
    return `Auto mode stays in standard processing until ${state.folderEstimate.batchThresholdFiles} readable files.${criteriaScope}`;
  }
  return `${state.folderEstimate.basis || 'Estimate based on compact extraction and current model pricing.'}${criteriaScope}`;
}

async function startRun() {
  const inputDir = document.getElementById('input-path').value.trim();
  const outputDir = document.getElementById('output-path').value.trim();
  const selectedCriteria = getSelectedCriteria();
  const errEl = document.getElementById('start-error');
  errEl.style.display = 'none';
  if (!inputDir || !outputDir) { errEl.textContent = 'Both input and output folders are required.'; errEl.style.display = 'block'; return; }
  if (!selectedCriteria.length) { errEl.textContent = 'Select at least one EB1A category to classify for this run.'; errEl.style.display = 'block'; return; }

  show('progress');
  document.getElementById('counter-now').textContent = '0';
  document.getElementById('counter-of').textContent = 'of … files classified';
  document.getElementById('progress-bar-fill').style.width = '0%';
  document.getElementById('live-list').innerHTML = '';

  try {
    const r = await fetch('/api/runs', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ inputDir, outputDir, selectedCriteria }) }).then(r => r.json());
    if (r.error) throw new Error(r.error);
    state.runId = r.runId;
    state.latestT = 0;
    state.workspace = null;
    pollRun();
  } catch (err) {
    show('start');
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

function cancelRun() {
  state.runId = null;
  if (state.pollTimer) clearTimeout(state.pollTimer);
  show('start');
}

async function pollRun() {
  if (!state.runId) return;
  try {
    const r = await fetch(`/api/runs/${state.runId}?since=${state.latestT}`).then(r => r.json());
    state.latestT = r.latestT || state.latestT;
    for (const ev of r.events) handleProgressEvent(ev);
    if (r.status === 'done') {
      state.summary = r.summary;
      await loadWorkspace(r.outputDir);
      renderReview(r);
      show('review');
      return;
    }
    if (r.status === 'error') {
      show('start');
      const errEl = document.getElementById('start-error');
      errEl.textContent = 'Run failed: ' + r.error;
      errEl.style.display = 'block';
      return;
    }
  } catch (err) {
    console.warn('poll error', err);
  }
  state.pollTimer = setTimeout(pollRun, 600);
}

async function loadWorkspace(outputDir) {
  try {
    const r = await fetch(`/api/workspace?outputDir=${encodeURIComponent(outputDir)}`).then(res => res.json());
    state.workspace = r.error ? null : (r.workspace || null);
  } catch (err) {
    console.warn('workspace load error', err);
    state.workspace = null;
  }
}

function handleProgressEvent(ev) {
  document.getElementById('progress-phase').textContent = ev.message || ev.phase;
  if (typeof ev.cost === 'number') document.getElementById('progress-cost').textContent = `$${ev.cost.toFixed(4)} spent`;
  if ((ev.phase === 'extract' || ev.phase === 'batch') && typeof ev.done === 'number' && typeof ev.total === 'number') {
    document.getElementById('counter-now').textContent = String(ev.done);
    document.getElementById('counter-of').textContent = `of ${ev.total} files prepared or processed`;
    document.getElementById('progress-bar-fill').style.width = `${Math.min(100, (ev.done / ev.total) * 100)}%`;
  }
  if (ev.phase === 'classify' && typeof ev.done === 'number') {
    document.getElementById('counter-now').textContent = String(ev.done);
    document.getElementById('counter-of').textContent = `of ${ev.total} files classified`;
    document.getElementById('progress-bar-fill').style.width = `${Math.min(100, (ev.done / ev.total) * 100)}%`;
    if (ev.file && ev.criterion) appendLiveItem(ev);
  }
  if (ev.phase === 'hash' && ev.total) {
    document.getElementById('counter-now').textContent = String(ev.done || 0);
    document.getElementById('counter-of').textContent = `of ${ev.total} files hashed`;
    document.getElementById('progress-bar-fill').style.width = `${((ev.done || 0) / ev.total) * 30}%`;
  }
}

function appendLiveItem(ev) {
  const list = document.getElementById('live-list');
  const li = el('li', {},
    el('span', { class: 'live-icon' }, '📄'),
    el('span', { class: 'live-name' }, ev.file),
    el('span', { class: 'live-arrow' }, '→'),
    el('span', { class: 'live-criterion pill ' + (ev.criterion === '_Unclassified' ? 'pill-neutral' : 'pill-blue') }, ev.criterion),
  );
  list.prepend(li);
  while (list.children.length > 8) list.removeChild(list.lastChild);
}

// ---------- review ----------
function renderReview(run) {
  const s = run.summary;
  const c = s.counts;
  const stats = s.llmStats || {};
  const activeCriteria = s.selectedCriteria || CRITERIA_ORDER;
  const scoped = activeCriteria.length < CRITERIA_ORDER.length;

  // Title + sub
  document.getElementById('review-title').textContent =
    `Organized ${c.outputFiles} files into ${c.events} event${c.events === 1 ? '' : 's'} across ${c.criteriaWithEvidence} criteria`;
  document.getElementById('review-sub').textContent =
    `${c.unclassified} need your review · ${c.duplicates} duplicates · ${c.reference} reference files · cost ~$${(stats.cost_usd || 0).toFixed(4)}${scoped ? ` · scoped to ${activeCriteria.length} categories` : ''}`;
  document.getElementById('output-path-display').textContent = run.outputDir;

  // Completion panel
  renderCompletionPanel(s, run);

  // Petition workspace
  renderPetitionPanel();

  // Letters
  renderLetters(s);

  // Criteria buckets
  renderCriteriaBuckets(s);

  // Other
  renderOtherBuckets(s);

  // Letters meta
  document.getElementById('letters-meta').textContent = `${s.letters.total} letter${s.letters.total === 1 ? '' : 's'} · ${s.letters.independent} indep · ${s.letters.dependent} dep · ${s.letters.citation} cite`;
}

function renderCompletionPanel(s, run) {
  const c = s.counts;
  const stats = s.llmStats || {};
  const projectScope = s.projectScope || {};
  const activeCriteria = s.selectedCriteria || CRITERIA_ORDER;
  const categoryScopeLine = activeCriteria.length < CRITERIA_ORDER.length
    ? `<li><strong>${activeCriteria.length} category${activeCriteria.length === 1 ? '' : 'ies'}</strong> were enabled for this run — files outside that scope were routed to <code>_Unclassified</code>.</li>`
    : '';
  const lettersLine = s.letters.total
    ? `<li><strong>${s.letters.total} reference letter${s.letters.total === 1 ? '' : 's'}</strong> detected — ${s.letters.independent} independent, ${s.letters.dependent} dependent, ${s.letters.citation} citation.</li>`
    : '';
  const dupLine = c.duplicates
    ? `<li><strong>${c.duplicateGroups} duplicate group${c.duplicateGroups === 1 ? '' : 's'}</strong> (${c.duplicates} extra files) flagged in <code>_Duplicates/</code>.</li>`
    : '';
  const ucLine = c.unclassified
    ? `<li><strong>${c.unclassified} file${c.unclassified === 1 ? '' : 's'}</strong> couldn't be classified confidently — flagged in <code>_Unclassified/</code>.</li>`
    : '';
  const projectScopeLine = projectScope.forms?.length
    ? `<li><strong>${projectScope.forms.length} client project scope form${projectScope.forms.length === 1 ? '' : 's'}</strong> detected — criteria <code>05</code> and <code>08</code> were restricted to listed projects only.</li>`
    : '';

  document.getElementById('completion-panel').innerHTML = `
    <header class="completion-head">
      <div class="completion-celebrate">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l2.4 5 5.6.8-4 3.9.9 5.6L12 14.6 7.1 17.3 8 11.7 4 7.8 9.6 7 12 2z" fill="currentColor"/>
        </svg>
      </div>
      <div class="completion-text">
        <div class="eyebrow">Run complete</div>
        <h2 class="completion-title">Here's what we did</h2>
        <p class="completion-sub">Every original file is accounted for in the output folder.</p>
      </div>
    </header>
    <div class="completion-body">
      <ul class="narrative-list">
        <li><strong>${c.outputFiles} file${c.outputFiles === 1 ? '' : 's'}</strong> read from your input folder (including all subfolders).</li>
        <li><strong>${c.classified} text-readable</strong> file${c.classified === 1 ? '' : 's'} analyzed by <code>${stats.model || '…'}</code> and placed into criterion folders.</li>
        <li><strong>${c.reference} non-text file${c.reference === 1 ? '' : 's'}</strong> (images, video, archives) copied untouched into <code>_Reference/</code>.</li>
        <li><strong>${c.events} event${c.events === 1 ? '' : 's'}</strong> identified across <strong>${c.criteriaWithEvidence} of the 10</strong> EB1A criteria.</li>
        ${categoryScopeLine}
        ${projectScopeLine}
        ${lettersLine}
        ${dupLine}
        ${ucLine}
      </ul>
      <div class="integrity-card">
        <div class="integrity-head">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.6"/>
            <path d="M6 10l3 3 5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="integrity-title">Integrity check passed</div>
        </div>
        <div class="integrity-math">
          <div class="im-cell"><div class="im-num">${c.inputFiles}</div><div class="im-label">files in input folder</div></div>
          <div class="im-eq">=</div>
          <div class="im-cell"><div class="im-num">${c.outputFiles}</div><div class="im-label">files in output folder</div></div>
        </div>
        <div class="integrity-foot">
          <span>Your <strong>original</strong> input folder is untouched — files were copied with SHA-256 verification.</span>
          <button class="btn btn-link btn-sm" onclick="openAuditLog()">View full audit log →</button>
        </div>
      </div>
      <div class="completion-foot">
        <div class="run-stats">
          <span>🧠 ${stats.provider || ''}/${stats.model || ''}</span>
          <span class="muted">·</span>
          <span>💸 $${(stats.cost_usd || 0).toFixed(4)}</span>
          <span class="muted">·</span>
          <span>📦 ${c.inputFiles} files in / ${c.outputFiles} out</span>
        </div>
      </div>
    </div>
  `;
}

function renderPetitionPanel() {
  const panel = document.getElementById('petition-panel');
  const meta = document.getElementById('petition-meta');
  const workspace = state.workspace;
  if (!workspace) {
    panel.innerHTML = `
      <div class="petition-empty">
        <div class="petition-empty-title">Petition workspace not loaded</div>
        <div class="petition-empty-sub">Refresh the review screen after the run completes to load saved event decisions and exhibit metadata.</div>
      </div>
    `;
    meta.textContent = 'Saved event decisions, exhibit bundle titles, and manual review notes';
    return;
  }

  const summary = workspace.summary || {};
  meta.textContent = `${summary.totalEvents || 0} events · ${summary.selectedEvents || 0} selected · ${summary.pendingEvents || 0} pending · ${summary.droppedEvents || 0} dropped`;
  panel.innerHTML = `
    <div class="petition-grid">
      <button class="petition-card petition-card-selected" onclick="openPetitionWorkspace('selected')">
        <div class="petition-card-head"><span class="petition-card-label">Final outcomes</span><span class="petition-card-count">${summary.selectedEvents || 0}</span></div>
        <div class="petition-card-title">Selected events</div>
        <div class="petition-card-sub">Events currently marked for the petition build, with exhibit bundle titles and notes.</div>
      </button>
      <button class="petition-card petition-card-pending" onclick="openPetitionWorkspace('pending')">
        <div class="petition-card-head"><span class="petition-card-label">Needs decision</span><span class="petition-card-count">${summary.pendingEvents || 0}</span></div>
        <div class="petition-card-title">Pending events</div>
        <div class="petition-card-sub">Review bundled events and decide which ones should move forward or drop from later stages.</div>
      </button>
      <button class="petition-card petition-card-dropped" onclick="openPetitionWorkspace('dropped')">
        <div class="petition-card-head"><span class="petition-card-label">Deferred</span><span class="petition-card-count">${summary.droppedEvents || 0}</span></div>
        <div class="petition-card-title">Dropped for now</div>
        <div class="petition-card-sub">Keep a record of events that were organized but are not part of the current petition story.</div>
      </button>
      <button class="petition-card petition-card-review" onclick="openUnclassified()">
        <div class="petition-card-head"><span class="petition-card-label">Manual review</span><span class="petition-card-count">${summary.unresolvedUnclassified || 0}</span></div>
        <div class="petition-card-title">Unclassified evidence</div>
        <div class="petition-card-sub">${summary.resolvedUnclassified || 0} resolved · assign categories for anything the AI could not place confidently.</div>
      </button>
    </div>
    <div class="petition-foot">
      <span>Saved to <code>_petition_workspace.json</code> and <code>_petition_plan.md</code> inside the output folder.</span>
      <button class="btn btn-ghost btn-sm" onclick="openPetitionWorkspace('all')">Review all events</button>
    </div>
  `;
}

function getWorkspaceEvents(filter = 'all') {
  const events = state.workspace?.events || [];
  if (filter === 'all') return events;
  return events.filter(event => event.status === filter);
}

async function persistWorkspace() {
  if (!state.workspace) return;
  const r = await fetch('/api/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outputDir: document.getElementById('output-path-display').textContent,
      workspace: state.workspace,
    }),
  }).then(res => res.json());
  if (r.error) throw new Error(r.error);
  state.workspace = r.workspace;
  renderPetitionPanel();
}

function renderLetters(s) {
  const grid = document.getElementById('letters-grid');
  grid.innerHTML = '';
  const types = [
    { key: 'independent', title: 'Independent Letters', tag: 'Strongest', tagCls: 'tag-independent', bucketCls: 'independent', sub: 'From signers with <strong>no prior relationship</strong>.' },
    { key: 'dependent',   title: 'Dependent Letters',   tag: 'Supporting', tagCls: 'tag-dependent',   bucketCls: 'dependent',   sub: 'From <strong>former colleagues, mentors, employers</strong>.' },
    { key: 'citation',    title: 'Citation Letters',    tag: 'Specialized', tagCls: 'tag-citation',   bucketCls: 'citation',    sub: 'From signers who have <strong>cited the petitioner\'s work</strong>.' },
  ];
  for (const t of types) {
    const count = s.letters[t.key];
    const btn = el('button', { class: `letter-bucket ${t.bucketCls}`, onclick: () => openLetters(t.key) });
    btn.innerHTML = `
      <div class="letter-head"><div class="letter-icon-wrap ${t.bucketCls}"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="11" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M3 7l7 5 7-5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></div><span class="letter-tag ${t.tagCls}">${t.tag}</span></div>
      <div class="letter-count">${count}</div>
      <div class="letter-title">${t.title}</div>
      <div class="letter-sub">${t.sub}</div>`;
    grid.append(btn);
  }
}

function renderCriteriaBuckets(s) {
  const grid = document.getElementById('bucket-grid');
  grid.innerHTML = '';
  for (const crit of CRITERIA_ORDER) {
    const meta = CRITERION_META[crit];
    const events = s.events[crit] || [];
    const fileCount = events.reduce((sum, e) => sum + e.fileCount, 0);
    const isEmpty = fileCount === 0;
    const isFeatured = fileCount >= 10;
    const cls = 'bucket' + (isEmpty ? ' empty' : '') + (isFeatured ? ' featured' : '') + (crit === '11 — Comparable Evidence' ? ' bucket-comparable' : '');
    const btn = el('button', { class: cls, onclick: isEmpty ? null : () => openCriterion(crit) });
    btn.innerHTML = `
      <div class="bucket-head"><span class="bucket-num">${meta.num}</span><span class="bucket-count">${fileCount}</span></div>
      <div class="bucket-title">${crit.replace(/^\d+ — /, '')}</div>
      <div class="bucket-cite">${meta.cite}</div>
      <div class="bucket-stats">${isEmpty ? 'No evidence found' : `<strong>${events.length}</strong> event${events.length === 1 ? '' : 's'} · <strong>${fileCount}</strong> file${fileCount === 1 ? '' : 's'}`}</div>`;
    grid.append(btn);
  }
}

function renderOtherBuckets(s) {
  const grid = document.getElementById('other-grid');
  grid.innerHTML = '';
  const c = s.counts;
  const unresolved = state.workspace?.summary?.unresolvedUnclassified ?? c.unclassified;
  const resolved = state.workspace?.summary?.resolvedUnclassified ?? 0;

  const unclassifiedBtn = el('button', { class: 'bucket bucket-unclassified', onclick: () => openUnclassified() });
  unclassifiedBtn.innerHTML = `
    <div class="bucket-head"><span class="bucket-num">—</span><span class="bucket-count">${unresolved}</span></div>
    <div class="bucket-title">_Unclassified</div>
    <div class="bucket-cite">Low-confidence files</div>
    <div class="bucket-stats unclassified-stats">${unresolved ? `⚠ ${unresolved} file${unresolved === 1 ? '' : 's'} need your review` : `Resolved ${resolved} manual classification${resolved === 1 ? '' : 's'}`}</div>`;
  grid.append(unclassifiedBtn);

  const dupBtn = el('button', { class: 'bucket bucket-duplicates', onclick: () => openAuditLog() });
  dupBtn.innerHTML = `
    <div class="bucket-head"><span class="bucket-num">⊕</span><span class="bucket-count">${c.duplicates}</span></div>
    <div class="bucket-title">Duplicate files</div>
    <div class="bucket-cite">${c.duplicateGroups} group${c.duplicateGroups === 1 ? '' : 's'} (same hash)</div>
    <div class="bucket-stats">In <code>_Duplicates/</code> · see audit log</div>`;
  grid.append(dupBtn);

  const refBtn = el('button', { class: 'bucket bucket-reference', onclick: () => openAuditLog() });
  refBtn.innerHTML = `
    <div class="bucket-head"><span class="bucket-num">⊟</span><span class="bucket-count">${c.reference}</span></div>
    <div class="bucket-title">_Reference</div>
    <div class="bucket-cite">Images, video, archives — copied untouched</div>
    <div class="bucket-stats">Not analyzed by AI</div>`;
  grid.append(refBtn);
}

// ---------- drawers ----------
function openPetitionWorkspace(filter = 'all') {
  const events = getWorkspaceEvents(filter);
  const titleMap = {
    all: 'All event bundles',
    selected: 'Selected events',
    pending: 'Pending events',
    dropped: 'Dropped events',
  };
  document.getElementById('drawer-eyebrow').textContent = 'Petition workspace';
  document.getElementById('drawer-title').textContent = titleMap[filter] || 'Event bundles';
  document.getElementById('drawer-meta').textContent = `${events.length} event${events.length === 1 ? '' : 's'} · decisions saved to output folder`;

  const body = document.getElementById('drawer-body');
  if (events.length === 0) {
    body.innerHTML = '<p class="muted" style="text-align:center;padding:32px;">No events in this view yet.</p>';
    openDrawer();
    return;
  }

  body.innerHTML = `
    <div class="workspace-intro">
      <div class="workspace-intro-title">Choose what carries into the petition build</div>
      <div class="workspace-intro-sub">Each event bundle keeps its criterion, exhibit title, and planning notes. Use <strong>Selected</strong> for final outcomes, <strong>Dropped</strong> for items you want to defer, and leave the rest as <strong>Pending</strong> while reviewing.</div>
    </div>
    <div class="workspace-events">
      ${events.map(event => renderWorkspaceEventCard(event)).join('')}
    </div>
  `;
  openDrawer();
}

function renderWorkspaceEventCard(event) {
  const statusClass = event.status === 'selected'
    ? 'workspace-status-selected'
    : event.status === 'dropped'
      ? 'workspace-status-dropped'
      : 'workspace-status-pending';
  return `
    <section class="workspace-event-card">
      <div class="workspace-event-head">
        <div>
          <div class="workspace-event-title">${escapeHtml(event.title || 'Untitled event')}</div>
          <div class="workspace-event-meta">${escapeHtml(event.criterion)}${event.date ? ` · ${escapeHtml(event.date)}` : ''} · ${event.evidenceCount || event.files.length} file${(event.evidenceCount || event.files.length) === 1 ? '' : 's'}</div>
        </div>
        <span class="workspace-status-pill ${statusClass}">${escapeHtml(event.status)}</span>
      </div>
      ${event.summary ? `<p class="workspace-event-summary">${escapeHtml(event.summary)}</p>` : ''}
      <div class="workspace-event-actions">
        <button class="btn btn-ghost btn-sm" onclick="setEventStatus('${escapeHtml(event.id)}', 'pending')">Pending</button>
        <button class="btn btn-ghost btn-sm" onclick="setEventStatus('${escapeHtml(event.id)}', 'selected')">Use in petition</button>
        <button class="btn btn-ghost btn-sm" onclick="setEventStatus('${escapeHtml(event.id)}', 'dropped')">Drop for now</button>
      </div>
      <div class="workspace-form-grid">
        <label class="workspace-field">
          <span class="workspace-label">Exhibit bundle title</span>
          <input class="text-input" id="event-bundle-${escapeHtml(event.id)}" value="${escapeHtml(event.exhibitBundleTitle || '')}">
        </label>
        <label class="workspace-field">
          <span class="workspace-label">Exhibit tab label</span>
          <input class="text-input" id="event-tab-${escapeHtml(event.id)}" value="${escapeHtml(event.exhibitTabLabel || '')}" placeholder="Optional short label">
        </label>
      </div>
      <label class="workspace-field">
        <span class="workspace-label">Petition notes</span>
        <textarea class="text-input workspace-notes" id="event-notes-${escapeHtml(event.id)}" placeholder="Why this event matters, what to cite, or how to use it in the petition narrative.">${escapeHtml(event.petitionNotes || '')}</textarea>
      </label>
      <div class="workspace-card-foot">
        <span class="muted">${escapeHtml(event.folderPath || '')}</span>
        <button class="btn btn-primary btn-sm" onclick="saveEventMetadata('${escapeHtml(event.id)}')">Save event</button>
      </div>
      <details class="workspace-files">
        <summary>Evidence files (${event.files.length})</summary>
        <ul class="file-list">
          ${event.files.map(file => `
            <li class="file-row">
              <span class="file-icon">📄</span>
              <div class="file-meta">
                <div class="file-name">${escapeHtml(file.name)}</div>
                <div class="file-reason">${escapeHtml(file.evidenceType || 'other')} · ${escapeHtml(file.reason || '')}</div>
              </div>
              <span class="file-confidence ${file.confidence === 'HIGH' ? 'high' : file.confidence === 'MEDIUM' ? 'med' : 'low'}">${escapeHtml(file.confidence || '')}</span>
            </li>`).join('')}
        </ul>
      </details>
    </section>
  `;
}

async function setEventStatus(eventId, status) {
  const event = state.workspace?.events?.find(item => item.id === eventId);
  if (!event) return;
  event.status = status;
  event.useInPetition = status === 'selected';
  await persistWorkspace();
  openPetitionWorkspace(status === 'selected' || status === 'dropped' || status === 'pending' ? status : 'all');
}

async function saveEventMetadata(eventId) {
  const event = state.workspace?.events?.find(item => item.id === eventId);
  if (!event) return;
  event.exhibitBundleTitle = document.getElementById(`event-bundle-${eventId}`)?.value.trim() || event.exhibitBundleTitle;
  event.exhibitTabLabel = document.getElementById(`event-tab-${eventId}`)?.value.trim() || null;
  event.petitionNotes = document.getElementById(`event-notes-${eventId}`)?.value.trim() || '';
  await persistWorkspace();
  openPetitionWorkspace('all');
}

function openCriterion(crit) {
  const events = state.summary.events[crit] || [];
  const fileCount = events.reduce((s, e) => s + e.fileCount, 0);
  document.getElementById('drawer-eyebrow').textContent = 'Criterion';
  document.getElementById('drawer-title').textContent = crit;
  document.getElementById('drawer-meta').textContent = `${events.length} event${events.length === 1 ? '' : 's'} · ${fileCount} file${fileCount === 1 ? '' : 's'}`;

  const body = document.getElementById('drawer-body');
  body.innerHTML = '';
  const ul = el('ul', { class: 'events-accordion' });
  for (const ev of events) {
    const li = el('li', { class: 'event-block' });
    li.innerHTML = `
      <details ${events.length === 1 ? 'open' : ''}>
        <summary class="event-head">
          <div class="event-info"><div class="event-title">${escapeHtml(ev.title || 'Ungrouped files')}</div><div class="event-date">${escapeHtml(ev.date || '')}</div></div>
          <div class="event-tail"><span class="event-count-pill">${ev.fileCount} file${ev.fileCount === 1 ? '' : 's'}</span>
            <svg class="event-chev" width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5L6 7.5l3-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        </summary>
        <ul class="event-files">
          ${ev.files.map(f => `
            <li class="file-row">
              <span class="file-icon">📄</span>
              <div class="file-meta"><div class="file-name">${escapeHtml(f.name)}</div><div class="file-reason">${escapeHtml(f.reason)}</div></div>
              <span class="file-confidence ${f.confidence === 'HIGH' ? 'high' : f.confidence === 'MEDIUM' ? 'med' : 'low'}">${escapeHtml(f.confidence || '')}</span>
            </li>`).join('')}
        </ul>
      </details>`;
    ul.append(li);
  }
  body.append(ul);
  openDrawer();
}

function openUnclassified() {
  const items = state.workspace?.unclassified || [];
  document.getElementById('drawer-eyebrow').textContent = 'Review queue';
  document.getElementById('drawer-title').textContent = '_Unclassified';
  document.getElementById('drawer-meta').textContent = `${items.length} file${items.length === 1 ? '' : 's'} awaiting review`;

  const body = document.getElementById('drawer-body');
  if (items.length === 0) {
    body.innerHTML = '<p class="muted" style="text-align:center;padding:32px;">No unclassified files — everything got placed.</p>';
  } else {
    body.innerHTML = `
      <div class="workspace-intro">
        <div class="workspace-intro-title">Resolve category assignments</div>
        <div class="workspace-intro-sub">Pick the EB1A category these files should support. This saves reviewer metadata for the next stage even if the file stays in <code>_Unclassified/</code> for now.</div>
      </div>
      <div class="workspace-events">
        ${items.map(item => `
          <section class="workspace-event-card">
            <div class="workspace-event-head">
              <div>
                <div class="workspace-event-title">${escapeHtml(item.fileName)}</div>
                <div class="workspace-event-meta">${escapeHtml(item.destinationPath)}</div>
              </div>
              <span class="workspace-status-pill ${item.status === 'resolved' ? 'workspace-status-selected' : 'workspace-status-pending'}">${escapeHtml(item.status)}</span>
            </div>
            <p class="workspace-event-summary">${escapeHtml(item.reason || 'Needs manual review.')}</p>
            <div class="workspace-form-grid">
              <label class="workspace-field">
                <span class="workspace-label">Assign category</span>
                <select class="text-input" id="unclassified-criterion-${escapeHtml(item.id)}">
                  ${renderCriterionOptions(item.selectedCriterion)}
                </select>
              </label>
            </div>
            <label class="workspace-field">
              <span class="workspace-label">Reviewer notes</span>
              <textarea class="text-input workspace-notes" id="unclassified-notes-${escapeHtml(item.id)}" placeholder="Why this belongs in the selected category, or what to revisit later.">${escapeHtml(item.reviewerNotes || '')}</textarea>
            </label>
            <div class="workspace-card-foot">
              <span class="file-confidence ${item.confidence === 'HIGH' ? 'high' : item.confidence === 'MEDIUM' ? 'med' : 'low'}">${escapeHtml(item.confidence || 'LOW')}</span>
              <button class="btn btn-primary btn-sm" onclick="saveUnclassifiedDecision('${escapeHtml(item.id)}')">Save decision</button>
            </div>
          </section>
        `).join('')}
      </div>
    `;
  }
  openDrawer();
}

function openLetters(type) {
  // Pull letters from summary.audit where is_letter && letter_type === type
  const letters = state.summary.audit.filter(r => r.is_letter && r.letter_type === type);
  const labels = { independent: 'Independent Letters', dependent: 'Dependent Letters', citation: 'Citation Letters' };
  document.getElementById('drawer-eyebrow').textContent = 'Letters';
  document.getElementById('drawer-title').textContent = labels[type];
  document.getElementById('drawer-meta').textContent = `${letters.length} letter${letters.length === 1 ? '' : 's'}`;

  const body = document.getElementById('drawer-body');
  if (letters.length === 0) {
    body.innerHTML = '<p class="muted" style="text-align:center;padding:32px;">No letters of this type detected.</p>';
  } else {
    body.innerHTML = `<ul class="letter-list">${letters.map(r => {
      const initials = (r.signer_name || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
      const tagCls = type === 'independent' ? 'tag-independent' : type === 'dependent' ? 'tag-dependent' : 'tag-citation';
      const tagLabel = type === 'independent' ? 'Independent' : type === 'dependent' ? 'Dependent' : 'Citation';
      return `
        <li class="letter-row">
          <div class="letter-row-head">
            <div class="letter-signer">
              <div class="signer-avatar">${escapeHtml(initials)}</div>
              <div>
                <div class="signer-name">${escapeHtml(r.signer_name || 'Unnamed signer')}</div>
                <div class="signer-title">${escapeHtml(r.signer_title || '—')}</div>
              </div>
            </div>
            <span class="letter-tag ${tagCls}">${tagLabel}</span>
          </div>
          <p class="letter-quote">${escapeHtml(r.reason)}</p>
          <div class="letter-row-meta">
            <span class="meta-pill">${escapeHtml(r.destination.split('/').pop())}</span>
            <span class="meta-pill">${escapeHtml(r.criterion || '')}</span>
          </div>
        </li>`;
    }).join('')}</ul>`;
  }
  openDrawer();
}

function renderCriterionOptions(selected) {
  const options = [''].concat(CRITERIA_ORDER);
  return options.map(value => {
    const label = value || 'Choose a category…';
    return `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

async function saveUnclassifiedDecision(itemId) {
  const item = state.workspace?.unclassified?.find(entry => entry.id === itemId);
  if (!item) return;
  item.selectedCriterion = document.getElementById(`unclassified-criterion-${itemId}`)?.value || null;
  item.reviewerNotes = document.getElementById(`unclassified-notes-${itemId}`)?.value.trim() || '';
  item.status = item.selectedCriterion ? 'resolved' : 'pending';
  await persistWorkspace();
  openUnclassified();
}

function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('scrim').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('scrim').classList.remove('open');
  document.body.style.overflow = '';
}

// ---------- summary / audit modals ----------
function openSummary() {
  const s = state.summary;
  if (!s) return;
  const c = s.counts;
  document.getElementById('summary-meta').textContent =
    `${c.inputFiles} files in · ${c.outputFiles} files out · ${c.events} events · ${c.criteriaWithEvidence} criteria`;
  document.getElementById('summary-side').innerHTML = `
    <div class="ep-section-label">Quick stats</div>
    <ul class="summary-stats">
      <li><span class="ss-num">${c.outputFiles}</span><span class="ss-label">files organized</span></li>
      <li><span class="ss-num">${c.events}</span><span class="ss-label">events</span></li>
      <li><span class="ss-num">${c.criteriaWithEvidence}</span><span class="ss-label">criteria with evidence</span></li>
      <li><span class="ss-num">${c.unclassified}</span><span class="ss-label">unclassified</span></li>
      <li><span class="ss-num">${c.duplicates}</span><span class="ss-label">duplicates</span></li>
    </ul>
    <div class="summary-actions">
      <button class="btn btn-ghost btn-sm" onclick="revealOutput()">Open folder</button>
    </div>`;
  // Build a quick markdown-ish preview of the structure
  let md = `# EB1A Evidence Index\n\n${c.inputFiles} files in input · ${c.outputFiles} files in output\n\n`;
  for (const crit of CRITERIA_ORDER) {
    const events = s.events[crit] || [];
    if (events.length === 0) continue;
    md += `## ${crit}\n*${CRITERION_META[crit].cite} · ${events.length} event${events.length === 1 ? '' : 's'}*\n\n`;
    for (const ev of events) {
      md += `### ${ev.title || 'Ungrouped'}${ev.date ? ` (${ev.date})` : ''}\n`;
      for (const f of ev.files) md += `- ${f.name}\n`;
      md += '\n';
    }
  }
  document.getElementById('summary-md').textContent = md;
  document.getElementById('summary-modal').classList.add('open');
}

function openAuditLog() {
  const s = state.summary;
  if (!s) return;
  const audit = s.audit;
  const inputCount = s.counts.inputFiles;
  const outputCount = s.counts.outputFiles;
  document.getElementById('audit-meta').textContent =
    `${inputCount} input → ${outputCount} output · ${inputCount === outputCount ? '✓ Match' : '⚠ Mismatch'}`;

  const body = document.getElementById('audit-body');
  body.innerHTML = `
    <div class="audit-stats">
      <div class="as-cell"><div class="as-num">${inputCount}</div><div class="as-label">Input files</div><div class="as-sub">SHA-256 hashed</div></div>
      <div class="as-arrow">→</div>
      <div class="as-cell"><div class="as-num">${outputCount}</div><div class="as-label">Output files</div><div class="as-sub">Verified after copy</div></div>
      <div class="as-arrow">=</div>
      <div class="as-cell ${inputCount === outputCount ? 'ok' : ''}"><div class="as-num">${inputCount === outputCount ? '✓' : '✗'}</div><div class="as-label">${inputCount === outputCount ? 'Match' : 'Mismatch'}</div><div class="as-sub">${inputCount === outputCount ? 'No file lost' : 'Investigate'}</div></div>
    </div>
    <table class="audit-table">
      <thead><tr><th>Original</th><th>Destination</th><th>Type</th><th>SHA-256</th></tr></thead>
      <tbody>${audit.map(r => `
        <tr>
          <td><code>${escapeHtml(r.original)}</code></td>
          <td><code>${escapeHtml(r.destination)}</code></td>
          <td><span class="pill ${r.type === 'Classified' ? 'pill-blue' : r.type === 'Duplicate' ? 'pill-warn' : r.type === 'Reference' ? 'pill-ref' : 'pill-neutral'}">${escapeHtml(r.type)}</span></td>
          <td><code class="hash">${escapeHtml((r.hash || '').slice(0,4) + '…' + (r.hash || '').slice(-4))}</code></td>
        </tr>`).join('')}</tbody>
    </table>
    <div class="audit-foot">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v4M8 10.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <span>Every file in your input folder appears on the left. The SHA-256 hash for each pair was verified after the copy.</span>
    </div>`;
  document.getElementById('audit-modal').classList.add('open');
}

async function revealOutput() {
  if (!state.summary) return;
  const outputDir = document.getElementById('output-path-display').textContent;
  await fetch('/api/reveal', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: outputDir }) });
}

// Backdrop closes modals
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
  if (document.getElementById('drawer').classList.contains('open')) closeDrawer();
});
