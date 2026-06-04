# Auto-Tagging Calibration

## Guardrails

- Auto-enable is only considered when model confidence clears the threshold **and** the
  normalized document type points to the same criterion.
- Criteria `03` (Published Material), `07` (Exhibitions), and `11` (Comparable Evidence)
  are always routed to a human.
- Reference letters are always routed to a human because they often span criteria `05` and `08`.

## Current threshold

- `AUTO_ENABLE_CONFIDENCE = 0.85`
- `QUEUE_FLOOR_CONFIDENCE = 0.40`

This remains the active threshold in `/src/lib/criterion-routing.ts`. It is intentionally
conservative until a larger attorney-labeled benchmark is available.

## Calibration script

Run:

```bash
node scripts/calibrate-auto-tag.mjs --job <workspace-id>
```

Or evaluate every local workspace:

```bash
node scripts/calibrate-auto-tag.mjs --all
```

The script writes JSONL rows to:

```text
storage/exports/auto-tag-calibration/<job-or-scope>.jsonl
```

Each row records:

- `documentType`
- `proposedCriterion`
- `confidence`
- `disposition`
- `correct`

`correct` is only populated when the selected workspace already contains an attorney-enabled
criterion tag for the same document. That keeps the script grounded in known human decisions
instead of fabricating labels.

## Current local measurement

Command used:

```bash
node scripts/calibrate-auto-tag.mjs --all
```

Result on the currently available local workspaces:

- threshold: `0.85`
- total AI-tag rows evaluated: `112`
- attorney-labeled comparison rows available: `1`
- auto-enabled labeled rows: `0`
- measured auto-enable precision: `not measurable yet`

Because the current local sample does **not** include attorney-labeled auto-enable examples,
precision is still pending on the intended 34-file benchmark workspace. Do not lower the
threshold or widen the priors until that benchmark is run and auto-enable precision is at
least `0.95`.
