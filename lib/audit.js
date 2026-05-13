import fs from 'node:fs/promises';
import path from 'node:path';

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function writeAuditCsv(outputDir, audit) {
  const headers = [
    'original_path', 'destination_path', 'type', 'sha256',
    'criterion', 'secondary_criterion', 'event_id', 'event_title', 'event_date', 'event_summary', 'evidence_type', 'matched_project',
    'confidence', 'reason',
    'notes',
    'is_letter', 'letter_type', 'signer_name', 'signer_title',
  ];
  const rows = [headers.join(',')];
  for (const r of audit) {
    rows.push([
      csvCell(r.original),
      csvCell(r.destination),
      csvCell(r.type),
      csvCell(r.hash),
      csvCell(r.criterion),
      csvCell(r.secondary_criterion),
      csvCell(r.event_id),
      csvCell(r.event),
      csvCell(r.event_date),
      csvCell(r.event_summary),
      csvCell(r.evidence_type),
      csvCell(r.matched_project),
      csvCell(r.confidence),
      csvCell(r.reason),
      csvCell(r.notes),
      csvCell(r.is_letter),
      csvCell(r.letter_type),
      csvCell(r.signer_name),
      csvCell(r.signer_title),
    ].join(','));
  }
  await fs.writeFile(path.join(outputDir, '_audit.csv'), rows.join('\n') + '\n', 'utf8');
}
