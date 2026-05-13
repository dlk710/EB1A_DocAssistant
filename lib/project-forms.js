const ORIGINAL_FORM_PATTERNS = [
  /original contributions?/i,
  /original contribution template/i,
  /projects?\s+for\s+original contributions?/i,
];

const CRITICAL_ROLE_FORM_PATTERNS = [
  /critical role/i,
  /leading role/i,
  /leading\s*\/\s*critical role/i,
  /projects?\s+for\s+(?:leading|critical) role/i,
];

const HEADING_STOP_PATTERNS = [
  /^notes?[:]?$/i,
  /^evidence[:]?$/i,
  /^exhibits?[:]?$/i,
  /^supporting documents?[:]?$/i,
  /^summary[:]?$/i,
  /^description[:]?$/i,
];

export function buildProjectRegistry(prepared) {
  const forms = [];
  const originals = new Set();
  const criticalRoles = new Set();

  for (const item of prepared) {
    const kind = detectTemplateKind(item.file.name, item.rawText);
    if (!kind) continue;
    const projects = extractProjectsFromTemplate(item.rawText);
    const uniqueProjects = dedupeProjects(projects);
    forms.push({
      kind,
      fileName: item.file.name,
      relPath: item.file.relPath,
      projects: uniqueProjects,
    });
    for (const project of uniqueProjects) {
      if (kind === 'original_contributions') originals.add(project);
      if (kind === 'leading_critical_role') criticalRoles.add(project);
    }
  }

  return {
    forms,
    originalContributionProjects: [...originals],
    leadingCriticalRoleProjects: [...criticalRoles],
  };
}

export function buildClassificationProjectContext(registry) {
  const safeRegistry = registry || { forms: [], originalContributionProjects: [], leadingCriticalRoleProjects: [] };
  const lines = [];
  lines.push('Project scope constraints:');
  if (!safeRegistry.forms.length) {
    lines.push('- No client project template forms were detected in this folder. Do not invent project restrictions.');
    return lines.join('\n');
  }

  lines.push(`- Detected ${safeRegistry.forms.length} client template form${safeRegistry.forms.length === 1 ? '' : 's'}:`);
  for (const form of safeRegistry.forms) {
    const label = form.kind === 'original_contributions' ? 'Original Contributions' : 'Leading/Critical Role';
    lines.push(`  - ${label}: ${form.fileName}${form.projects.length ? ` -> ${form.projects.join('; ')}` : ' -> no projects extracted'}`);
  }

  if (safeRegistry.originalContributionProjects.length) {
    lines.push(`- For criterion 05 — Original Contributions, only use projects from this allowlist: ${safeRegistry.originalContributionProjects.join('; ')}`);
  }
  if (safeRegistry.leadingCriticalRoleProjects.length) {
    lines.push(`- For criterion 08 — Leading Critical Role, only use projects from this allowlist: ${safeRegistry.leadingCriticalRoleProjects.join('; ')}`);
  }
  lines.push('- If a file does not clearly relate to an allowed project for criterion 05 or 08, do not place it in that bucket. Choose a different supported criterion or _Unclassified.');
  return lines.join('\n');
}

export function enforceProjectScope(result, rawText, registry) {
  const safeRegistry = registry || { originalContributionProjects: [], leadingCriticalRoleProjects: [] };
  if (!result || !result.criterion) return result;
  if (result.criterion === '05 — Original Contributions' && safeRegistry.originalContributionProjects.length) {
    const matched = matchAllowedProject(result, rawText, safeRegistry.originalContributionProjects);
    if (!matched) {
      return scopedUnclassified(result, 'Original Contributions', safeRegistry.originalContributionProjects);
    }
    return { ...result, matched_project: matched };
  }
  if (result.criterion === '08 — Leading Critical Role' && safeRegistry.leadingCriticalRoleProjects.length) {
    const matched = matchAllowedProject(result, rawText, safeRegistry.leadingCriticalRoleProjects);
    if (!matched) {
      return scopedUnclassified(result, 'Leading Critical Role', safeRegistry.leadingCriticalRoleProjects);
    }
    return { ...result, matched_project: matched };
  }
  return result;
}

function scopedUnclassified(result, label, projects) {
  const allowlist = projects.join('; ');
  return {
    ...result,
    criterion: '_Unclassified',
    confidence: 'LOW',
    reason: `This file was not placed into ${label} because it does not clearly match any client-listed project in the corresponding template form.`,
    notes: appendNote(result.notes, `${label} project gate applied. Allowed projects: ${allowlist}`),
    matched_project: null,
  };
}

function appendNote(existing, extra) {
  return existing ? `${existing} ${extra}` : extra;
}

function matchAllowedProject(result, rawText, projects) {
  const haystack = normalizeForMatch([
    rawText,
    result.event_title,
    result.event_summary,
    result.reason,
    result.notes,
  ].filter(Boolean).join('\n'));

  for (const project of projects) {
    const projectKey = normalizeForMatch(project);
    if (!projectKey) continue;
    if (haystack.includes(projectKey)) return project;
    const words = projectKey.split(' ').filter(Boolean);
    if (words.length >= 2 && words.every(word => haystack.includes(word))) return project;
  }
  return null;
}

function detectTemplateKind(filename, rawText) {
  const haystack = `${filename}\n${rawText || ''}`;
  const hasOriginal = ORIGINAL_FORM_PATTERNS.some(pattern => pattern.test(haystack));
  const hasCritical = CRITICAL_ROLE_FORM_PATTERNS.some(pattern => pattern.test(haystack));
  if (hasOriginal && !hasCritical) return 'original_contributions';
  if (hasCritical && !hasOriginal) return 'leading_critical_role';
  if (hasOriginal && hasCritical) {
    const originalIdx = haystack.search(/original contributions?/i);
    const criticalIdx = haystack.search(/critical role|leading role/i);
    return originalIdx <= criticalIdx ? 'original_contributions' : 'leading_critical_role';
  }
  return null;
}

function extractProjectsFromTemplate(rawText = '') {
  const text = String(rawText || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const projects = [];
  let collecting = false;

  for (const line of lines) {
    if (/projects?(?:\s+mentioned|\s+covered|\s+list|\s+included)?\s*:/i.test(line)) {
      collecting = true;
      const afterColon = line.split(':').slice(1).join(':').trim();
      if (afterColon) projects.push(...splitProjectCandidates(afterColon));
      continue;
    }

    if (collecting) {
      if (HEADING_STOP_PATTERNS.some(pattern => pattern.test(line))) {
        collecting = false;
        continue;
      }
      if (/^(?:[-*•]|\d+[.)])\s+/.test(line)) {
        projects.push(...splitProjectCandidates(line.replace(/^(?:[-*•]|\d+[.)])\s+/, '')));
        continue;
      }
      if (/^[A-Z][A-Za-z0-9 .,&()/-]{2,}$/.test(line) && line.length <= 120) {
        projects.push(...splitProjectCandidates(line));
        continue;
      }
      if (line.length > 140) {
        collecting = false;
      }
    }
  }

  if (projects.length) return projects;

  return inferProjectLikePhrases(lines);
}

function splitProjectCandidates(value) {
  return value
    .split(/\s{2,}|;|,\s+(?=[A-Z])/)
    .map(part => part.replace(/^project\s*[:\-]?\s*/i, '').trim())
    .filter(part => part.length >= 3)
    .filter(part => !/^(yes|no|n\/a|na)$/i.test(part));
}

function inferProjectLikePhrases(lines) {
  return lines
    .filter(line => /\bproject\b/i.test(line) || /\bplatform\b/i.test(line) || /\bproduct\b/i.test(line))
    .flatMap(line => {
      const match = line.match(/(?:project|platform|product)\s*[:\-]?\s*(.+)$/i);
      return match ? splitProjectCandidates(match[1]) : [];
    });
}

function dedupeProjects(projects) {
  const seen = new Set();
  const out = [];
  for (const project of projects) {
    const cleaned = project.replace(/\s+/g, ' ').trim();
    const key = normalizeForMatch(cleaned);
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
