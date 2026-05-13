import fs from 'node:fs/promises';
import path from 'node:path';

export const WORKSPACE_FILENAME = '_petition_workspace.json';
export const PLAN_FILENAME = '_petition_plan.md';

export function buildPetitionWorkspace({ outputDir, audit }) {
  const eventsById = new Map();
  const unclassified = [];

  for (const row of audit) {
    if (row.type === 'Classified' && row.criterion && row.criterion !== '_Unclassified') {
      const eventId = normalizeEventId(row);
      if (!eventsById.has(eventId)) {
        eventsById.set(eventId, {
          id: eventId,
          criterion: row.criterion,
          secondaryCriterion: row.secondary_criterion || null,
          title: row.event || inferTitleFromDestination(row.destination),
          date: row.event_date || null,
          summary: row.event_summary || null,
          folderPath: path.dirname(row.destination),
          status: 'pending',
          useInPetition: false,
          exhibitBundleTitle: buildExhibitBundleTitle(row),
          exhibitTabLabel: null,
          petitionNotes: '',
          evidenceCount: 0,
          files: [],
        });
      }
      const event = eventsById.get(eventId);
      event.evidenceCount += 1;
      event.files.push({
        id: `${eventId}::${row.destination}`,
        name: path.basename(row.destination),
        originalPath: row.original,
        destinationPath: row.destination,
        evidenceType: row.evidence_type || 'other',
        matchedProject: row.matched_project || null,
        confidence: row.confidence || null,
        reason: row.reason || '',
        notes: row.notes || '',
        includeInBundle: true,
        exhibitLabel: null,
        signerName: row.signer_name || null,
        signerTitle: row.signer_title || null,
      });
      continue;
    }

    if (row.type === 'Unclassified') {
      unclassified.push({
        id: buildStableId(`unclassified ${row.destination}`),
        fileName: path.basename(row.destination),
        originalPath: row.original,
        destinationPath: row.destination,
        reason: row.reason || '',
        confidence: row.confidence || 'LOW',
        selectedCriterion: null,
        reviewerNotes: '',
        status: 'pending',
      });
    }
  }

  const workspace = {
    version: 1,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputDir,
    events: sortEvents([...eventsById.values()]),
    unclassified,
  };
  workspace.summary = summarizeWorkspace(workspace);
  return workspace;
}

export async function loadPetitionWorkspace(outputDir) {
  const raw = await fs.readFile(path.join(outputDir, WORKSPACE_FILENAME), 'utf8');
  return normalizeWorkspace(JSON.parse(raw), outputDir);
}

export async function savePetitionWorkspace(outputDir, workspace) {
  const normalized = normalizeWorkspace(workspace, outputDir);
  normalized.updatedAt = new Date().toISOString();
  normalized.summary = summarizeWorkspace(normalized);
  await fs.writeFile(path.join(outputDir, WORKSPACE_FILENAME), JSON.stringify(normalized, null, 2), 'utf8');
  await fs.writeFile(path.join(outputDir, PLAN_FILENAME), buildPlanMarkdown(normalized), 'utf8');
  return normalized;
}

function normalizeWorkspace(workspace = {}, outputDir) {
  const normalized = {
    version: workspace.version || 1,
    generatedAt: workspace.generatedAt || new Date().toISOString(),
    updatedAt: workspace.updatedAt || new Date().toISOString(),
    outputDir,
    events: Array.isArray(workspace.events) ? workspace.events.map(normalizeEvent) : [],
    unclassified: Array.isArray(workspace.unclassified) ? workspace.unclassified.map(normalizeUnclassified) : [],
  };
  normalized.summary = summarizeWorkspace(normalized);
  return normalized;
}

function normalizeEvent(event = {}) {
  const files = Array.isArray(event.files) ? event.files.map(file => ({
    id: file.id || `${event.id || 'event'}::${file.destinationPath || file.name || 'file'}`,
    name: file.name || path.basename(file.destinationPath || 'file'),
    originalPath: file.originalPath || '',
    destinationPath: file.destinationPath || '',
    evidenceType: file.evidenceType || 'other',
    matchedProject: file.matchedProject || null,
    confidence: file.confidence || null,
    reason: file.reason || '',
    notes: file.notes || '',
    includeInBundle: file.includeInBundle !== false,
    exhibitLabel: file.exhibitLabel || null,
    signerName: file.signerName || null,
    signerTitle: file.signerTitle || null,
  })) : [];

  return {
    id: event.id || `event-${Math.random().toString(36).slice(2, 10)}`,
    criterion: event.criterion || '11 — Comparable Evidence',
    secondaryCriterion: event.secondaryCriterion || null,
    title: event.title || 'Untitled event',
    date: event.date || null,
    summary: event.summary || null,
    folderPath: event.folderPath || '',
    status: ['selected', 'dropped', 'pending'].includes(event.status) ? event.status : 'pending',
    useInPetition: event.status === 'selected' ? true : !!event.useInPetition,
    exhibitBundleTitle: event.exhibitBundleTitle || buildExhibitBundleTitle(event),
    exhibitTabLabel: event.exhibitTabLabel || null,
    petitionNotes: event.petitionNotes || '',
    evidenceCount: Number.isFinite(event.evidenceCount) ? event.evidenceCount : files.length,
    files,
  };
}

function normalizeUnclassified(item = {}) {
  return {
    id: item.id || buildStableId(`unclassified ${item.destinationPath || item.fileName || Math.random().toString(36).slice(2, 10)}`),
    fileName: item.fileName || path.basename(item.destinationPath || 'file'),
    originalPath: item.originalPath || '',
    destinationPath: item.destinationPath || '',
    reason: item.reason || '',
    confidence: item.confidence || 'LOW',
    selectedCriterion: item.selectedCriterion || null,
    reviewerNotes: item.reviewerNotes || '',
    status: item.selectedCriterion ? 'resolved' : (item.status === 'resolved' ? 'resolved' : 'pending'),
  };
}

export function summarizeWorkspace(workspace) {
  const events = workspace.events || [];
  const unclassified = workspace.unclassified || [];
  return {
    totalEvents: events.length,
    selectedEvents: events.filter(event => event.status === 'selected').length,
    droppedEvents: events.filter(event => event.status === 'dropped').length,
    pendingEvents: events.filter(event => event.status === 'pending').length,
    totalEvidenceFiles: events.reduce((sum, event) => sum + (event.evidenceCount || event.files?.length || 0), 0),
    unresolvedUnclassified: unclassified.filter(item => item.status !== 'resolved').length,
    resolvedUnclassified: unclassified.filter(item => item.status === 'resolved').length,
  };
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.criterion !== b.criterion) return a.criterion.localeCompare(b.criterion);
    if ((a.date || '') !== (b.date || '')) return (a.date || '').localeCompare(b.date || '');
    return (a.title || '').localeCompare(b.title || '');
  });
}

function normalizeEventId(row) {
  if (row.event_id) return row.event_id;
  const base = buildStableId([row.criterion, row.event || path.basename(row.destination), row.event_date || 'undated'].join(' '));
  return base || `event-${Math.random().toString(36).slice(2, 10)}`;
}

function buildExhibitBundleTitle(source) {
  const title = source.title || source.event || inferTitleFromDestination(source.destination) || 'Event evidence bundle';
  const date = source.date || source.event_date;
  return date ? `${title} (${date})` : title;
}

function inferTitleFromDestination(destination = '') {
  const dir = path.dirname(destination);
  const parts = dir.split(path.sep).filter(Boolean);
  return parts[parts.length - 1] || null;
}

function buildPlanMarkdown(workspace) {
  const lines = [];
  const summary = workspace.summary || summarizeWorkspace(workspace);
  lines.push('# Petition Workspace Plan');
  lines.push('');
  lines.push(`Generated: ${new Date(workspace.updatedAt || Date.now()).toISOString()}`);
  lines.push(`Output folder: \`${workspace.outputDir}\``);
  lines.push('');
  lines.push('## Workspace Summary');
  lines.push('');
  lines.push(`- Selected events: ${summary.selectedEvents}`);
  lines.push(`- Pending events: ${summary.pendingEvents}`);
  lines.push(`- Dropped events: ${summary.droppedEvents}`);
  lines.push(`- Resolved unclassified files: ${summary.resolvedUnclassified}`);
  lines.push(`- Unresolved unclassified files: ${summary.unresolvedUnclassified}`);
  lines.push('');

  for (const status of ['selected', 'pending', 'dropped']) {
    const events = workspace.events.filter(event => event.status === status);
    if (events.length === 0) continue;
    lines.push(`## ${capitalize(status)} Events`);
    lines.push('');
    for (const event of events) {
      lines.push(`### ${event.title}${event.date ? ` (${event.date})` : ''}`);
      lines.push(`- Criterion: ${event.criterion}`);
      if (event.secondaryCriterion) lines.push(`- Secondary criterion: ${event.secondaryCriterion}`);
      lines.push(`- Exhibit bundle: ${event.exhibitBundleTitle}`);
      lines.push(`- Folder: \`${event.folderPath}\``);
      if (event.summary) lines.push(`- Summary: ${event.summary}`);
      if (event.petitionNotes) lines.push(`- Petition notes: ${event.petitionNotes}`);
      lines.push(`- Evidence files: ${event.files.filter(file => file.includeInBundle !== false).length} included / ${event.files.length} total`);
      lines.push('');
    }
  }

  if (workspace.unclassified.length) {
    lines.push('## Unclassified Review');
    lines.push('');
    for (const item of workspace.unclassified) {
      const destination = item.destinationPath || item.fileName;
      lines.push(`- ${item.fileName}: ${item.selectedCriterion || 'Pending review'} · \`${destination}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function buildStableId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
