export const CRITERIA_ORDER = [
  '01 — Awards & Recognition',
  '02 — Memberships',
  '03 — Published Material',
  '04 — Judging',
  '05 — Original Contributions',
  '06 — Authorship',
  '07 — Exhibitions',
  '08 — Leading Critical Role',
  '09 — High Salary',
  '10 — Commercial Success',
  '11 — Comparable Evidence',
];

export function normalizeSelectedCriteria(selectedCriteria) {
  const requested = Array.isArray(selectedCriteria) ? selectedCriteria : [];
  const filtered = requested.filter(item => CRITERIA_ORDER.includes(item));
  return filtered.length ? filtered : [...CRITERIA_ORDER];
}

export function buildCriteriaScopeContext(selectedCriteria) {
  const normalized = normalizeSelectedCriteria(selectedCriteria);
  if (normalized.length === CRITERIA_ORDER.length) {
    return 'Category scope: all EB1A criteria are enabled for this run.';
  }
  return [
    'Category scope constraints:',
    `- Only classify into these criteria for this run: ${normalized.join('; ')}`,
    '- If a file does not clearly fit one of those enabled criteria, return _Unclassified instead of another criterion.',
  ].join('\n');
}

export function enforceSelectedCriteria(result, selectedCriteria) {
  const normalized = normalizeSelectedCriteria(selectedCriteria);
  if (!result?.criterion || result.criterion === '_Unclassified') return result;
  if (normalized.includes(result.criterion)) return result;
  return {
    ...result,
    criterion: '_Unclassified',
    confidence: 'LOW',
    reason: `This file was kept out of ${result.criterion} because that category is not enabled for this run.`,
    notes: result.notes
      ? `${result.notes} Category scope gate applied for this run.`
      : 'Category scope gate applied for this run.',
  };
}
