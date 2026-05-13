import fs from 'node:fs/promises';
import path from 'node:path';

const CRITERION_DISPLAY = {
  '01 — Awards & Recognition':    { name: '01 — Awards & Recognition',    cite: '8 C.F.R. § 204.5(h)(3)(i)' },
  '02 — Memberships':             { name: '02 — Memberships',             cite: '8 C.F.R. § 204.5(h)(3)(ii)' },
  '03 — Published Material':      { name: '03 — Published Material',      cite: '8 C.F.R. § 204.5(h)(3)(iii)' },
  '04 — Judging':                 { name: '04 — Judging / Peer Review',   cite: '8 C.F.R. § 204.5(h)(3)(iv)' },
  '05 — Original Contributions':  { name: '05 — Original Contributions',  cite: '8 C.F.R. § 204.5(h)(3)(v)' },
  '06 — Authorship':              { name: '06 — Authorship',              cite: '8 C.F.R. § 204.5(h)(3)(vi)' },
  '07 — Exhibitions':             { name: '07 — Exhibitions',             cite: '8 C.F.R. § 204.5(h)(3)(vii)' },
  '08 — Leading Critical Role':   { name: '08 — Leading / Critical Role', cite: '8 C.F.R. § 204.5(h)(3)(viii)' },
  '09 — High Salary':             { name: '09 — High Salary',             cite: '8 C.F.R. § 204.5(h)(3)(ix)' },
  '10 — Commercial Success':      { name: '10 — Commercial Success',      cite: '8 C.F.R. § 204.5(h)(3)(x)' },
  '11 — Comparable Evidence':     { name: '11 — Comparable Evidence',     cite: '8 C.F.R. § 204.5(h)(4)' },
};

const CRITERION_ORDER = Object.keys(CRITERION_DISPLAY);

export async function writeIndexFiles({ outputDir, inputDir, classified, referenceFiles, duplicates, llm, projectRegistry, selectedCriteria }) {
  const stats = llm.stats?.() || {};
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

  // Group classified files by criterion → event
  const byCrit = new Map();
  for (const c of classified) {
    if (c.result.criterion === '_Unclassified') continue;
    if (!byCrit.has(c.result.criterion)) byCrit.set(c.result.criterion, new Map());
    const evMap = byCrit.get(c.result.criterion);
    const evKey = c.result.event_title ? `${c.result.event_title}|${c.result.event_date || ''}` : '__no_event__';
    if (!evMap.has(evKey)) evMap.set(evKey, { title: c.result.event_title || null, date: c.result.event_date || null, files: [] });
    evMap.get(evKey).files.push(c);
  }

  // Letters separated by type
  const letters = classified.filter(c => c.result.is_letter);
  const lettersByType = { independent: [], dependent: [], citation: [] };
  for (const l of letters) {
    if (l.result.letter_type && lettersByType[l.result.letter_type]) {
      lettersByType[l.result.letter_type].push(l);
    }
  }

  // Build _index.md
  const lines = [];
  lines.push(`# EB1A Evidence Index`);
  lines.push('');
  lines.push(`- Generated: ${now}`);
  lines.push(`- Source folder: \`${inputDir}\``);
  lines.push(`- Output folder: \`${outputDir}\``);
  if (stats.model) lines.push(`- AI: ${stats.provider}/${stats.model} · cost ≈ $${(stats.cost_usd || 0).toFixed(4)}`);
  lines.push(`- Active criteria for this run: ${selectedCriteria?.join('; ') || 'All criteria'}`);
  lines.push(`- Petition workspace: \`_petition_workspace.json\` + \`_petition_plan.md\``);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push('| Statistic                | Value |');
  lines.push('|--------------------------|-------|');
  lines.push(`| Total files in input     | ${classified.length + referenceFiles.length + duplicates.length} |`);
  lines.push(`| Classified into criteria | ${classified.filter(c => c.result.criterion !== '_Unclassified').length} |`);
  lines.push(`| Unclassified             | ${classified.filter(c => c.result.criterion === '_Unclassified').length} |`);
  lines.push(`| Reference (non-text)     | ${referenceFiles.length} |`);
  lines.push(`| Duplicates collapsed     | ${duplicates.length} |`);
  lines.push(`| Reference letters        | ${letters.length} (Indep ${lettersByType.independent.length} · Dep ${lettersByType.dependent.length} · Cite ${lettersByType.citation.length}) |`);
  lines.push('');

  if (projectRegistry?.forms?.length) {
    lines.push('## Project Scope Forms');
    lines.push('');
    lines.push('Only files tied to projects listed in these client forms are allowed into `05 — Original Contributions` and `08 — Leading Critical Role` when applicable.');
    lines.push('');
    for (const form of projectRegistry.forms) {
      const label = form.kind === 'original_contributions' ? 'Original Contributions form' : 'Leading/Critical Role form';
      lines.push(`- ${label}: \`${form.relPath}\`${form.projects.length ? ` → ${form.projects.join('; ')}` : ' → no projects extracted'}`);
    }
    lines.push('');
  }

  // Letters section
  if (letters.length > 0) {
    lines.push('## Recommendation & Citation Letters');
    lines.push('');
    for (const type of ['independent', 'dependent', 'citation']) {
      if (lettersByType[type].length === 0) continue;
      const label = type === 'independent' ? 'Independent Letters' : type === 'dependent' ? 'Dependent Letters' : 'Citation Letters';
      lines.push(`### ${label} (${lettersByType[type].length})`);
      lines.push('');
      for (const l of lettersByType[type]) {
        const who = l.result.signer_name ? ` — ${l.result.signer_name}${l.result.signer_title ? `, ${l.result.signer_title}` : ''}` : '';
        lines.push(`- [${l.file.name}](./${path.posix.join(critFolder(l.result.criterion), eventFolder(l.result), l.file.name)})${who}`);
      }
      lines.push('');
    }
  }

  // Criteria sections
  for (const crit of CRITERION_ORDER) {
    if (!byCrit.has(crit)) continue;
    const disp = CRITERION_DISPLAY[crit];
    const evMap = byCrit.get(crit);
    const fileCount = [...evMap.values()].reduce((sum, ev) => sum + ev.files.length, 0);
    lines.push(`## ${disp.name}`);
    lines.push(`*${disp.cite} · ${evMap.size} event${evMap.size === 1 ? '' : 's'} · ${fileCount} file${fileCount === 1 ? '' : 's'}*`);
    lines.push('');
    for (const ev of evMap.values()) {
      const evHeader = ev.title ? `### ${ev.title}${ev.date ? ` (${ev.date})` : ''}` : `### Unsorted files`;
      lines.push(evHeader);
      lines.push('');
      for (const c of ev.files) {
        const linkPath = path.posix.join(critFolder(c.result.criterion), eventFolder(c.result), c.file.name);
        lines.push(`- [${c.file.name}](./${linkPath})`);
      }
      lines.push('');
    }
  }

  // Unclassified section
  const unclassified = classified.filter(c => c.result.criterion === '_Unclassified');
  if (unclassified.length > 0) {
    lines.push('## _Unclassified');
    lines.push(`*${unclassified.length} file${unclassified.length === 1 ? '' : 's'} — manual review required*`);
    lines.push('');
    for (const c of unclassified) {
      lines.push(`- [${c.file.name}](./_Unclassified/${c.file.name}) — ${c.result.reason}`);
    }
    lines.push('');
  }

  await fs.writeFile(path.join(outputDir, '_index.md'), lines.join('\n'), 'utf8');

  // Build _exhibit_list.md (sequential exhibit numbering)
  const exhibitLines = [];
  exhibitLines.push(`# Exhibit List`);
  exhibitLines.push('');
  exhibitLines.push(`Generated: ${now}`);
  exhibitLines.push('');
  exhibitLines.push('| Exhibit | Criterion | Event | File |');
  exhibitLines.push('|---------|-----------|-------|------|');
  let exhibitNum = 1;
  for (const crit of CRITERION_ORDER) {
    if (!byCrit.has(crit)) continue;
    for (const ev of byCrit.get(crit).values()) {
      for (const c of ev.files) {
        const linkPath = path.posix.join(critFolder(c.result.criterion), eventFolder(c.result), c.file.name);
        exhibitLines.push(`| Ex. ${exhibitNum} | ${CRITERION_DISPLAY[crit].name} | ${ev.title || '—'}${ev.date ? ` (${ev.date})` : ''} | [${c.file.name}](./${linkPath}) |`);
        exhibitNum++;
      }
    }
  }
  await fs.writeFile(path.join(outputDir, '_exhibit_list.md'), exhibitLines.join('\n'), 'utf8');

  // Build _index.json — machine-readable
  const json = {
    generated_at: new Date().toISOString(),
    input_folder: inputDir,
    output_folder: outputDir,
    llm: stats,
    counts: {
      input_total: classified.length + referenceFiles.length + duplicates.length,
      classified: classified.filter(c => c.result.criterion !== '_Unclassified').length,
      unclassified: classified.filter(c => c.result.criterion === '_Unclassified').length,
      reference: referenceFiles.length,
      duplicates: duplicates.length,
      letters: letters.length,
    },
    project_scope: {
      forms: projectRegistry?.forms || [],
      original_contribution_projects: projectRegistry?.originalContributionProjects || [],
      leading_critical_role_projects: projectRegistry?.leadingCriticalRoleProjects || [],
    },
    selected_criteria: selectedCriteria || [],
    criteria: {},
    letters: {
      independent: lettersByType.independent.map(serializeLetter),
      dependent:   lettersByType.dependent.map(serializeLetter),
      citation:    lettersByType.citation.map(serializeLetter),
    },
  };
  let exNum = 1;
  for (const crit of CRITERION_ORDER) {
    if (!byCrit.has(crit)) continue;
    const evList = [];
    for (const ev of byCrit.get(crit).values()) {
      evList.push({
        title: ev.title,
        date: ev.date,
        files: ev.files.map(c => ({
          exhibit: `Ex. ${exNum++}`,
          name: c.file.name,
          path: path.posix.join(critFolder(c.result.criterion), eventFolder(c.result), c.file.name),
          confidence: c.result.confidence,
          reason: c.result.reason,
        })),
      });
    }
    json.criteria[crit] = { citation: CRITERION_DISPLAY[crit].cite, events: evList };
  }
  await fs.writeFile(path.join(outputDir, '_index.json'), JSON.stringify(json, null, 2), 'utf8');
}

function critFolder(criterion) {
  return criterion;
}
function eventFolder(result) {
  if (!result.event_title) return '';
  const safe = result.event_title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
  return result.event_date ? `${safe} — ${result.event_date}` : safe;
}

function serializeLetter(l) {
  return {
    file: l.file.name,
    signer_name: l.result.signer_name,
    signer_title: l.result.signer_title,
    supports_criterion: l.result.criterion,
    event: l.result.event_title,
  };
}
