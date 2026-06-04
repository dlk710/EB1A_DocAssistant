# Attorney-Requested Enhancements

## Evidence Quality Signals

Setu now asks the summarizer to capture objective-evidence metadata for each document:
publication venue, publication type, peer-review type, URLs, and self-solicitation
signals. Older summaries are read with safe defaults, and
`scripts/backfill-summary-metadata.mjs` can backfill stored Qdrant summaries.

Red-flag and blue-flag rules live in editable data files:

- `data/red-flags.json` captures weak or risky patterns such as press-release style
  media, sponsored placements, self-published sources, and unknown review method.
- `data/blue-flags.json` captures strong venue signals, but each entry must include
  standing proof metadata such as indexing, impact metric, and source.

These rules feed the Evidence Grid's decisiveness scoring. Red flags can push evidence
toward `liability`; blue flags can lift evidence toward `decisive` and prompt the
attorney to attach venue-standing proof.

## Review By Exception

The Evidence Grid separates work into attorney-actionable bands:

- `Needs review`: ambiguous, high-risk, or attorney-required items.
- `Auto-tagged`: high-confidence AI tags where the document-type prior agrees.
- `Archived first cut`: low-value or risk-only items Setu routes away from the live
  queue without deleting anything.
- `Reviewed`: items already dispositioned or resolved.

The first-cut archive is reversible. Choosing `Keep in review` records a workspace
review-state override and logs an attorney timeline event; choosing `Archive` uses the
normal manual archive disposition.

## Strategy Triage

Coverage now includes a deterministic strategy recommendation. Setu ranks criteria by
load-bearing evidence, decisive independent exhibits, red flags, and liability items.
The Strategy coverage card shows the recommended build-around criteria and criteria to
defer, but the attorney still selects the final mix at Lock.

The Strategy prompt receives the same recommendation block, so AI strategy drafting
starts from the evidence-quality scoring rather than raw tag counts alone.

## Configuration

Runtime settings expose defaults for:

- `archiveConfidenceFloor`
- `linkCheckTimeoutMs`
- `researchRecencyDays`
- `flagsDbVersion`

These can be overridden through persisted settings or environment variables as the
product moves toward officer-path checks and research workflows.
